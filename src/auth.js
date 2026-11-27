import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { pool } from './db.js';

const scrypt = promisify(crypto.scrypt);

export const SESSION_COOKIE = 'vault_sid';
export const SESSION_DAYS = 7;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
});

/* ---------- Mots de passe ---------- */

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT.keylen, SCRYPT);
  return [
    'scrypt',
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password, stored) {
  try {
    const [scheme, N, r, p, saltB64, keyB64] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64url');
    const expected = Buffer.from(keyB64, 'base64url');
    const key = await scrypt(password, salt, expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    });
    return key.length === expected.length && crypto.timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

/* ---------- Sessions ---------- */

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await pool.query(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    [hashToken(token), userId, expires]
  );
  return { token, expires };
}

export async function destroySession(token) {
  if (!token) return;
  await pool.query('DELETE FROM sessions WHERE token_hash = ?', [hashToken(token)]);
}

export function setSessionCookie(res, token, expires) {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), expires });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== name) continue;
    return decodeURIComponent(part.slice(index + 1).trim());
  }
  return null;
}

/** Attache req.user / req.sessionToken si la session est valide. */
export async function attachUser(req, _res, next) {
  try {
    const token = readCookie(req, SESSION_COOKIE);
    req.user = null;
    req.sessionToken = token;
    if (token) {
      const [rows] = await pool.query(
        `SELECT u.id, u.username, u.created_at
           FROM sessions s
           JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = ? AND s.expires_at > NOW()
          LIMIT 1`,
        [hashToken(token)]
      );
      if (rows.length) req.user = rows[0];
    }
    next();
  } catch (error) {
    next(error);
  }
}

/** Garde pour les routes API. */
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentification requise.' });
  next();
}
