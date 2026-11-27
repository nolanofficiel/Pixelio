import { Router } from 'express';
import { pool } from '../db.js';
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
} from '../auth.js';

const router = Router();

const USERNAME_RE = /^[A-Za-z0-9._-]{3,24}$/;

function validateCredentials(body) {
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const confirm = typeof body?.passwordConfirm === 'string' ? body.passwordConfirm : null;

  if (!USERNAME_RE.test(username)) {
    return { error: "Le nom d'utilisateur doit contenir 3 à 24 caractères (lettres, chiffres, . _ -)." };
  }
  if (password.length < 8) {
    return { error: 'Le mot de passe doit contenir au moins 8 caractères.' };
  }
  if (password.length > 200) {
    return { error: 'Le mot de passe est trop long (200 caractères maximum).' };
  }
  if (confirm !== null && confirm !== password) {
    return { error: 'Les deux mots de passe ne correspondent pas.' };
  }
  return { username, password };
}

/* Limitation simple des tentatives de connexion : 10 essais / 5 min par IP. */
const attempts = new Map();
const WINDOW = 5 * 60_000;
const MAX_ATTEMPTS = 10;

function tooManyAttempts(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.start > WINDOW) return false;
  return entry.count >= MAX_ATTEMPTS;
}

function registerFailure(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.start > WINDOW) {
    attempts.set(ip, { start: now, count: 1 });
  } else {
    entry.count += 1;
  }
}

function resetAttempts(ip) {
  attempts.delete(ip);
}

router.post('/register', async (req, res, next) => {
  try {
    const { error, username, password } = validateCredentials(req.body);
    if (error) return res.status(400).json({ error });

    const [existing] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
    if (existing.length) {
      return res.status(409).json({ error: "Ce nom d'utilisateur est déjà pris." });
    }

    const passwordHash = await hashPassword(password);
    const [result] = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username, passwordHash]
    );

    const { token, expires } = await createSession(result.insertId);
    setSessionCookie(res, token, expires);
    res.status(201).json({ user: { id: result.insertId, username } });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: "Ce nom d'utilisateur est déjà pris." });
    }
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const ip = req.ip || 'unknown';
    if (tooManyAttempts(ip)) {
      return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans quelques minutes.' });
    }

    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!username || !password) {
      return res.status(400).json({ error: "Nom d'utilisateur et mot de passe requis." });
    }

    const [rows] = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1',
      [username]
    );

    const valid = rows.length ? await verifyPassword(password, rows[0].password_hash) : false;
    if (!valid) {
      registerFailure(ip);
      return res.status(401).json({ error: "Nom d'utilisateur ou mot de passe incorrect." });
    }

    resetAttempts(ip);
    await pool.query('DELETE FROM sessions WHERE user_id = ? AND expires_at < NOW()', [rows[0].id]);
    const { token, expires } = await createSession(rows[0].id);
    setSessionCookie(res, token, expires);
    res.json({ user: { id: rows[0].id, username: rows[0].username } });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    await destroySession(req.sessionToken);
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: { id: req.user.id, username: req.user.username, created_at: req.user.created_at } });
});

export default router;
