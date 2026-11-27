import path from 'node:path';
import fs from 'node:fs';
import { Router } from 'express';
import { pool } from '../db.js';
import { renderSharePage, renderShareMissing } from '../share-page.js';

const router = Router();
const STORAGE_DIR = path.resolve(process.cwd(), 'storage');
const TOKEN_RE = /^[a-f0-9]{32}$/;

async function findShare(token) {
  if (!TOKEN_RE.test(token)) return null;
  const [rows] = await pool.query(
    `SELECT s.token, s.created_at, i.filename, i.original_name, i.size, i.mime,
            i.created_at AS image_created_at, i.user_id, u.username AS owner
       FROM shares s
       JOIN images i ON i.id = s.image_id
       JOIN users u ON u.id = i.user_id
      WHERE s.token = ?
      LIMIT 1`,
    [token]
  );
  return rows[0] || null;
}

router.get('/:token', async (req, res, next) => {
  try {
    const share = await findShare(req.params.token);
    if (!share) {
      return res.status(404).type('html').send(renderShareMissing());
    }
    res.set('Cache-Control', 'no-store');
    res.type('html').send(
      renderSharePage({
        name: share.original_name,
        size: share.size,
        createdAt: share.image_created_at,
        token: share.token,
        owner: share.owner,
      })
    );
  } catch (error) {
    next(error);
  }
});

router.get('/:token/file', async (req, res, next) => {
  try {
    const share = await findShare(req.params.token);
    if (!share) return res.status(404).end();

    const filePath = path.join(STORAGE_DIR, String(share.user_id), share.filename);
    if (!fs.existsSync(filePath)) return res.status(404).end();

    const download = req.query.download !== undefined;
    res.type(share.mime);
    res.set('Cache-Control', 'public, max-age=3600');
    res.set(
      'Content-Disposition',
      `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(share.original_name)}`
    );
    res.sendFile(filePath, { dotfiles: 'allow' }, (error) => {
      if (error && !res.headersSent) res.status(404).end();
    });
  } catch (error) {
    next(error);
  }
});

export default router;
