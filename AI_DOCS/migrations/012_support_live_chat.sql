-- Migration: Support Live Chat (FR-SUP-004)
-- Adds live support chat infrastructure

DO $$ BEGIN
    CREATE TYPE support_chat_status_enum AS ENUM ('waiting', 'active', 'closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS support_chat_rooms (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id),
    company_id INT REFERENCES companies(id),
    assigned_admin_id INT REFERENCES users(id),
    status support_chat_status_enum DEFAULT 'waiting',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_chat_messages (
    id SERIAL PRIMARY KEY,
    room_id INT NOT NULL REFERENCES support_chat_rooms(id) ON DELETE CASCADE,
    sender_id INT NOT NULL REFERENCES users(id),
    is_from_support BOOLEAN DEFAULT FALSE,
    message_text TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_rooms_user ON support_chat_rooms(user_id);
CREATE INDEX IF NOT EXISTS idx_support_rooms_admin ON support_chat_rooms(assigned_admin_id);
CREATE INDEX IF NOT EXISTS idx_support_rooms_status ON support_chat_rooms(status);
CREATE INDEX IF NOT EXISTS idx_support_messages_room ON support_chat_messages(room_id);
