const { getAllHttpContracts } = require('../src/core/contracts/http/registry');

const contracts = getAllHttpContracts();

const missing = contracts.filter(
  (c) => !c.requestSchema || !c.successResponseSchema || typeof c.auth === 'undefined'
);

if (missing.length) {
  console.error('HTTP contract coverage verification failed. Missing metadata for:');
  for (const c of missing) {
    console.error(`- ${c.method.toUpperCase()} ${c.path}`);
  }
  process.exit(1);
}

console.log(`HTTP contract coverage verification passed (${contracts.length} operations).`);
