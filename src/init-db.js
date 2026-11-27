import 'dotenv/config';
import { ensureDatabase, ensureSchema, pool, DB_NAME } from './db.js';

try {
  await ensureDatabase();
  await ensureSchema();
  console.log(`Base "${DB_NAME}" prête (tables users, sessions, image_groups, images, shares).`);
} catch (error) {
  console.error('Impossible de préparer la base :', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
