import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

const STORAGE_DIR = path.resolve(process.cwd(), 'storage');
const ALLOWED = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['image/avif', '.avif'],
]);
const MAX_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 20;

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const dir = path.join(STORAGE_DIR, String(req.user.id));
    fs.mkdir(dir, { recursive: true }).then(() => cb(null, dir), cb);
  },
  filename(_req, file, cb) {
    const ext = ALLOWED.get(file.mimetype) || '';
    cb(null, `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE, files: MAX_FILES },
  fileFilter(_req, file, cb) {
    if (!ALLOWED.has(file.mimetype)) {
      const error = new Error('Format non pris en charge (JPEG, PNG, WebP, GIF ou AVIF).');
      error.status = 415;
      return cb(error);
    }
    cb(null, true);
  },
});

/** Vérifie la signature réelle du fichier (pas seulement le type annoncé). */
async function hasValidSignature(filePath, mime) {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(16);
    const { bytesRead } = await handle.read(buffer, 0, 16, 0);
    if (bytesRead < 12) return false;
    switch (mime) {
      case 'image/jpeg':
        return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      case 'image/png':
        return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      case 'image/gif':
        return buffer.subarray(0, 4).toString('latin1') === 'GIF8';
      case 'image/webp':
        return buffer.subarray(0, 4).toString('latin1') === 'RIFF'
          && buffer.subarray(8, 12).toString('latin1') === 'WEBP';
      case 'image/avif':
        return buffer.subarray(4, 8).toString('latin1') === 'ftyp';
      default:
        return false;
    }
  } finally {
    await handle.close();
  }
}

/** Les noms de fichiers arrivent en latin1 via multipart : on récupère l'UTF-8. */
function normalizeFilename(name) {
  const converted = Buffer.from(name, 'latin1').toString('utf8');
  return converted.includes('\uFFFD') ? name : converted;
}

const publicImage = (row) => ({
  id: row.id,
  name: row.original_name,
  mime: row.mime,
  size: row.size,
  created_at: row.created_at,
  group_id: row.group_id ?? null,
  url: `/api/images/${row.id}/file`,
  share: row.share_token
    ? { token: row.share_token, url: `/s/${row.share_token}` }
    : null,
});

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT i.id, i.original_name, i.mime, i.size, i.created_at, i.group_id,
              (SELECT s.token FROM shares s WHERE s.image_id = i.id ORDER BY s.id LIMIT 1) AS share_token
         FROM images i
        WHERE i.user_id = ?
        ORDER BY i.created_at DESC, i.id DESC`,
      [req.user.id]
    );
    res.json({ images: rows.map(publicImage) });
  } catch (error) {
    next(error);
  }
});

