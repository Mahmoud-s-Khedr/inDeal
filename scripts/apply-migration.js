const path = require('path');
const fs = require('fs');

// Load environment variables from .env.docker or .env
const envPath = path.resolve(__dirname, '../.env.docker');
require('dotenv').config({ path: fs.existsSync(envPath) ? envPath : undefined });

// If .env.docker didn't set DATABASE_URL (or individual vars), try default .env
if (!process.env.DATABASE_URL && !process.env.PGHOST) {
  require('dotenv').config();
}

const { pool } = require('../src/config/db');

async function run() {
  try {
    console.log(
      'DB Connection Details:',
      'Host:',
      process.env.PGHOST || 'NOT SET',
      'Port:',
      process.env.PGPORT || 'NOT SET',
      'User:',
      process.env.PGUSER || 'NOT SET',
      'Password:',
      process.env.DB_PASSWORD ? '****' : 'NOT SET',
      'Database:',
      process.env.DB_NAME || 'NOT SET'
    );

    const migrationPath = path.resolve(__dirname, '../AI_DOCS/migrations/pending_ui_gaps.sql');
    console.log(`Loading migration from: ${migrationPath}`);

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found at ${migrationPath}`);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Applying migration...');
    const res = await pool.query(sql);
    console.log('✅ Migration applied successfully.', res.rowCount);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    console.error('Stack:', err.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
