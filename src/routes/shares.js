import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
const TOKEN_RE = /^[a-f0-9]{32}$/;

router.use(requireAuth);

/* Tous les liens de partage actifs de l'utilisateur. */
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.token, s.created_at AS shared_at,
              i.id AS image_id, i.original_name, i.mime, i.size, i.created_at AS image_created_at,
              g.name AS group_name
         FROM shares s
         JOIN images i ON i.id = s.image_id
         LEFT JOIN image_groups g ON g.id = i.group_id
        WHERE s.user_id = ?
        ORDER BY s.created_at DESC, s.id DESC`,
      [req.user.id]
    );

    res.set('Cache-Control', 'no-store');
    res.json({
      shares: rows.map((row) => ({
        token: row.token,
        url: `/s/${row.token}`,
        shared_at: row.shared_at,
        image: {
          id: row.image_id,
          name: row.original_name,
          mime: row.mime,
          size: row.size,
          created_at: row.image_created_at,
          group_name: row.group_name || null,
        },
      })),
    });
  } catch (error) {
    next(error);
  }
});

/* Révocation d'un lien depuis la liste : il cesse de fonctionner aussitôt. */
router.delete('/:token', async (req, res, next) => {
  try {
    if (!TOKEN_RE.test(req.params.token)) {
      return res.status(404).json({ error: 'Lien introuvable.' });
    }
    const [result] = await pool.query('DELETE FROM shares WHERE token = ? AND user_id = ?', [
      req.params.token,
      req.user.id,
    ]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Lien introuvable.' });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
