const { Pool } = require('pg');
async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('Testing esports_users query...');
    const res = await pool.query(
      'SELECT id, username, password_hash, mobile, game_id, game_type, upi_id, is_admin, wallet_balance, total_earned, created_at FROM esports_users WHERE username = $1',
      ['admin']
    );
    console.log('Query Success! Rows found:', res.rows.length);
  } catch (err) {
    console.error('EXACT DATABASE ERROR:', err.message);
  } finally {
    await pool.end();
  }
}
run();
