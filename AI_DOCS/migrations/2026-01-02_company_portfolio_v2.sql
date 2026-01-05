-- Company Portfolio Module Migration (v2)
-- Date: 2026-01-02
-- Purpose: Add certificate metadata + richer contribution media/details (additive, non-breaking)

-- 1) Certificates metadata (stored on company_documents)
ALTER TABLE company_documents
ADD COLUMN IF NOT EXISTS title varchar(150),
ADD COLUMN IF NOT EXISTS issuer varchar(150),
ADD COLUMN IF NOT EXISTS url varchar(255);

-- 2) Contributions richer media + type-specific fields
ALTER TABLE company_contributions
ADD COLUMN IF NOT EXISTS media_type varchar(30),
ADD COLUMN IF NOT EXISTS media_url varchar(255),
ADD COLUMN IF NOT EXISTS details jsonb;

-- Helpful indexes (optional)
CREATE INDEX IF NOT EXISTS idx_company_contributions_media_type ON company_contributions(media_type);
CREATE INDEX IF NOT EXISTS idx_company_contributions_details ON company_contributions USING GIN (details);
