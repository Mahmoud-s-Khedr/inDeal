-- Align persisted deal request detail values to the SRS-backed wire contract.

UPDATE "deal_request_supply_details"
SET "supply_type" = CASE "supply_type"
  WHEN 'inStock' THEN 'in stock'
  WHEN 'makeToOrder' THEN 'make to order'
  WHEN 'either' THEN 'either'
  ELSE "supply_type"
END
WHERE "supply_type" IS NOT NULL;

UPDATE "deal_request_supply_details"
SET "delivery_method_preference" = CASE "delivery_method_preference"
  WHEN 'supplierDelivers' THEN 'supplier delivers'
  WHEN 'buyerCollects' THEN 'buyer collects'
  WHEN 'thirdParty' THEN 'third party'
  ELSE "delivery_method_preference"
END
WHERE "delivery_method_preference" IS NOT NULL;

UPDATE "deal_request_supply_details"
SET "quality_level" = CASE "quality_level"
  WHEN 'standard' THEN 'standard'
  WHEN 'industrialGuide' THEN 'industrial guide'
  WHEN 'foodGrade' THEN 'food grade'
  WHEN 'pharmaceuticalGrade' THEN 'pharmaceutical grade'
  WHEN 'exportQuality' THEN 'export quality'
  ELSE "quality_level"
END
WHERE "quality_level" IS NOT NULL;

UPDATE "deal_request_demand_details"
SET "availability_type" = CASE "availability_type"
  WHEN 'inStock' THEN 'in stock'
  WHEN 'assembleToOrder' THEN 'assemble to order'
  WHEN 'makeToOrder' THEN 'make to order'
  WHEN 'engineerToOrder' THEN 'engineering to order'
  WHEN 'engineeringToOrder' THEN 'engineering to order'
  WHEN 'mixed' THEN 'mixed'
  ELSE "availability_type"
END
WHERE "availability_type" IS NOT NULL;

UPDATE "deal_request_demand_details"
SET "specs_match_rfq" = CASE "specs_match_rfq"
  WHEN 'yes' THEN 'exact'
  WHEN 'partial' THEN 'partial'
  WHEN 'no' THEN NULL
  ELSE "specs_match_rfq"
END
WHERE "specs_match_rfq" IS NOT NULL;
