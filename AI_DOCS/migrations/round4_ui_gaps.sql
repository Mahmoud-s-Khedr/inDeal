-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'system', 'deal', 'chat', 'contribution', etc.
    title VARCHAR(200) NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    metadata JSONB, -- For linking to resources (e.g. { dealId: 1 })
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- Add Tags to Contribution Details (JSONB)
-- We don't need a column change since it's in JSONB, but we might want to backfill or just document it.
-- Actually, let's keep it in the JSONB 'details' column as 'tags'. 
-- No schema change needed for contributions, just validation/service update.
