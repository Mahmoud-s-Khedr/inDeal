const { pool } = require('../config/db');

const listByCompanyId = async (companyId) => {
    const result = await pool.query(
        `
        SELECT
            cr.id,
            cr.company_id,
            cr.reviewer_company_id,
            cr.review_text,
            cr.rating,
            cr.created_at,
            reviewer.name AS reviewer_name
        FROM company_reviews cr
        LEFT JOIN companies reviewer ON reviewer.id = cr.reviewer_company_id
        WHERE cr.company_id = $1
        ORDER BY cr.created_at DESC
        `,
        [companyId]
    );
    return result.rows;
};

const createReview = async ({ companyId, reviewerCompanyId, reviewText, rating }) => {
    const result = await pool.query(
        `
        INSERT INTO company_reviews (
            company_id,
            reviewer_company_id,
            review_text,
            rating
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [companyId, reviewerCompanyId, reviewText || null, rating]
    );

    return result.rows[0];
};

module.exports = {
    listByCompanyId,
    createReview,
};
