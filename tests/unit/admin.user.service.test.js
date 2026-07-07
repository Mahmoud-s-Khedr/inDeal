require('./../helpers/infraTeardown');
const test = require('node:test');
const assert = require('node:assert/strict');

const loadService = ({ userRepository, userAdminRepository }) => {
  const servicePath = require.resolve('../../src/modules/admin/service/user.admin.service');
  const userModulePath = require.resolve('../../src/modules/user/index.js');
  const adminRepositoryPath = require.resolve('../../src/modules/admin/repository/index.js');

  const previous = {
    service: require.cache[servicePath],
    userModule: require.cache[userModulePath],
    adminRepository: require.cache[adminRepositoryPath],
  };

  require.cache[userModulePath] = {
    id: userModulePath,
    filename: userModulePath,
    loaded: true,
    exports: { repository: { userRepository } },
  };

  require.cache[adminRepositoryPath] = {
    id: adminRepositoryPath,
    filename: adminRepositoryPath,
    loaded: true,
    exports: { userAdminRepository },
  };

  delete require.cache[servicePath];
  const service = require(servicePath);

  return {
    service,
    restore: () => {
      delete require.cache[servicePath];
      if (previous.userModule) require.cache[userModulePath] = previous.userModule;
      else delete require.cache[userModulePath];
      if (previous.adminRepository) require.cache[adminRepositoryPath] = previous.adminRepository;
      else delete require.cache[adminRepositoryPath];
      if (previous.service) require.cache[servicePath] = previous.service;
    },
  };
};

test('admin user service blocks self-demotion from admin role', async () => {
  const userRepository = {
    findById: async () => ({ id: 7, role: 'admin', status: 'verified' }),
    updateById: async () => {
      throw new Error('should not update');
    },
  };
  const userAdminRepository = {
    countActiveAdminsExcludingUser: async () => 1,
  };

  const { service, restore } = loadService({ userRepository, userAdminRepository });

  try {
    await assert.rejects(
      () => service.updateUserRole(7, 7, { role: 'support' }),
      /cannot remove your own admin role/i
    );
  } finally {
    restore();
  }
});

test('admin user service keeps the last active admin from being suspended', async () => {
  const userRepository = {
    findById: async () => ({ id: 3, role: 'admin', status: 'verified' }),
    updateById: async () => {
      throw new Error('should not update');
    },
  };
  const userAdminRepository = {
    countActiveAdminsExcludingUser: async () => 0,
  };

  const { service, restore } = loadService({ userRepository, userAdminRepository });

  try {
    await assert.rejects(
      () => service.updateUserStatus(99, 3, { status: 'suspended' }),
      /at least one active admin must remain/i
    );
  } finally {
    restore();
  }
});
