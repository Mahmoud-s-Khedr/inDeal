require('./../helpers/infraTeardown');
const test = require('node:test');
const assert = require('node:assert/strict');

const loadService = (analyticsAdminRepository) => {
  const servicePath = require.resolve('../../src/modules/admin/service/analytics.admin.service');
  const repositoryPath = require.resolve('../../src/modules/admin/repository/index.js');
  const previousService = require.cache[servicePath];
  const previousRepository = require.cache[repositoryPath];

  require.cache[repositoryPath] = {
    id: repositoryPath,
    filename: repositoryPath,
    loaded: true,
    exports: { analyticsAdminRepository },
  };

  delete require.cache[servicePath];
  const service = require(servicePath);

  return {
    service,
    restore: () => {
      delete require.cache[servicePath];
      if (previousRepository) require.cache[repositoryPath] = previousRepository;
      else delete require.cache[repositoryPath];
      if (previousService) require.cache[servicePath] = previousService;
    },
  };
};

test('admin analytics service normalizes overview counters to numbers', async () => {
  const { service, restore } = loadService({
    getPlatformOverview: async () => ({
      total_users: '11',
      total_companies: '5',
      total_deals: '9',
      total_deal_requests: '12',
      active_chats: '3',
    }),
  });

  try {
    const result = await service.getOverview();
    assert.deepEqual(result, {
      totalUsers: 11,
      totalCompanies: 5,
      totalDeals: 9,
      totalDealRequests: 12,
      activeChats: 3,
    });
  } finally {
    restore();
  }
});
