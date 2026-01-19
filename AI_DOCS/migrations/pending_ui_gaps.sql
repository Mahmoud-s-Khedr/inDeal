-- Migration: Add company_agents table and document dates
-- Date: 2026-01-19

-- 1. Create company_agents table
CREATE TABLE IF NOT EXISTS company_agents (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member', -- owner, admin, member
    status VARCHAR(20) DEFAULT 'active', -- active, invited
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, user_id)
);

-- 2. Add columns to company_documents and companies
ALTER TABLE company_documents 
ADD COLUMN IF NOT EXISTS issue_date DATE,
ADD COLUMN IF NOT EXISTS expiry_date DATE;

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS email VARCHAR(100),
ADD COLUMN IF NOT EXISTS contacts JSONB,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS social_media_links JSONB;

-- 3. Backfill company_agents from existing owner logic (optional but good for consistency)
-- Insert existing single-agent owners into the new table
INSERT INTO company_agents (company_id, user_id, role, status)
SELECT id, agent_id, 'owner', 'active'
FROM companies
WHERE agent_id IS NOT NULL
ON CONFLICT (company_id, user_id) DO NOTHING;
