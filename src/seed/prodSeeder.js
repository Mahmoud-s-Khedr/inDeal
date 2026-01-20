const dotenv = require('dotenv');
dotenv.config();
const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/user.repository');
const logger = require('../utils/logger');

const truthy = (value) => value === true || value === 'true' || value === '1' || value === 1;

const getSeedConfig = () => {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@indeal.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Password123!';
  const adminUsername = process.env.SEED_ADMIN_USERNAME || 'admin';

  const forcePasswords = truthy(process.env.SEED_FORCE_PASSWORD);

  return {
    admin: {
      email: adminEmail.toLowerCase(),
      password: adminPassword,
      username: adminUsername,
      firstName: process.env.SEED_ADMIN_FIRST_NAME || 'Admin',
      lastName: process.env.SEED_ADMIN_LAST_NAME || 'User',
    },
    forcePasswords,
  };
};

const ensureUser = async ({
  email,
  username,
  firstName,
  lastName,
  role,
  status,
  password,
  forcePassword,
}) => {
  const existing = await userRepository.findByEmail(email);

  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 12);
    const created = await userRepository.createUser(null, {
      username,
      email,
      passwordHash,
      firstName,
      lastName,
      jobTitle: null,
    });

    const updated = await userRepository.updateById(created.id, {
      role,
      status,
    });

    return updated;
  }

  const updates = {
    username,
    first_name: firstName,
    last_name: lastName,
    role,
    status,
  };

  const updated = await userRepository.updateById(existing.id, updates);

  if (forcePassword) {
    const passwordHash = await bcrypt.hash(password, 12);
    await userRepository.updatePasswordHash(existing.id, passwordHash);
  }

  return updated;
};

const seedProdData = async () => {
  const cfg = getSeedConfig();

  const admin = await ensureUser({
    ...cfg.admin,
    role: 'admin',
    status: 'verified',
    forcePassword: cfg.forcePasswords,
  });

  logger.info('✅ Production seed completed (admin only)', {
    adminEmail: admin.email,
  });

  return { admin };
};

module.exports = {
  seedProdData,
};
