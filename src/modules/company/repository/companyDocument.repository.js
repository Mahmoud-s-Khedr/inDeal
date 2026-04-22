const { pool } = require('../../../infrastructure/config/db');

const run = (client) => client || pool;

const bulkCreateDocuments = async (client, documents) => {
  if (!documents || documents.length === 0) {
    return [];
  }

  const executor = run(client);
  const values = [];
  const placeholders = documents
    .map((doc, index) => {
      const baseIndex = index * 5;
      values.push(
        doc.companyId,
        doc.fileId,
        doc.docType || null,
        doc.description || null,
        doc.expiryDate || null
      );
      return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5})`;
    })
    .join(', ');

  const result = await executor.query(
    `
        INSERT INTO company_documents (company_id, file_id, doc_type, description, expiry_date)
        VALUES ${placeholders}
        RETURNING id, company_id, file_id, doc_type, title, issuer, url, description, issue_date, expiry_date, uploaded_at
        `,
    values
  );

  return result.rows;
};

const listByCompanyId = async (companyId, options = {}) => {
  const { scope = 'all' } = options;
  let scopeCondition = '';
  if (scope === 'public') {
    scopeCondition = ` AND (doc_type IS NULL OR doc_type NOT LIKE 'registration:%')`;
  } else if (scope === 'registration') {
    scopeCondition = ` AND doc_type LIKE 'registration:%'`;
  }

  const result = await pool.query(
    `
        SELECT id, company_id, file_id, doc_type, title, issuer, url, description, issue_date, expiry_date, uploaded_at
        FROM company_documents
        WHERE company_id = $1
        ${scopeCondition}
        ORDER BY uploaded_at DESC
        `,
    [companyId]
  );

  return result.rows;
};

const findById = async (id) => {
  const result = await pool.query(
    `
        SELECT id, company_id, file_id, doc_type, title, issuer, url, description, issue_date, expiry_date, uploaded_at
        FROM company_documents
        WHERE id = $1
        LIMIT 1
        `,
    [id]
  );
  return result.rows[0];
};

const createDocument = async ({
  companyId,
  fileId,
  docType,
  title,
  issuer,
  url,
  description,
  issueDate,
  expiryDate,
}) => {
  const result = await pool.query(
    `INSERT INTO company_documents 
      (company_id, file_id, doc_type, title, issuer, url, description, issue_date, expiry_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [companyId, fileId, docType, title, issuer, url, description, issueDate, expiryDate]
  );
  return result.rows[0];
};

// Helper function for updateDocument to handle fields and values
const firstDefined = (data, keys = []) => {
  for (const key of keys) {
    if (data[key] !== undefined) {
      return data[key];
    }
  }
  return undefined;
};

const mapField = (data, keys, dbColumn, fields, values, idx) => {
  const value = firstDefined(data, keys);
  if (value !== undefined) {
    fields.push(`${dbColumn} = $${idx}`);
    values.push(value);
    return true;
  }
  return false;
};

const updateDocument = async (id, data) => {
  const fields = [];
  const values = [];
  let idx = 1;

  if (mapField(data, ['fileId', 'file_id'], 'file_id', fields, values, idx)) idx++;
  if (mapField(data, ['docType', 'doc_type'], 'doc_type', fields, values, idx)) idx++;
  if (mapField(data, ['title'], 'title', fields, values, idx)) idx++;
  if (mapField(data, ['issuer'], 'issuer', fields, values, idx)) idx++;
  if (mapField(data, ['url'], 'url', fields, values, idx)) idx++;
  if (mapField(data, ['description'], 'description', fields, values, idx)) idx++;
  if (mapField(data, ['issueDate', 'issue_date'], 'issue_date', fields, values, idx)) idx++;
  if (mapField(data, ['expiryDate', 'expiry_date'], 'expiry_date', fields, values, idx)) idx++;

  if (fields.length === 0) return await findById(id); // Return existing if no updates

  values.push(id);
  const result = await pool.query(
    `UPDATE company_documents SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

const deleteDocument = async (id) => {
  const result = await pool.query(
    `
        DELETE FROM company_documents
        WHERE id = $1
        RETURNING id, company_id, file_id, doc_type, title, issuer, url, description, issue_date, expiry_date, uploaded_at
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
