const AppError = require('../../../core/errors/AppError');
const dealModule = require('../../deal');
const { dealAdminRepository } = require('../repository');
const { mapPaginated, mapDealListItem } = require('../mappers/admin.mappers');

const { dealRepository } = dealModule.repository;
const dealService = dealModule.service;

const listDeals = async (query) => {
  const page = query.page;
  const limit = query.limit;
  const offset = (page - 1) * limit;

  const [items, total] = await Promise.all([
    dealAdminRepository.listDeals({ ...query, limit, offset }),
    dealAdminRepository.countDeals(query),
  ]);

  return mapPaginated({
    items: items.map(mapDealListItem),
    total,
    page,
    limit,
  });
};

const getDealById = async (dealId) => dealService.getDealById(dealId);

const updateDealStatus = async (dealId, payload) => {
  const existing = await dealRepository.findById(dealId);
  if (!existing) {
    throw new AppError('Deal not found', 404);
  }

  await dealRepository.updateStatus(dealId, payload.status);
  return getDealById(dealId);
};

module.exports = {
  listDeals,
  getDealById,
  updateDealStatus,
};
