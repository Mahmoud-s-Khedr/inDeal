const { pool } = require('../config/db');

const mapFile = (row) => {
    if (!row) return null;
    return {
        id: row.id,
        fileName: row.file_name,
        filePath: row.file_path,
        fileMetadata: row.file_metadata,
        uploadedAt: row.uploaded_at,
    };
};

const createFile = async ({ fileName, filePath, fileMetadata }) => {
    const result = await pool.query(
        `
        INSERT INTO files (file_name, file_path, file_metadata)
        VALUES ($1, $2, $3)
        RETURNING id, file_name, file_path, file_metadata, uploaded_at
        `,
        [fileName, filePath, fileMetadata || null]
    );
    return mapFile(result.rows[0]);
};

const findById = async (id) => {
    const result = await pool.query(
        `
        SELECT id, file_name, file_path, file_metadata, uploaded_at
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
        SELECT id, file_name, file_path, file_metadata, uploaded_at
        FROM files
        WHERE id = ANY($1::int[])
        `,
        [ids]
    );

    return result.rows.map(mapFile);
};

module.exports = {
    createFile,
    findById,
    findByIds,
};
