const dotenv = require('dotenv');
dotenv.config();
const { pool } = require('../src/infrastructure/config/db');
const { execSync } = require('child_process');

async function checkDatabase() {
  console.log('🔍 Checking database status...');

  try {
    // Keep generated client in sync, then apply Prisma schema to the database.
    console.log('⚙️  Generating Prisma client...');
    execSync('npm run prisma:generate', { stdio: 'inherit' });

    console.log('⚙️  Applying Prisma schema...');
    execSync('npm run prisma:db:push', { stdio: 'inherit' });

    // Require all critical V1 runtime tables before starting the app.
    const requiredTables = [
      'users',
      'user_password_history',
      'files',
      'companies',
      'company_gallery',
      'company_documents',
      'company_contributions',
      'company_contribution_media',
      'company_reviews',
      'deals',
      'deal_attachments',
      'deal_requests',
      'deal_request_supply_details',
      'deal_request_demand_details',
      'deal_request_attachments',
      'chat_rooms',
      'chat_messages',
      'chat_message_reads',
      'email_logs',
    ];
    const tableCheck = await pool.query(
      `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = ANY($1::text[])
      `,
      [requiredTables]
    );
    const availableTables = new Set(tableCheck.rows.map((row) => row.tablename));
    const missingTables = requiredTables.filter((name) => !availableTables.has(name));

    if (missingTables.length) {
      throw new Error(
        `Critical schema is incomplete after Prisma db push. Missing tables: ${missingTables.join(', ')}`
      );
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
