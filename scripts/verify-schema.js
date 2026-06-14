const { pool } = require('../src/infrastructure/config/db');

const REQUIRED_TABLES = [
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

const REQUIRED_COLUMNS = {
  companies: [
    'agent_id',
    'name',
    'status',
    'phone',
    'address',
    'company_type',
    'website',
    'contacts',
    'social_media_links',
  ],
  company_documents: ['company_id', 'file_id', 'doc_type', 'issue_date', 'expiry_date'],
  deals: ['company_id', 'deal_type', 'status'],
  deal_requests: [
    'deal_id',
    'applicant_company_id',
    'target_company_id',
    'request_kind',
    'request_type',
    'status',
  ],
  deal_request_supply_details: ['request_id', 'target_price', 'other_quality_level_description'],
  deal_request_demand_details: ['request_id', 'warranty_policy', 'return_policy'],
  chat_rooms: ['company_a_id', 'company_b_id', 'status', 'encryption_key'],
  chat_messages: ['room_id', 'sender_user_id', 'message_text', 'sent_at'],
  chat_message_reads: ['message_id', 'company_id', 'read_at'],
};

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
}

async function verifyTables() {
  const result = await pool.query(
    `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = ANY($1::text[])
    `,
    [REQUIRED_TABLES]
  );

  const existing = new Set(result.rows.map((r) => r.tablename));
  const missing = REQUIRED_TABLES.filter((t) => !existing.has(t));
  if (missing.length) {
    fail(`Missing tables: ${missing.join(', ')}`);
  } else {
    console.log('✅ Required tables exist');
  }
}

async function verifyColumns(tableName, requiredColumns) {
  const result = await pool.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
    `,
    [tableName]
  );

  const existing = new Set(result.rows.map((r) => r.column_name));
  const missing = requiredColumns.filter((col) => !existing.has(col));
  if (missing.length) {
    fail(`Table ${tableName} is missing columns: ${missing.join(', ')}`);
  } else {
    console.log(`✅ ${tableName} required columns exist`);
  }
}

async function run() {
  const timeout = setTimeout(() => {
    fail('Schema verification timed out');
    process.exit(1);
  }, 10000);

  try {
    console.log('🔎 Verifying V1 schema...');
    await verifyTables();

    for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
      await verifyColumns(table, columns);
    }

    if (!process.exitCode) {
      console.log('✅ Schema verification passed');
    }
  } catch (error) {
    fail(`Schema verification failed: ${error.message}`);
  } finally {
    clearTimeout(timeout);
    await pool.end();
    if (process.exitCode) {
      process.exit(process.exitCode);
    }
  }
}

run();
