-- Migration: Add support for multiple media per contribution
-- Date: 2026-01-06
-- Feature: Multiple media attachments for company contributions

-- Junction table for multiple media per contribution
CREATE TABLE company_contribution_media (
    id SERIAL PRIMARY KEY,
    contribution_id INT NOT NULL REFERENCES company_contributions(id) ON DELETE CASCADE,
    file_id INT REFERENCES files(id),
    media_type VARCHAR(30) NOT NULL,  -- image, video, file, url
    media_url VARCHAR(255),           -- for external URLs
    sort_order INT DEFAULT 0,
    caption VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient queries
CREATE INDEX idx_contribution_media_contribution_id ON company_contribution_media(contribution_id);
CREATE INDEX idx_contribution_media_file_id ON company_contribution_media(file_id);

-- Migrate existing single-media contributions to new junction table
-- This preserves backward compatibility
INSERT INTO company_contribution_media (contribution_id, file_id, media_type, media_url, sort_order)
SELECT id, media_file_id, media_type, media_url, 0
FROM company_contributions
WHERE media_file_id IS NOT NULL OR media_url IS NOT NULL;

-- Note: The original columns (media_file_id, media_type, media_url) on company_contributions
-- are kept for backward compatibility. They can be dropped in a future migration after
-- frontend is updated to use the new media array API.
--
-- To drop in future:
-- ALTER TABLE company_contributions DROP COLUMN media_file_id;
-- ALTER TABLE company_contributions DROP COLUMN media_type;
-- ALTER TABLE company_contributions DROP COLUMN media_url;
