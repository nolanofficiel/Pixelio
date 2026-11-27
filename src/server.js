import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { ensureDatabase, ensureSchema, cleanupSessions } from './db.js';
import { attachUser } from './auth.js';
import authRoutes from './routes/auth.js';
import imageRoutes from './routes/images.js';
import groupRoutes from './routes/groups.js';
import shareRoutes from './routes/share.js';
import shareListRoutes from './routes/shares.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = path.join(root, 'private');
// Le projet vit dans un dossier caché (".v2rangement") : sendFile doit l'accepter.
const SEND_OPTIONS = { dotfiles: 'allow' };
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

fs.mkdirSync(path.join(root, 'storage'), { recursive: true });

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '256kb' }));
app.use(attachUser);

app.use(
  '/assets',
  express.static(path.join(root, 'public/assets'), { maxAge: 0, etag: true, index: false })
);

app.get('/', (_req, res) => {
  res.sendFile(path.join(pages, 'home.html'), SEND_OPTIONS);
});

app.get('/login', (req, res) => {
  if (req.user) return res.redirect('/app');
  res.sendFile(path.join(pages, 'login.html'), SEND_OPTIONS);
});

app.get('/register', (req, res) => {
  if (req.user) return res.redirect('/app');
  res.sendFile(path.join(pages, 'register.html'), SEND_OPTIONS);
});

app.get('/app', (req, res) => {
  if (!req.user) return res.redirect('/login');
  res.sendFile(path.join(pages, 'app.html'), SEND_OPTIONS);
});

app.use('/api/auth', authRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/shares', shareListRoutes);
app.use('/s', shareRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Route inconnue.' }));
app.use((_req, res) => res.redirect('/'));

// eslint-disable-next-line no-unused-vars
app.use((error, _req, res, _next) => {
  console.error('[erreur]', error);
  if (res.headersSent) return;
  res.status(error.status || 500).json({ error: 'Une erreur interne est survenue.' });
});

try {
  await ensureDatabase();
  await ensureSchema();
  await cleanupSessions();
  setInterval(() => cleanupSessions().catch(() => {}), 60 * 60 * 1000).unref();

  const server = app.listen(PORT, HOST, () => {
    const { port } = server.address();
    console.log(`Pixelio prêt sur http://${HOST}:${port} (Node ${process.version})`);
  });
} catch (error) {
  console.error('Connexion à MySQL impossible :', error.message);
  console.error('Vérifiez que MySQL (XAMPP) est démarré et que les identifiants de .env sont bons.');
  process.exit(1);
}
