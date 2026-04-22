const { pool } = require('../../../infrastructure/config/db');

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

const findById = async (id) => {
  const result = await pool.query(
    `
        SELECT id, company_id, image_file_id, description, uploaded_at
        FROM company_gallery
        WHERE id = $1
        LIMIT 1
        `,
    [id]
  );
  return result.rows[0];
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

const updateGalleryItem = async (id, updates) => {
  const fields = [];
  const values = [];
  let index = 1;

  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined) return;
    fields.push(`${key} = $${index}`);
    values.push(value);
    index += 1;
  });

  if (!fields.length) {
    return await findById(id);
  }

  const result = await pool.query(
    `
        UPDATE company_gallery
        SET ${fields.join(', ')}
        WHERE id = $${index}
        RETURNING id, company_id, image_file_id, description, uploaded_at
        `,
    [...values, id]
  );

  return result.rows[0] || null;
};

const deleteGalleryItem = async (id) => {
  const result = await pool.query(
    `
        DELETE FROM company_gallery
        WHERE id = $1
        RETURNING id, company_id, image_file_id, description, uploaded_at
        `,
    [id]
  );
  return result.rows[0] || null;
};

module.exports = {
  listByCompanyId,
  createGalleryItem,
  findById,
  updateGalleryItem,
  deleteGalleryItem,
};
