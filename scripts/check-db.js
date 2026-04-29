const { pool } = require('../src/infrastructure/config/db');
const { bootstrapSearch } = require('./bootstrap-search');

const checkDb = async () => {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
};

const verifySearchBootstrap = async () => {
  const result = await pool.query(
    "SELECT public.normalize_search_text('Health Check') AS normalized"
  );
  return result.rows?.[0]?.normalized;
};

const run = async () => {
  await checkDb();
  await bootstrapSearch();
  await verifySearchBootstrap();
};

if (require.main === module) {
  run()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database/search bootstrap failed:', error?.message || error);
      process.exit(1);
    });
}

module.exports = {
  checkDb,
  run,
};
