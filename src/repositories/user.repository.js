const { pool } = require('../config/db');

const run = (client) => client || pool;

const createUser = async (client, user) => {
    const executor = run(client);
    const result = await executor.query(
        `
        INSERT INTO users (
            username,
            email,
            password_hash,
            first_name,
            last_name,
            job_title
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, username, email, first_name, last_name, job_title, role, created_at, updated_at
        `,
        [
            user.username,
            user.email,
            user.passwordHash,
            user.firstName,
            user.lastName,
            user.jobTitle || null,
        ]
    );

    return result.rows[0];
};

const findByEmail = async (email) => {
    const result = await pool.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email]);
    return result.rows[0];
};

const findByUsername = async (username) => {
    const result = await pool.query('SELECT * FROM users WHERE username = $1 LIMIT 1', [username]);
    return result.rows[0];
};

const findById = async (id) => {
    const result = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
    return result.rows[0];
};

const updateById = async (userId, updates) => {
    const fields = [];
    const values = [];
    let index = 1;

    Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined) return;

        if (key === 'preferences') {
            fields.push(`${key} = $${index}::jsonb`);
            values.push(value ? JSON.stringify(value) : null);
        } else {
            fields.push(`${key} = $${index}`);
            values.push(value);
        }

        index += 1;
    });

    if (!fields.length) {
        return await findById(userId);
    }

    fields.push('updated_at = NOW()');

    const result = await pool.query(
        `
        UPDATE users
        SET ${fields.join(', ')}
        WHERE id = $${index}
        RETURNING *
        `,
        [...values, userId]
    );

    return result.rows[0] || null;
};

const updatePasswordHash = async (userId, passwordHash, client) => {
    const executor = run(client);
    const result = await executor.query(
        `
        UPDATE users
        SET password_hash = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [userId, passwordHash]
    );
    return result.rows[0];
};

const listRecentPasswordHistoryHashes = async (userId, limit = 2, client) => {
    const executor = run(client);
    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 2;
    const result = await executor.query(
        `
        SELECT password_hash
        FROM user_password_history
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        `,
        [userId, safeLimit]
    );
    return result.rows.map((r) => r.password_hash);
};

const insertPasswordHistory = async (userId, passwordHash, client) => {
    const executor = run(client);
    const result = await executor.query(
        `
        INSERT INTO user_password_history (user_id, password_hash)
        VALUES ($1, $2)
        RETURNING id, user_id, password_hash, created_at
        `,
        [userId, passwordHash]
    );
    return result.rows[0];
};

const prunePasswordHistory = async (userId, keep = 10, client) => {
    const executor = run(client);
    const safeKeep = Number.isInteger(keep) && keep >= 0 ? keep : 10;

    await executor.query(
        `
        DELETE FROM user_password_history
        WHERE user_id = $1
          AND id NOT IN (
              SELECT id
              FROM user_password_history
              WHERE user_id = $1
              ORDER BY created_at DESC
              LIMIT $2
          )
        `,
        [userId, safeKeep]
    );
};

const updateStatus = async (userId, status) => {
    const result = await pool.query(
        `
        UPDATE users
        SET status = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [userId, status]
    );
    return result.rows[0];
};

module.exports = {
    createUser,
    findByEmail,
    findByUsername,
    findById,
    updateById,
    updatePasswordHash,
    listRecentPasswordHistoryHashes,
    insertPasswordHistory,
    prunePasswordHistory,
    updateStatus,
};
