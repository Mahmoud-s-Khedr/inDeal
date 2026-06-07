-- Normalize legacy deal status to the SRS-supported lifecycle.
UPDATE "deals"
SET "status" = 'open',
    "updated_at" = NOW()
WHERE "status" = 'negotiating';

-- Align request detail storage with the SRS-backed API contract.
ALTER TABLE "deal_request_supply_details"
ADD COLUMN "color_finish" VARCHAR(200);

ALTER TABLE "deal_request_supply_details"
DROP COLUMN "quality_level_other_text";

ALTER TABLE "deal_request_demand_details"
ADD COLUMN "stock_delivery_time" VARCHAR(100);

-- Collapse duplicate active in-supply requests before adding unique protection.
WITH ranked_in_supply AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "deal_id", "applicant_company_id"
      ORDER BY
        CASE "status"
          WHEN 'accepted' THEN 1
          WHEN 'pending' THEN 2
          WHEN 'paused' THEN 3
          ELSE 4
        END,
        "updated_at" DESC,
        "id" DESC
    ) AS "rank_order"
  FROM "deal_requests"
  WHERE "request_type" = 'inSupply'
    AND "deal_id" IS NOT NULL
    AND "status" IN ('pending', 'paused', 'accepted')
)
UPDATE "deal_requests" AS "r"
SET "status" = 'canceled',
    "canceled_at" = COALESCE("r"."canceled_at", NOW()),
    "canceled_by_company_id" = COALESCE("r"."canceled_by_company_id", "r"."applicant_company_id"),
    "cancel_reason" = COALESCE(
      "r"."cancel_reason",
      'Auto-canceled during deals invariant migration: duplicate active in-supply request'
    ),
    "updated_at" = NOW()
FROM ranked_in_supply
WHERE "r"."id" = ranked_in_supply."id"
  AND ranked_in_supply."rank_order" > 1;

-- Collapse duplicate active direct requests before adding unique protection.
WITH ranked_direct AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "applicant_company_id", "target_company_id"
      ORDER BY
        CASE "status"
          WHEN 'accepted' THEN 1
          WHEN 'pending' THEN 2
          WHEN 'paused' THEN 3
          ELSE 4
        END,
        "updated_at" DESC,
        "id" DESC
    ) AS "rank_order"
  FROM "deal_requests"
  WHERE "request_type" = 'direct'
    AND "deal_id" IS NULL
    AND "target_company_id" IS NOT NULL
    AND "status" IN ('pending', 'paused', 'accepted')
)
UPDATE "deal_requests" AS "r"
SET "status" = 'canceled',
    "canceled_at" = COALESCE("r"."canceled_at", NOW()),
    "canceled_by_company_id" = COALESCE("r"."canceled_by_company_id", "r"."applicant_company_id"),
    "cancel_reason" = COALESCE(
      "r"."cancel_reason",
      'Auto-canceled during deals invariant migration: duplicate active direct request'
    ),
    "updated_at" = NOW()
FROM ranked_direct
WHERE "r"."id" = ranked_direct."id"
  AND ranked_direct."rank_order" > 1;

CREATE UNIQUE INDEX "uq_deal_requests_active_in_supply"
ON "deal_requests" ("deal_id", "applicant_company_id")
WHERE "request_type" = 'inSupply'
  AND "status" IN ('pending', 'paused', 'accepted');

CREATE UNIQUE INDEX "uq_deal_requests_active_direct"
ON "deal_requests" ("applicant_company_id", "target_company_id")
WHERE "request_type" = 'direct'
  AND "deal_id" IS NULL
  AND "status" IN ('pending', 'paused', 'accepted');
