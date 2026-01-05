const { pool } = require('../config/db');

const run = (client) => client || pool;

const bulkCreateDocuments = async (client, documents) => {
    if (!documents || documents.length === 0) {
        return [];
    }

    const executor = run(client);
    const values = [];
    const placeholders = documents
        .map((doc, index) => {
            const baseIndex = index * 4;
            values.push(doc.companyId, doc.fileId, doc.docType || null, doc.description || null);
            return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4})`;
        })
        .join(', ');

    const result = await executor.query(
        `
        INSERT INTO company_documents (company_id, file_id, doc_type, description)
        VALUES ${placeholders}
        RETURNING id, company_id, file_id, doc_type, title, issuer, url, description, uploaded_at
        `,
        values
    );

    return result.rows;
};

const listByCompanyId = async (companyId) => {
    const result = await pool.query(
        `
        SELECT id, company_id, file_id, doc_type, title, issuer, url, description, uploaded_at
        FROM company_documents
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
        SELECT id, company_id, file_id, doc_type, title, issuer, url, description, uploaded_at
        FROM company_documents
        WHERE id = $1
        LIMIT 1
        `,
        [id]
    );
    return result.rows[0];
};

const createDocument = async ({ companyId, fileId, docType, title, issuer, url, description }) => {
    const result = await pool.query(
        `
        INSERT INTO company_documents (company_id, file_id, doc_type, title, issuer, url, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, company_id, file_id, doc_type, title, issuer, url, description, uploaded_at
        `,
        [companyId, fileId || null, docType || null, title || null, issuer || null, url || null, description || null]
    );
    return result.rows[0];
};

const updateDocument = async (id, updates) => {
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
        UPDATE company_documents
        SET ${fields.join(', ')}
        WHERE id = $${index}
        RETURNING id, company_id, file_id, doc_type, title, issuer, url, description, uploaded_at
        `,
        [...values, id]
    );

    return result.rows[0] || null;
};

const deleteDocument = async (id) => {
    const result = await pool.query(
        `
        DELETE FROM company_documents
        WHERE id = $1
        RETURNING id, company_id, file_id, doc_type, title, issuer, url, description, uploaded_at
        `,
        [id]
    );
    return result.rows[0] || null;
};

module.exports = {
    bulkCreateDocuments,
    listByCompanyId,
    findById,
    createDocument,
    updateDocument,
    deleteDocument,
};
