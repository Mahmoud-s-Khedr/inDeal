const { pool } = require('../config/db');

const run = (client) => client || pool;

const replaceForDeal = async (client, dealId, attachments = []) => {
  const executor = run(client);
  await executor.query('DELETE FROM deal_attachments WHERE deal_id = $1', [dealId]);

  if (!attachments.length) {
    return [];
  }

  const rows = [];
  for (const attachment of attachments) {
    const result = await executor.query(
      `
        INSERT INTO deal_attachments (deal_id, file_id, kind, sort_order)
        VALUES ($1, $2, $3, $4)
        RETURNING id, deal_id, file_id, kind, sort_order, created_at
      `,
      [dealId, attachment.fileId, attachment.kind, attachment.sortOrder ?? 0]
    );
    rows.push(result.rows[0]);
  }

  return rows;
};

const listByDealIds = async (dealIds = []) => {
  if (!dealIds.length) return [];

  const result = await pool.query(
    `
      SELECT id, deal_id, file_id, kind, sort_order, created_at
      FROM deal_attachments
      WHERE deal_id = ANY($1::int[])
      ORDER BY sort_order ASC, id ASC
    `,
    [dealIds]
  );

  return result.rows;
};

module.exports = {
  replaceForDeal,
  listByDealIds,
};
