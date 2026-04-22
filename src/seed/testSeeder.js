const { seedDevData } = require('./devSeeder');

/**
 * Test seeding now mirrors the v1-supported feature set.
 * Reuses dev seed data and excludes removed modules
 * (admin control plane, ads, notifications, support tickets/live chat, device tokens).
 */
const seedTestData = async () => {
  return seedDevData();
};

module.exports = { seedTestData };
