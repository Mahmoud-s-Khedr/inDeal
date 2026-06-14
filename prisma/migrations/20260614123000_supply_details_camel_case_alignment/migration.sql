-- Normalize supply request detail storage to the camelCase API contract.
ALTER TABLE "deal_request_supply_details"
ADD COLUMN "target_price" DECIMAL(14,2),
ADD COLUMN "other_quality_level_description" VARCHAR(255);

UPDATE "deal_request_supply_details"
SET "category" = CASE "category"
  WHEN 'packingAndContainers' THEN 'packing'
  WHEN 'constructionMaterialsAndServices' THEN 'constructionMaterials'
  ELSE "category"
END
WHERE "category" IS NOT NULL;

UPDATE "deal_request_supply_details"
SET "supply_type" = CASE "supply_type"
  WHEN 'in stock' THEN 'inStock'
  WHEN 'assemble to order' THEN 'assembleToOrder'
  WHEN 'make to order' THEN 'makeToOrder'
  WHEN 'engineering to order' THEN 'engineeringToOrder'
  ELSE "supply_type"
END
WHERE "supply_type" IS NOT NULL;

UPDATE "deal_request_supply_details"
SET "quality_level" = CASE "quality_level"
  WHEN 'industrial guide' THEN 'industrialGuide'
  WHEN 'food grade' THEN 'foodGrade'
  WHEN 'pharmaceutical grade' THEN 'pharmaceuticalGrade'
  WHEN 'export quality' THEN 'exportQuality'
  ELSE "quality_level"
END
WHERE "quality_level" IS NOT NULL;

UPDATE "deal_request_supply_details"
SET "delivery_method_preference" = CASE "delivery_method_preference"
  WHEN 'supplier delivers' THEN 'supplierDelivers'
  WHEN 'buyer collects' THEN 'buyerCollects'
  WHEN 'third party' THEN 'thirdParty'
  ELSE "delivery_method_preference"
END
WHERE "delivery_method_preference" IS NOT NULL;

UPDATE "deal_request_demand_details"
SET "availability_type" = CASE "availability_type"
  WHEN 'in stock' THEN 'inStock'
  WHEN 'assemble to order' THEN 'assembleToOrder'
  WHEN 'make to order' THEN 'makeToOrder'
  WHEN 'engineering to order' THEN 'engineeringToOrder'
  ELSE "availability_type"
END
WHERE "availability_type" IS NOT NULL;

UPDATE "deal_request_supply_details"
SET "target_price" = COALESCE("target_price_max", "target_price_min")
WHERE "target_price_min" IS NOT NULL
   OR "target_price_max" IS NOT NULL;

ALTER TABLE "deal_request_supply_details"
ALTER COLUMN "certifications_required" TYPE VARCHAR(1000)
USING (
  CASE
    WHEN "certifications_required" IS NULL THEN NULL
    WHEN jsonb_typeof("certifications_required") = 'array' THEN (
      SELECT string_agg(value, ', ' ORDER BY ordinality)
      FROM jsonb_array_elements_text("certifications_required") WITH ORDINALITY AS elems(value, ordinality)
    )
    WHEN jsonb_typeof("certifications_required") = 'string' THEN trim(both '"' from "certifications_required"::text)
    ELSE "certifications_required"::text
  END
);

ALTER TABLE "deal_request_supply_details"
DROP COLUMN "target_price_min",
DROP COLUMN "target_price_max",
DROP COLUMN "color_finish",
DROP COLUMN "country_of_origin";
