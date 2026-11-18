import postgres from 'postgres';

const connectionString = "postgresql://neondb_owner:npg_c2Evw5pxyHXu@ep-muddy-king-a1a9mqu5-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const sql = postgres(connectionString);

async function checkTables() {
  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `;
    console.log("--- Tables in Database ---");
    tables.forEach((t, index) => {
      console.log(`${index + 1}. ${t.table_name}`);
    });
  } catch (err) {
    console.error("Error occurred:", err);
  } finally {
    await sql.end();
  }
}

checkTables();
