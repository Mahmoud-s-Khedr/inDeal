const dotenv = require('dotenv');
dotenv.config();
const { pool } = require('../src/config/db');
const { execSync } = require('child_process');

async function checkDatabase() {
  console.log('🔍 Checking database status...');

  try {
    // 1. Check if users table exists
    // We query information_schema to see if the table exists
    const tableResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);

    const tableExists = tableResult.rows[0].exists;

    if (!tableExists) {
      console.log('⚠️  Database schema not found. Running db:schema...');
      execSync('npm run db:schema', { stdio: 'inherit' });

      // After schema creation, we definitely need to seed
      console.log('🌱 Schema created. Running db:seed...');
      execSync('npm run db:seed', { stdio: 'inherit' });
      return;
    }

    // 2. Check if data exists in users table
    const countResult = await pool.query('SELECT count(*) FROM users');
    const userCount = parseInt(countResult.rows[0].count, 10);

    if (userCount === 0) {
      console.log('⚠️  Database schema exists but is empty. Running db:seed...');
      execSync('npm run db:seed', { stdio: 'inherit' });
    } else {
      console.log('✅ Database is ready.');
    }
  } catch (error) {
    console.error('❌ Database check failed:', error);
    // If the database connection itself fails (e.g. invalid credentials or DB doesn't exist),
    // we might want to let it crash so the user sees the error,
    // or we could assume it's fresh and try to run schema if the error suggests "relation does not exist" etc.
    // For now, failure to connect is fatal.
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkDatabase();
