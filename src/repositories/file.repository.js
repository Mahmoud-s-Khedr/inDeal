const { pool } = require('../config/db');

const mapFile = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    fileName: row.file_name,
    filePath: row.file_path,
    fileMetadata: row.file_metadata,
    uploadedAt: row.uploaded_at,
    deletedAt: row.deleted_at || null,
  };
};

const createFile = async ({ fileName, filePath, fileMetadata }) => {
  const result = await pool.query(
    `
        INSERT INTO files (file_name, file_path, file_metadata)
        VALUES ($1, $2, $3)
        RETURNING id, file_name, file_path, file_metadata, uploaded_at, deleted_at
        `,
    [fileName, filePath, fileMetadata || null]
  );
  return mapFile(result.rows[0]);
};

const findById = async (id) => {
  const result = await pool.query(
    `
        SELECT id, file_name, file_path, file_metadata, uploaded_at, deleted_at
        FROM files
        WHERE id = $1
        `,
    [id]
  );
  return mapFile(result.rows[0]);
};

const findByIds = async (ids) => {
  if (!ids || !ids.length) {
    return [];
  }

  const result = await pool.query(
    `
        SELECT id, file_name, file_path, file_metadata, uploaded_at, deleted_at
        FROM files
        WHERE id = ANY($1::int[])
        `,
    [ids]
  );

  return result.rows.map(mapFile);
};

/**
 * Soft delete a file by setting deleted_at timestamp.
 */
const softDelete = async (id) => {
  const result = await pool.query(
    `
        UPDATE files
        SET deleted_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, file_name, file_path, file_metadata, uploaded_at, deleted_at
        `,
    [id]
  );
  return mapFile(result.rows[0]);
};

/**
 * Find files that were soft-deleted before a given retention period.
 * These are candidates for permanent deletion from R2.
 * @param {number} retentionSeconds - Files deleted more than this many seconds ago
 * @param {number} limit - Max number of files to return
 */
const findOrphanedFiles = async (retentionSeconds, limit = 100) => {
  const result = await pool.query(
    `
        SELECT id, file_name, file_path, file_metadata, uploaded_at, deleted_at
        FROM files
        WHERE deleted_at IS NOT NULL
          AND deleted_at < NOW() - INTERVAL '1 second' * $1
        ORDER BY deleted_at ASC
        LIMIT $2
        `,
    [retentionSeconds, limit]
  );
  return result.rows.map(mapFile);
};

/**
 * Permanently delete a file record from the database.
 * Should only be called after the file has been removed from R2.
 */
const hardDelete = async (id) => {
  const result = await pool.query(
    `
        DELETE FROM files
        WHERE id = $1
        RETURNING id, file_name, file_path
        `,
    [id]
  );
  return result.rows[0] || null;
};

/**
 * Update file metadata (e.g., to add image variant paths).
 */
const updateMetadata = async (id, metadata) => {
  const result = await pool.query(
    `
        UPDATE files
        SET file_metadata = COALESCE(file_metadata, '{}'::jsonb) || $2::jsonb
        WHERE id = $1
        RETURNING id, file_name, file_path, file_metadata, uploaded_at, deleted_at
        `,
    [id, JSON.stringify(metadata)]
  );
  return mapFile(result.rows[0]);
};

module.exports = {
  createFile,
  findById,
  findByIds,
  softDelete,
  findOrphanedFiles,
  hardDelete,
  updateMetadata,
};
