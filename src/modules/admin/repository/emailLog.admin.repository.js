const { pool } = require('../../../infrastructure/config/db');
const emailLogRepository = require('../../../infrastructure/repositories.emailLog');

const listEmailLogs = async ({ status, template, recipient, limit, offset }) => {
  return emailLogRepository.listLogs({ status, template, recipient, limit, offset });
};

const findEmailLogById = async (id) => emailLogRepository.findById(id);

const countEmailLogs = async ({ status, template, recipient }) => {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (status) {
    conditions.push(`status = $${paramIndex}`);
    params.push(status);
    paramIndex += 1;
  }

  if (template) {
    conditions.push(`template = $${paramIndex}`);
    params.push(template);
    paramIndex += 1;
  }

  if (recipient) {
    conditions.push(`recipient = $${paramIndex}`);
    params.push(recipient);
    paramIndex += 1;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM email_logs
      ${whereClause}
    `,
    params
  );

  return Number(result.rows[0]?.total || 0);
};

module.exports = {
  listEmailLogs,
  findEmailLogById,
  countEmailLogs,
};
