const { after } = require('node:test');
const { pool } = require('../../src/infrastructure/config/db');
const prisma = require('../../src/infrastructure/config/prisma');
const redis = require('../../src/infrastructure/config/redis');

let closed = false;

const closeInfra = async () => {
  if (closed) return;
  closed = true;

  try {
    await prisma.$disconnect();
  } catch {
    // best-effort teardown
  }

  try {
    await pool.end();
  } catch {
    // best-effort teardown
  }

  try {
    if (redis && typeof redis.quit === 'function') {
      await redis.quit();
    }
  } catch {
    try {
      redis.disconnect();
    } catch {
      // best-effort teardown
    }
  }
};

after(async () => {
  await closeInfra();
});

module.exports = { closeInfra };
