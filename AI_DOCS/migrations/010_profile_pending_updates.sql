-- Migration: Profile Pending Updates
-- Adds infrastructure for profile update review workflow (FR-ADMIN-003)

-- Add new company state for pending updates
DO $$ BEGIN
    ALTER TYPE company_state_enum ADD VALUE IF NOT EXISTS 'pendingUpdate';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Table to store pending profile updates
CREATE TABLE IF NOT EXISTS company_pending_updates (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    pending_data JSONB NOT NULL, -- Snapshot of requested changes
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    reviewed_by INT REFERENCES users(id),
    reviewed_at TIMESTAMP,
    rejection_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_pending_updates_company ON company_pending_updates(company_id);
CREATE INDEX IF NOT EXISTS idx_pending_updates_status ON company_pending_updates(status);