router.post('/', (req, res, next) => {
  upload.array('files', MAX_FILES)(req, res, async (uploadError) => {
    if (uploadError) {
      if (uploadError.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Fichier trop volumineux (20 Mo maximum).' });
      }
      return res.status(uploadError.status || 400).json({ error: uploadError.message });
    }

    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ error: 'Aucun fichier reçu.' });
    }

    const created = [];
    const rejected = [];
    try {
      // Groupe de destination facultatif (créé par l'utilisateur uniquement).
      let groupId = null;
      if (req.body?.groupId !== undefined && req.body.groupId !== '') {
        const [[group]] = await pool.query(
          'SELECT id FROM image_groups WHERE id = ? AND user_id = ? LIMIT 1',
          [Number(req.body.groupId) || 0, req.user.id]
        );
        if (!group) return res.status(404).json({ error: 'Groupe de destination introuvable.' });
        groupId = group.id;
      }

      for (const file of files) {
        const valid = await hasValidSignature(file.path, file.mimetype);
        if (!valid) {
          rejected.push(file.originalname);
          await fs.unlink(file.path).catch(() => {});
          continue;
        }
        const originalName = normalizeFilename(file.originalname).slice(0, 255);
        const [result] = await pool.query(
          `INSERT INTO images (user_id, group_id, filename, original_name, mime, size)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [req.user.id, groupId, file.filename, originalName, file.mimetype, file.size]
        );
        created.push(
          publicImage({
            id: result.insertId,
            group_id: groupId,
            original_name: originalName,
            mime: file.mimetype,
            size: file.size,
            created_at: new Date(),
          })
        );
      }

      if (!created.length) {
        return res.status(415).json({ error: 'Aucun fichier image valide.' });
      }
      res.status(201).json({ images: created, rejected });
    } catch (error) {
      next(error);
    }
  });
});

/* Crée (ou renvoie) le lien de partage public d'une image. */
router.post('/:id/share', async (req, res, next) => {
  try {
    const [[image]] = await pool.query(
      'SELECT id FROM images WHERE id = ? AND user_id = ? LIMIT 1',
      [req.params.id, req.user.id]
    );
    if (!image) return res.status(404).json({ error: 'Image introuvable.' });

    const [[existing]] = await pool.query(
      'SELECT token FROM shares WHERE image_id = ? ORDER BY id LIMIT 1',
      [image.id]
    );

    let token = existing?.token;
    if (!token) {
      token = crypto.randomBytes(16).toString('hex');
      await pool.query(
        'INSERT INTO shares (token, image_id, user_id) VALUES (?, ?, ?)',
        [token, image.id, req.user.id]
      );
    }

    res.status(201).json({ share: { token, url: `/s/${token}` } });
  } catch (error) {
    next(error);
  }
});

/* Désactive le partage : le lien public cesse de fonctionner immédiatement. */
router.delete('/:id/share', async (req, res, next) => {
  try {
    const [[image]] = await pool.query(
      'SELECT id FROM images WHERE id = ? AND user_id = ? LIMIT 1',
      [req.params.id, req.user.id]
    );
    if (!image) return res.status(404).json({ error: 'Image introuvable.' });

    await pool.query('DELETE FROM shares WHERE image_id = ? AND user_id = ?', [
      image.id,
      req.user.id,
    ]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

/* Déplace une image dans un groupe (groupId null = non classée). */
router.patch('/:id/group', async (req, res, next) => {
  try {
    const [[image]] = await pool.query(
      'SELECT id FROM images WHERE id = ? AND user_id = ? LIMIT 1',
      [req.params.id, req.user.id]
    );
    if (!image) return res.status(404).json({ error: 'Image introuvable.' });

    const raw = req.body?.groupId;
    let groupId = null;
    if (raw !== null && raw !== undefined && raw !== '') {
      const [[group]] = await pool.query(
        'SELECT id FROM image_groups WHERE id = ? AND user_id = ? LIMIT 1',
        [Number(raw) || 0, req.user.id]
      );
      if (!group) return res.status(404).json({ error: 'Groupe introuvable.' });
      groupId = group.id;
    }

    await pool.query('UPDATE images SET group_id = ? WHERE id = ? AND user_id = ?', [
      groupId,
      image.id,
      req.user.id,
    ]);
    res.json({ image: { id: image.id, group_id: groupId } });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/file', async (req, res, next) => {
  try {
    const [[image]] = await pool.query(
      'SELECT filename, original_name, mime FROM images WHERE id = ? AND user_id = ? LIMIT 1',
      [req.params.id, req.user.id]
    );
    if (!image) return res.status(404).json({ error: 'Image introuvable.' });

    const filePath = path.join(STORAGE_DIR, String(req.user.id), image.filename);
    res.type(image.mime);
    res.set('Cache-Control', 'private, max-age=604800');
    res.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(image.original_name)}`);
    res.sendFile(filePath, { dotfiles: 'allow' }, (error) => {
      if (error && !res.headersSent) res.status(404).end();
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const [[image]] = await pool.query(
      'SELECT filename FROM images WHERE id = ? AND user_id = ? LIMIT 1',
      [req.params.id, req.user.id]
    );
    if (!image) return res.status(404).json({ error: 'Image introuvable.' });

    await pool.query('DELETE FROM images WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    await fs.unlink(path.join(STORAGE_DIR, String(req.user.id), image.filename)).catch(() => {});
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
