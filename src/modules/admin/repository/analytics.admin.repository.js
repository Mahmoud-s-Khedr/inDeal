const { pool } = require('../../../infrastructure/config/db');

const PERIOD_DAYS = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

const resolveDays = (period) => PERIOD_DAYS[period] || PERIOD_DAYS['30d'];

const getPlatformOverview = async () => {
  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM companies) AS total_companies,
      (SELECT COUNT(*) FROM deals) AS total_deals,
      (SELECT COUNT(*) FROM deal_requests) AS total_deal_requests,
      (SELECT COUNT(*) FROM chat_rooms WHERE status = 'active') AS active_chats
  `);

  return result.rows[0];
};

const getRegistrationSeries = async (period) => {
  const days = resolveDays(period);
  const result = await pool.query(
    `
      WITH series AS (
        SELECT generate_series(
          current_date - ($1::int - 1) * interval '1 day',
          current_date,
          interval '1 day'
        )::date AS bucket
      )
      SELECT s.bucket,
             COALESCE(u.total_users, 0)::int AS users_count,
             COALESCE(c.total_companies, 0)::int AS companies_count
      FROM series s
      LEFT JOIN (
        SELECT created_at::date AS bucket, COUNT(*) AS total_users
        FROM users
        WHERE created_at >= current_date - ($1::int - 1) * interval '1 day'
        GROUP BY created_at::date
      ) u ON u.bucket = s.bucket
      LEFT JOIN (
        SELECT created_at::date AS bucket, COUNT(*) AS total_companies
        FROM companies
        WHERE created_at >= current_date - ($1::int - 1) * interval '1 day'
        GROUP BY created_at::date
      ) c ON c.bucket = s.bucket
      ORDER BY s.bucket ASC
    `,
    [days]
  );

  return result.rows;
};

const getDealMetrics = async (period) => {
  const days = resolveDays(period);
  const [seriesResult, breakdownResult] = await Promise.all([
    pool.query(
      `
        WITH series AS (
          SELECT generate_series(
            current_date - ($1::int - 1) * interval '1 day',
            current_date,
            interval '1 day'
          )::date AS bucket
        )
        SELECT s.bucket,
               COALESCE(d.total_deals, 0)::int AS deals_count
        FROM series s
        LEFT JOIN (
          SELECT created_at::date AS bucket, COUNT(*) AS total_deals
          FROM deals
          WHERE created_at >= current_date - ($1::int - 1) * interval '1 day'
          GROUP BY created_at::date
        ) d ON d.bucket = s.bucket
        ORDER BY s.bucket ASC
      `,
      [days]
    ),
    pool.query(`
      SELECT status, COUNT(*)::int AS total
      FROM deals
      GROUP BY status
      ORDER BY status ASC
    `),
  ]);

  return {
    series: seriesResult.rows,
    statusBreakdown: breakdownResult.rows,
  };
};

const getRequestMetrics = async (period) => {
  const days = resolveDays(period);
  const [seriesResult, breakdownResult] = await Promise.all([
    pool.query(
      `
        WITH series AS (
          SELECT generate_series(
            current_date - ($1::int - 1) * interval '1 day',
            current_date,
            interval '1 day'
          )::date AS bucket
        )
        SELECT s.bucket,
               COALESCE(r.total_requests, 0)::int AS requests_count
        FROM series s
        LEFT JOIN (
          SELECT created_at::date AS bucket, COUNT(*) AS total_requests
          FROM deal_requests
          WHERE created_at >= current_date - ($1::int - 1) * interval '1 day'
          GROUP BY created_at::date
        ) r ON r.bucket = s.bucket
        ORDER BY s.bucket ASC
      `,
      [days]
    ),
    pool.query(`
      SELECT status, COUNT(*)::int AS total
      FROM deal_requests
      GROUP BY status
      ORDER BY status ASC
    `),
  ]);

  return {
    series: seriesResult.rows,
    statusBreakdown: breakdownResult.rows,
  };
};

module.exports = {
  getPlatformOverview,
  getRegistrationSeries,
  getDealMetrics,
  getRequestMetrics,
};
