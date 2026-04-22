const dotenv = require('dotenv');
dotenv.config();
const { pool } = require('../src/config/db');
const { execSync } = require('child_process');

async function checkDatabase() {
  console.log('🔍 Checking database status...');

  try {
    // Keep generated client in sync, then apply Prisma schema to the database.
    console.log('⚙️  Generating Prisma client...');
    execSync('npm run prisma:generate', { stdio: 'inherit' });

    console.log('⚙️  Applying Prisma schema...');
    execSync('npm run prisma:db:push', { stdio: 'inherit' });

    // Seed only when required tables exist and users is empty.
    const requiredSeedTables = ['users', 'companies'];
    const tableCheck = await pool.query(
      `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = ANY($1::text[])
      `,
      [requiredSeedTables]
    );
    const availableTables = new Set(tableCheck.rows.map((row) => row.tablename));
    const missingTables = requiredSeedTables.filter((name) => !availableTables.has(name));

    if (missingTables.length) {
      console.warn(
        `⚠️  Skipping auto-seed. Missing tables: ${missingTables.join(', ')}. ` +
          'This is expected while migration to Prisma is still partial.'
      );
      console.log('✅ Database is ready.');
      return;
    }

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
