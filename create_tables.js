const { Pool } = require('pg');
async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS esports_tournaments (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        game_type TEXT NOT NULL,
        entry_fee DECIMAL(10, 2) DEFAULT 0.00,
        prize_pool DECIMAL(10, 2) DEFAULT 0.00,
        map TEXT,
        version TEXT,
        status TEXT DEFAULT 'upcoming',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS esports_matches (
        id SERIAL PRIMARY KEY,
        tournament_id INTEGER,
        room_id TEXT,
        room_password TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS esports_transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        amount DECIMAL(10, 2),
        type TEXT,
        status TEXT DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('All tables created successfully!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}
run();
