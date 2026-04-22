const { pool } = require('../../../infrastructure/config/db');
const prisma = require('../../../infrastructure/config/prisma');

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
  const file = await prisma.file.create({
    data: {
      file_name: fileName,
      file_path: filePath,
      file_metadata: fileMetadata || null,
    },
  });
  return mapFile(file);
};

const findById = async (id) => {
  const file = await prisma.file.findUnique({ where: { id } });
  return mapFile(file);
};

const findByIds = async (ids) => {
  if (!ids || !ids.length) {
    return [];
  }

  const files = await prisma.file.findMany({
    where: {
      id: { in: ids },
    },
  });

  return files.map(mapFile);
};

/**
 * Soft delete a file by setting deleted_at timestamp.
 * Raw SQL retained to preserve single-statement "deleted_at IS NULL" semantics.
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
  const cutoffDate = new Date(Date.now() - retentionSeconds * 1000);
  const files = await prisma.file.findMany({
    where: {
      deleted_at: {
        not: null,
        lt: cutoffDate,
      },
    },
    orderBy: { deleted_at: 'asc' },
    take: limit,
  });
  return files.map(mapFile);
};

/**
 * Permanently delete a file record from the database.
 * Should only be called after the file has been removed from R2.
 */
const hardDelete = async (id) => {
  try {
    const file = await prisma.file.delete({
      where: { id },
      select: { id: true, file_name: true, file_path: true },
    });
    return file;
  } catch (error) {
    if (error && error.code === 'P2025') {
      return null;
    }
    throw error;
  }
};

/**
 * Update file metadata (e.g., to add image variant paths).
 * Raw SQL retained for atomic JSONB merge.
 */
const updateMetadata = async (id, metadata) => {
  const safeMetadata = metadata && typeof metadata === 'object' ? metadata : {};
  const result = await pool.query(
    `
        UPDATE files
        SET file_metadata = COALESCE(file_metadata, '{}'::jsonb) || $2::jsonb
        WHERE id = $1
        RETURNING id, file_name, file_path, file_metadata, uploaded_at, deleted_at
        `,
    [id, JSON.stringify(safeMetadata)]
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
