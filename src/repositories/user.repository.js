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

module.exports = {
    createUser,
    findByEmail,
    findByUsername,
};
