const { analyticsAdminRepository } = require('../repository');

const getOverview = async () => {
  const overview = await analyticsAdminRepository.getPlatformOverview();
  return {
    totalUsers: Number(overview.total_users || 0),
    totalCompanies: Number(overview.total_companies || 0),
    totalDeals: Number(overview.total_deals || 0),
    totalDealRequests: Number(overview.total_deal_requests || 0),
    activeChats: Number(overview.active_chats || 0),
  };
};

const getRegistrations = async (period) => {
  const rows = await analyticsAdminRepository.getRegistrationSeries(period);
  return {
    period,
    series: rows.map((row) => ({
      date: row.bucket,
      usersCount: Number(row.users_count || 0),
      companiesCount: Number(row.companies_count || 0),
    })),
  };
};

const mapStatusBreakdown = (rows) =>
  rows.map((row) => ({
    status: row.status,
    total: Number(row.total || 0),
  }));

const getDeals = async (period) => {
  const metrics = await analyticsAdminRepository.getDealMetrics(period);
  return {
    period,
    series: metrics.series.map((row) => ({
      date: row.bucket,
      dealsCount: Number(row.deals_count || 0),
    })),
    statusBreakdown: mapStatusBreakdown(metrics.statusBreakdown),
  };
};

const getRequests = async (period) => {
  const metrics = await analyticsAdminRepository.getRequestMetrics(period);
  return {
    period,
    series: metrics.series.map((row) => ({
      date: row.bucket,
      requestsCount: Number(row.requests_count || 0),
    })),
    statusBreakdown: mapStatusBreakdown(metrics.statusBreakdown),
  };
};

module.exports = {
  getOverview,
  getRegistrations,
  getDeals,
  getRequests,
};
