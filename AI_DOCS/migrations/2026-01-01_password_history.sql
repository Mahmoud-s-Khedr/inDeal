-- Password History Migration
-- Date: 2026-01-01

-- Stores old password hashes so we can prevent reusing recent passwords.

CREATE TABLE IF NOT EXISTS user_password_history (
    id serial PRIMARY KEY,
    user_id int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_hash varchar(255) NOT NULL,
    created_at timestamp DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_user_password_history_user_id_created_at
    ON user_password_history(user_id, created_at DESC);
