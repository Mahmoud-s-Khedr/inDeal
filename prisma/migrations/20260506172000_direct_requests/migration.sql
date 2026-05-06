ALTER TABLE deal_requests
  ALTER COLUMN deal_id DROP NOT NULL;

ALTER TABLE deal_requests
  ADD COLUMN IF NOT EXISTS target_company_id INT NULL;

ALTER TABLE deal_requests
  ADD CONSTRAINT fk_deal_requests_target_company
  FOREIGN KEY (target_company_id) REFERENCES companies(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deal_requests_applicant_type_created
  ON deal_requests (applicant_company_id, request_type, created_at);

CREATE INDEX IF NOT EXISTS idx_deal_requests_target_type_status
  ON deal_requests (target_company_id, request_type, status);
