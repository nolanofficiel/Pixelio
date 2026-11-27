import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
const NAME_MAX = 40;

/** Valide et normalise le nom d'un groupe. */
function cleanName(value) {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name || name.length > NAME_MAX) return null;
  return name;
}

const publicGroup = (row) => ({
  id: row.id,
  name: row.name,
  created_at: row.created_at,
  image_count: Number(row.image_count || 0),
});

router.use(requireAuth);

/* Liste les groupes de l'utilisateur avec le nombre d'images. */
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT g.id, g.name, g.created_at, COUNT(i.id) AS image_count
         FROM image_groups g
         LEFT JOIN images i ON i.group_id = g.id
        WHERE g.user_id = ?
        GROUP BY g.id, g.name, g.created_at
        ORDER BY g.name ASC, g.id ASC`,
      [req.user.id]
    );
    res.json({ groups: rows.map(publicGroup) });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  const name = cleanName(req.body?.name);
  if (!name) {
    return res.status(400).json({ error: `Le nom doit faire entre 1 et ${NAME_MAX} caractères.` });
  }
  try {
    const [[existing]] = await pool.query(
      'SELECT id FROM image_groups WHERE user_id = ? AND name = ? LIMIT 1',
      [req.user.id, name]
    );
    if (existing) return res.status(409).json({ error: 'Un groupe porte déjà ce nom.' });

    const [result] = await pool.query(
      'INSERT INTO image_groups (user_id, name) VALUES (?, ?)',
      [req.user.id, name]
    );
    res.status(201).json({
      group: { id: result.insertId, name, created_at: new Date(), image_count: 0 },
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  const name = cleanName(req.body?.name);
  if (!name) {
    return res.status(400).json({ error: `Le nom doit faire entre 1 et ${NAME_MAX} caractères.` });
  }
  try {
    const [[group]] = await pool.query(
      'SELECT id FROM image_groups WHERE id = ? AND user_id = ? LIMIT 1',
      [req.params.id, req.user.id]
    );
    if (!group) return res.status(404).json({ error: 'Groupe introuvable.' });

    const [[clash]] = await pool.query(
      'SELECT id FROM image_groups WHERE user_id = ? AND name = ? AND id <> ? LIMIT 1',
      [req.user.id, name, group.id]
    );
    if (clash) return res.status(409).json({ error: 'Un groupe porte déjà ce nom.' });

    await pool.query('UPDATE image_groups SET name = ? WHERE id = ? AND user_id = ?', [
      name,
      group.id,
      req.user.id,
    ]);
    res.json({ group: { id: group.id, name } });
  } catch (error) {
    next(error);
  }
});

/* Supprime le groupe ; les images repassent en « non classées » (ON DELETE SET NULL). */
router.delete('/:id', async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM image_groups WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Groupe introuvable.' });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
