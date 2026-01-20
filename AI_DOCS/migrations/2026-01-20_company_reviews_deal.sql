-- Add deal linkage to company reviews and enforce one review per deal/company pair
ALTER TABLE company_reviews
  ADD COLUMN IF NOT EXISTS deal_id INT REFERENCES deals(id);

CREATE INDEX IF NOT EXISTS idx_company_reviews_deal_id ON company_reviews(deal_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'company_reviews_unique_deal_pair'
  ) THEN
    ALTER TABLE company_reviews
      ADD CONSTRAINT company_reviews_unique_deal_pair
      UNIQUE (deal_id, company_id, reviewer_company_id);
  END IF;
END $$;
