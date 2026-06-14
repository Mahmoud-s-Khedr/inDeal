-- Normalize demand request detail storage to the revised API contract.
ALTER TABLE "deal_request_demand_details"
ADD COLUMN "warranty_policy" TEXT,
ADD COLUMN "return_policy" TEXT,
ADD COLUMN "certifications_held_varchar" VARCHAR(1000);

UPDATE "deal_request_demand_details"
SET "availability_type" = CASE "availability_type"
  WHEN 'in stock' THEN 'inStock'
  WHEN 'assemble to order' THEN 'assembleToOrder'
  WHEN 'make to order' THEN 'makeToOrder'
  WHEN 'engineering to order' THEN 'engineeringToOrder'
  ELSE "availability_type"
END
WHERE "availability_type" IS NOT NULL;

UPDATE "deal_request_demand_details"
SET "specs_match_rfq" = CASE "specs_match_rfq"
  WHEN 'yes' THEN 'exact'
  WHEN 'no' THEN NULL
  ELSE "specs_match_rfq"
END
WHERE "specs_match_rfq" IS NOT NULL;

UPDATE "deal_request_demand_details"
SET "warranty_policy" = "warranty_return_policy"
WHERE "warranty_return_policy" IS NOT NULL;

UPDATE "deal_request_demand_details"
SET "certifications_held_varchar" = CASE
  WHEN "certifications_held" IS NULL THEN NULL
  WHEN jsonb_typeof("certifications_held") = 'array' THEN (
    SELECT string_agg(value, ', ' ORDER BY ordinality)
    FROM jsonb_array_elements_text("certifications_held") WITH ORDINALITY AS elems(value, ordinality)
  )
  WHEN jsonb_typeof("certifications_held") = 'string' THEN trim(both '"' from "certifications_held"::text)
  ELSE "certifications_held"::text
END;

ALTER TABLE "deal_request_demand_details"
DROP COLUMN "certifications_held";

ALTER TABLE "deal_request_demand_details"
RENAME COLUMN "certifications_held_varchar" TO "certifications_held";

ALTER TABLE "deal_request_demand_details"
DROP COLUMN "stock_delivery_time",
DROP COLUMN "warranty_return_policy";
