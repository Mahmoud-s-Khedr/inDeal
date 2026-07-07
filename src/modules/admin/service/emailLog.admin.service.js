const AppError = require('../../../core/errors/AppError');
const { emailLogAdminRepository } = require('../repository');
const { mapPaginated, mapEmailLog } = require('../mappers/admin.mappers');

const listEmailLogs = async (query) => {
  const page = query.page;
  const limit = query.limit;
  const offset = (page - 1) * limit;

  const [items, total] = await Promise.all([
    emailLogAdminRepository.listEmailLogs({ ...query, limit, offset }),
    emailLogAdminRepository.countEmailLogs(query),
  ]);

  return mapPaginated({
    items: items.map(mapEmailLog),
    total,
    page,
    limit,
  });
};

const getEmailLogById = async (id) => {
  const log = await emailLogAdminRepository.findEmailLogById(id);
  if (!log) {
    throw new AppError('Email log not found', 404);
  }

  return mapEmailLog(log);
};

module.exports = {
  listEmailLogs,
  getEmailLogById,
};
