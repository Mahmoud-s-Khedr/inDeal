const { pool } = require('../src/config/db');

// Add timeout to prevent hanging
setTimeout(() => {
  console.error('❌ Verification timed out!');
  process.exit(1);
}, 5000);

async function run() {
  try {
    console.log('Verifying Schema...');

    // Check company_agents table
    const agentsTable = await pool.query("SELECT to_regclass('public.company_agents') as exists");
    console.log('company_agents table exists:', !!agentsTable.rows[0].exists);

    // Check company_documents columns
    const docColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'company_documents'
    `);
    const docCols = docColumns.rows.map((r) => r.column_name);
    console.log('company_documents columns:', docCols);
    console.log('Has issue_date:', docCols.includes('issue_date'));
    console.log('Has expiry_date:', docCols.includes('expiry_date'));

    // Check companies columns (specifically contacts)
    const companyColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'companies'
    `);
    const compCols = companyColumns.rows.map((r) => r.column_name);
    console.log('companies columns:', compCols);
    console.log('Has contacts:', compCols.includes('contacts'));
    console.log('Has email:', compCols.includes('email'));
  } catch (err) {
    console.error('Check failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
