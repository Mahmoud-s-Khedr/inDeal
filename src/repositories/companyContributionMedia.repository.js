const { pool } = require('../config/db');

const mapMedia = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    contributionId: row.contribution_id,
    fileId: row.file_id,
    mediaType: row.media_type,
    mediaUrl: row.media_url,
    sortOrder: row.sort_order,
    caption: row.caption,
    createdAt: row.created_at,
  };
};

/**
 * List all media items for a contribution, ordered by sort_order.
 */
const listByContributionId = async (contributionId) => {
  const result = await pool.query(
    `
        SELECT id, contribution_id, file_id, media_type, media_url, sort_order, caption, created_at
        FROM company_contribution_media
        WHERE contribution_id = $1
        ORDER BY sort_order ASC, id ASC
        `,
    [contributionId]
  );
  return result.rows.map(mapMedia);
};

/**
 * Batch fetch media for multiple contributions (for list views).
 */
const listByContributionIds = async (contributionIds) => {
  if (!contributionIds || !contributionIds.length) {
    return [];
  }

  const result = await pool.query(
    `
        SELECT id, contribution_id, file_id, media_type, media_url, sort_order, caption, created_at
        FROM company_contribution_media
        WHERE contribution_id = ANY($1::int[])
        ORDER BY contribution_id, sort_order ASC, id ASC
        `,
    [contributionIds]
  );
  return result.rows.map(mapMedia);
};

/**
 * Find a single media item by ID.
 */
const findById = async (id) => {
  const result = await pool.query(
    `
        SELECT id, contribution_id, file_id, media_type, media_url, sort_order, caption, created_at
        FROM company_contribution_media
        WHERE id = $1
        LIMIT 1
        `,
    [id]
  );
  return mapMedia(result.rows[0]);
};

/**
 * Add a media item to a contribution.
 */
const addMedia = async ({ contributionId, fileId, mediaType, mediaUrl, caption, sortOrder }) => {
  const result = await pool.query(
    `
        INSERT INTO company_contribution_media (contribution_id, file_id, media_type, media_url, caption, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, contribution_id, file_id, media_type, media_url, sort_order, caption, created_at
        `,
    [contributionId, fileId || null, mediaType, mediaUrl || null, caption || null, sortOrder ?? 0]
  );
  return mapMedia(result.rows[0]);
};

/**
 * Update a media item.
 */
const updateMedia = async (id, updates) => {
  const fields = [];
  const values = [];
  let index = 1;

  const allowedFields = ['file_id', 'media_type', 'media_url', 'caption', 'sort_order'];

  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined || !allowedFields.includes(key)) return;
    fields.push(`${key} = $${index}`);
    values.push(value);
    index += 1;
  });

  if (!fields.length) {
    return await findById(id);
  }

  const result = await pool.query(
    `
        UPDATE company_contribution_media
        SET ${fields.join(', ')}
        WHERE id = $${index}
        RETURNING id, contribution_id, file_id, media_type, media_url, sort_order, caption, created_at
        `,
    [...values, id]
  );
  return mapMedia(result.rows[0]);
};

/**
 * Delete a media item.
 */
const deleteMedia = async (id) => {
  const result = await pool.query(
    `
        DELETE FROM company_contribution_media
        WHERE id = $1
        RETURNING id, contribution_id, file_id, media_type, media_url, sort_order, caption, created_at
        `,
    [id]
  );
  return mapMedia(result.rows[0]);
};

/**
 * Reorder media items for a contribution.
 * @param {number} contributionId
 * @param {number[]} orderedIds - Array of media IDs in desired order
 */
const reorderMedia = async (contributionId, orderedIds) => {
  if (!orderedIds || !orderedIds.length) {
    return [];
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (let i = 0; i < orderedIds.length; i++) {
      await client.query(
        `
                UPDATE company_contribution_media
                SET sort_order = $1
                WHERE id = $2 AND contribution_id = $3
                `,
        [i, orderedIds[i], contributionId]
      );
    }

    await client.query('COMMIT');

    return await listByContributionId(contributionId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Delete all media for a contribution.
 */
const deleteAllByContributionId = async (contributionId) => {
  await pool.query(
    `
        DELETE FROM company_contribution_media
        WHERE contribution_id = $1
        `,
    [contributionId]
  );
};

module.exports = {
  listByContributionId,
  listByContributionIds,
  findById,
  addMedia,
  updateMedia,
  deleteMedia,
  reorderMedia,
  deleteAllByContributionId,
};
