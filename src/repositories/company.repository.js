const { pool } = require('../config/db');

const run = (client) => client || pool;

const createCompany = async (client, company) => {
    const executor = run(client);
    const result = await executor.query(
        `
        INSERT INTO companies (
            agent_id,
            name,
            description,
            address,
            phone,
            website,
            company_type,
            company_industry,
            manufacturing_strategy,
            contacts,
            locations
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb)
        RETURNING *
        `,
        [
            company.agentId,
            company.name,
            company.description || null,
            company.address || null,
            company.phone || null,
            company.website || null,
            company.companyType || null,
            company.companyIndustry || null,
            company.manufacturingStrategy || null,
            company.contacts ? JSON.stringify(company.contacts) : null,
            company.locations ? JSON.stringify(company.locations) : null,
        ]
    );

    return result.rows[0];
};

const findByAgentId = async (agentId) => {
    const result = await pool.query('SELECT * FROM companies WHERE agent_id = $1 LIMIT 1', [agentId]);
    return result.rows[0];
};

const findById = async (companyId) => {
    const result = await pool.query('SELECT * FROM companies WHERE id = $1 LIMIT 1', [companyId]);
    return result.rows[0];
};

const updateCompanyByAgent = async (agentId, updates) => {
    const fields = [];
    const values = [];
    let index = 1;

    Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined) return;
        let columnValue = value;
        if (key === 'contacts' || key === 'locations') {
            columnValue = value ? JSON.stringify(value) : null;
            fields.push(`${key} = $${index}::jsonb`);
        } else {
            fields.push(`${key} = $${index}`);
        }
        values.push(columnValue);
        index += 1;
    });

    if (!fields.length) {
        const existing = await findByAgentId(agentId);
        return existing;
    }

    fields.push(`updated_at = NOW()`);

    const result = await pool.query(
        `UPDATE companies SET ${fields.join(', ')} WHERE agent_id = $${index} RETURNING *`,
        [...values, agentId]
    );

    return result.rows[0];
};

module.exports = {
    createCompany,
    findByAgentId,
    findById,
    updateCompanyByAgent,
};
