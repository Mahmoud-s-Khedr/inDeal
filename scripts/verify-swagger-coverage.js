const apiRoutes = require('../src/routes');
const { swaggerSpec } = require('../src/config/swagger');
const { discoverRouterOperations } = require('../src/config/swaggerRouteDiscovery');

const discoveredOperations = discoverRouterOperations(apiRoutes, { basePath: '/api' });
const discoveredSet = new Set(discoveredOperations.map((item) => `${item.method} ${item.path}`));

const documentedSet = new Set();
const invalidPathPrefixes = [];

for (const [path, methods] of Object.entries(swaggerSpec.paths || {})) {
  if (!path.startsWith('/api/v1')) {
    invalidPathPrefixes.push(path);
  }

  for (const method of Object.keys(methods || {})) {
    documentedSet.add(`${method.toLowerCase()} ${path}`);
  }
}

const missing = [...discoveredSet].filter((item) => !documentedSet.has(item)).sort();
const extra = [...documentedSet].filter((item) => !discoveredSet.has(item)).sort();

const hasErrors = missing.length > 0 || extra.length > 0 || invalidPathPrefixes.length > 0;

if (hasErrors) {
  console.error('Swagger coverage verification failed.');

  if (missing.length > 0) {
    console.error(`\nMissing operations in swagger (${missing.length}):`);
    for (const item of missing) {
      console.error(`  - ${item}`);
    }
  }

  if (extra.length > 0) {
    console.error(`\nExtra operations in swagger (${extra.length}):`);
    for (const item of extra) {
      console.error(`  - ${item}`);
    }
  }

  if (invalidPathPrefixes.length > 0) {
    console.error(`\nInvalid swagger path prefixes (${invalidPathPrefixes.length}):`);
    for (const path of invalidPathPrefixes) {
      console.error(`  - ${path}`);
    }
  }

  process.exit(1);
}

console.log('Swagger coverage verification passed.');
console.log(`Discovered operations: ${discoveredSet.size}`);
console.log(`Documented operations: ${documentedSet.size}`);
process.exit(0);
