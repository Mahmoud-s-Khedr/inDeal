const { seedDevData } = require('../src/seed/devSeeder');
const { seedProdData } = require('../src/seed/prodSeeder');
const { seedTestData } = require('../src/seed/testSeeder');
const { pool } = require('../src/infrastructure/config/db');
const redis = require('../src/infrastructure/config/redis');

async function run() {
  try {
    const mode = String(process.env.SEED_MODE || 'dev').toLowerCase();
    const runners = {
      dev: seedDevData,
      prod: seedProdData,
      test: seedTestData,
    };

    const runner = runners[mode];
    if (!runner) {
      throw new Error(`Unknown SEED_MODE "${mode}". Use one of: dev, prod, test.`);
    }

    console.log(`🌱 Starting database seeding (mode=${mode})...`);
    await runner();
    console.log('✅ Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
    await redis.quit();
    process.exit(0);
  }
}

run();
