#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

const schemaPath = path.resolve(__dirname, '../AI_DOCS/schema.sql');

function parseArgs(argv) {
  const args = {
    seed: false,
    skipSchema: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--seed') {
      args.seed = true;
      continue;
    }

    if (arg === '--skip-schema') {
      args.skipSchema = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
  }

  return args;
}

async function applySqlFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} file not found: ${filePath}`);
  }

  console.log(`🛠️  Applying ${label}:`, filePath);
  const sql = fs.readFileSync(filePath, 'utf-8');
  await pool.query(sql);
  console.log(`✅ ${label} applied successfully`);
}

async function run() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log('Usage: node scripts/run-schema.js [--seed] [--skip-schema]');
    console.log('');
    console.log('Options:');
    console.log('  --seed              Run the JS seeder after schema.sql');
    console.log('  --skip-schema       Only run seed step (useful on existing DB)');
    console.log('');
    console.log('Env toggles:');
    console.log('  DB_SEED=true        Enable seeding');
    console.log('  SEED_FORCE_PASSWORD=true  Reset seeded user passwords');
    process.exit(0);
  }

  const seedEnabled =
    args.seed ||
    process.env.DB_SEED === 'true' ||
    process.env.DB_SEED === '1' ||
    process.env.SEED === 'true' ||
    process.env.SEED === '1';

  try {
    if (!args.skipSchema) {
      await applySqlFile(schemaPath, 'schema');
    }

    if (seedEnabled) {
      const mode = String(process.env.SEED_MODE || 'dev').toLowerCase();
      const { seedDevData } = require('../src/seed/devSeeder');
      const { seedProdData } = require('../src/seed/prodSeeder');
      const { seedTestData } = require('../src/seed/testSeeder');

      const runners = {
        dev: seedDevData,
        prod: seedProdData,
        test: seedTestData,
      };

      const runner = runners[mode];
      if (!runner) {
        throw new Error(`Unknown SEED_MODE "${mode}". Use one of: dev, prod, test.`);
      }

      await runner();
    }
  } catch (error) {
    console.error('❌ Database initialization failed');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
