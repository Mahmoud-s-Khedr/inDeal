-- Email Logs Table for tracking sent emails
-- This migration adds a table to track email sending status and errors

CREATE TABLE IF NOT EXISTS email_logs (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(100),
    recipient VARCHAR(255) NOT NULL,
    template VARCHAR(50),
    subject VARCHAR(255),
    status VARCHAR(20) DEFAULT 'queued',
    error TEXT,
    attempts INT DEFAULT 0,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for querying by recipient
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient);

-- Index for querying by status
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);

-- Index for querying by template
CREATE INDEX IF NOT EXISTS idx_email_logs_template ON email_logs(template);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);
