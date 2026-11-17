const { randomBytes, scryptSync } = require('node:crypto');
const { Pool } = require('pg');

async function run() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.error('Error: ADMIN_PASSWORD is not set');
    process.exit(1);
  }

  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  const passwordHash = `${salt}:${hash}`;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(
      'INSERT INTO esports_users (username, password_hash, is_admin) VALUES ($1, $2, true) ON CONFLICT (username) DO UPDATE SET password_hash = $2, is_admin = true',
      ['admin', passwordHash]
    );
    console.log('Admin user upserted successfully!');
  } catch (err) {
    console.error('Database error:', err.message);
  } finally {
    await pool.end();
  }
}

run();
