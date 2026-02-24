const dotenv = require('dotenv');
dotenv.config();
const { pool } = require('../src/config/db');
const { execSync } = require('child_process');

async function checkDatabase() {
  console.log('🔍 Checking database status...');

  try {
    // Always apply schema — it is fully idempotent (IF NOT EXISTS everywhere),
    // so re-running it on an existing DB is safe and picks up any new columns/tables.
    console.log('⚙️  Applying schema (idempotent)...');
    execSync('npm run db:schema', { stdio: 'inherit' });

    // Seed if the users table is empty
    const countResult = await pool.query('SELECT count(*) FROM users');
    const userCount = parseInt(countResult.rows[0].count, 10);

    if (userCount === 0) {
      console.log('🌱 Database empty. Running db:seed...');
      execSync('npm run db:seed', { stdio: 'inherit' });
    } else {
      console.log('✅ Database is ready.');
    }
  } catch (error) {
    console.error('❌ Database check failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkDatabase();
