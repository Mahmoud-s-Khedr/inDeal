const searchRepository = require('../repository/search.repository');

const search = async ({ q, types, limit = 20, offset = 0 }, user = null) => {
  const companyId = user?.company?.id ? Number(user.company.id) : null;

  const rows = await searchRepository.searchUnified({
    q,
    types,
    limit,
    offset,
    companyId,
  });

  const total = rows[0]?.total_count || 0;
  const items = rows.map((row) => ({
    entityType: row.entityType,
    entityId: row.entityId,
    score: Number(row.score || 0),
    title: row.title,
    snippet: row.snippet,
    meta: row.meta || {},
  }));

  return {
    items,
    total,
    limit,
    offset,
  };
};

module.exports = {
  search,
};
