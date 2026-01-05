-- Company Portfolio Module Migration
-- Date: 2026-01-01

-- 1) users.preferences for language/theme
ALTER TABLE users
ADD COLUMN IF NOT EXISTS preferences jsonb;

-- 2) company_contributions
CREATE TABLE IF NOT EXISTS company_contributions (
    id serial PRIMARY KEY,
    company_id int REFERENCES companies(id),
    media_file_id int REFERENCES files(id),
    type varchar(30) NOT NULL,
    title varchar(150) NOT NULL,
    description text,
    created_at timestamp DEFAULT current_timestamp,
    updated_at timestamp DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_company_contributions_company_id ON company_contributions(company_id);
CREATE INDEX IF NOT EXISTS idx_company_contributions_media_file_id ON company_contributions(media_file_id);
