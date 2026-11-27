import mysql from 'mysql2/promise';

const base = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  charset: 'utf8mb4',
};

export const DB_NAME = process.env.DB_NAME || 'vault_images';

/** Crée la base si elle n'existe pas encore (connexion sans base sélectionnée). */
export async function ensureDatabase() {
  const conn = await mysql.createConnection(base);
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await conn.end();
  }
}

export const pool = mysql.createPool({
  ...base,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/** Crée les tables manquantes. */
export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      username VARCHAR(32) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_username (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      token_hash CHAR(64) NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_token (token_hash),
      KEY idx_expires (expires_at),
      CONSTRAINT fk_sessions_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Groupes (dossiers) de l'utilisateur, pour trier les images.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS image_groups (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      name VARCHAR(40) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_user_name (user_id, name),
      CONSTRAINT fk_groups_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS images (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      group_id INT UNSIGNED NULL,
      filename VARCHAR(120) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      mime VARCHAR(64) NOT NULL,
      size INT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_user_date (user_id, created_at),
      KEY idx_group (group_id),
      CONSTRAINT fk_images_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE,
      CONSTRAINT fk_images_group FOREIGN KEY (group_id)
        REFERENCES image_groups (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Bases créées avant les groupes : on ajoute la colonne manquante.
  const [groupColumn] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'images' AND COLUMN_NAME = 'group_id'`,
    [DB_NAME]
  );
  if (!groupColumn.length) {
    await pool.query('ALTER TABLE images ADD COLUMN group_id INT UNSIGNED NULL AFTER user_id');
    await pool.query('ALTER TABLE images ADD KEY idx_group (group_id)');
    await pool.query(
      `ALTER TABLE images ADD CONSTRAINT fk_images_group FOREIGN KEY (group_id)
         REFERENCES image_groups (id) ON DELETE SET NULL`
    );
  }

  // Liens de partage publics : un jeton aléatoire par image.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shares (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      token CHAR(32) NOT NULL,
      image_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_token (token),
      KEY idx_image (image_id),
      KEY idx_user (user_id),
      CONSTRAINT fk_shares_image FOREIGN KEY (image_id)
        REFERENCES images (id) ON DELETE CASCADE,
      CONSTRAINT fk_shares_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function cleanupSessions() {
  await pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
}
