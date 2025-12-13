const { pool } = require('../config/db');

const listByCompanyId = async (companyId) => {
    const result = await pool.query(
        `
        SELECT id, company_id, image_file_id, description, uploaded_at
        FROM company_gallery
        WHERE company_id = $1
        ORDER BY uploaded_at DESC
        `,
        [companyId]
    );
    return result.rows;
};

const createGalleryItem = async ({ companyId, imageFileId, description }) => {
    const result = await pool.query(
        `
        INSERT INTO company_gallery (company_id, image_file_id, description)
        VALUES ($1, $2, $3)
        RETURNING id, company_id, image_file_id, description, uploaded_at
        `,
        [companyId, imageFileId, description || null]
    );
    return result.rows[0];
};

module.exports = {
    listByCompanyId,
    createGalleryItem,
};
