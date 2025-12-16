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
        RETURNING id, company_id, file_id, doc_type, description, uploaded_at
        `,
        values
    );

    return result.rows;
};

const listByCompanyId = async (companyId) => {
    const result = await pool.query(
        `
        SELECT id, company_id, file_id, doc_type, description, uploaded_at
        FROM company_documents
        WHERE company_id = $1
        ORDER BY uploaded_at DESC
        `,
        [companyId]
    );

    return result.rows;
};

module.exports = {
    bulkCreateDocuments,
    listByCompanyId,
};
