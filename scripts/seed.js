const { seedDevData } = require('../src/seed/devSeeder');
const { pool } = require('../src/config/db');
const redis = require('../src/config/redis');

async function run() {
    try {
        console.log('🌱 Starting database seeding...');
        await seedDevData();
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
