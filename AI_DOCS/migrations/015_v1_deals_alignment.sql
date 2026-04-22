-- Migration: V1 deals model + request normalization alignment
-- Date: 2026-04-22

BEGIN;

-- Deal type: auction/rfq -> supply/demand
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deal_type_enum') THEN
    ALTER TYPE deal_type_enum RENAME TO deal_type_enum_old;
  END IF;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE deal_type_enum AS ENUM ('supply', 'demand');
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

ALTER TABLE deals
  ALTER COLUMN deal_type DROP DEFAULT;

ALTER TABLE deals
  ALTER COLUMN deal_type TYPE deal_type_enum
  USING (
    CASE
      WHEN deal_type::text = 'auction' THEN 'supply'::deal_type_enum
      WHEN deal_type::text = 'rfq' THEN 'demand'::deal_type_enum
      ELSE NULL
    END
  );

DROP TYPE IF EXISTS deal_type_enum_old;

-- Request status: pending/accepted/rejected/withdrawn -> +paused/canceled
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deal_request_status_enum') THEN
    ALTER TYPE deal_request_status_enum RENAME TO deal_request_status_enum_old;
  END IF;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE deal_request_status_enum AS ENUM ('pending', 'paused', 'accepted', 'rejected', 'canceled');
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

ALTER TABLE deal_requests
  ALTER COLUMN status TYPE deal_request_status_enum
  USING (
    CASE
      WHEN status::text = 'withdrawn' THEN 'canceled'::deal_request_status_enum
      WHEN status::text = 'pending' THEN 'pending'::deal_request_status_enum
      WHEN status::text = 'accepted' THEN 'accepted'::deal_request_status_enum
      WHEN status::text = 'rejected' THEN 'rejected'::deal_request_status_enum
      ELSE 'pending'::deal_request_status_enum
    END
  );

DROP TYPE IF EXISTS deal_request_status_enum_old;

DO $$ BEGIN
  CREATE TYPE deal_request_kind_enum AS ENUM ('supply', 'demand', 'rfq');
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

ALTER TABLE deal_requests
  ADD COLUMN IF NOT EXISTS request_kind deal_request_kind_enum DEFAULT 'supply',
  ADD COLUMN IF NOT EXISTS canceled_at timestamp,
  ADD COLUMN IF NOT EXISTS canceled_by_company_id int REFERENCES companies(id),
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS paused_at timestamp,
  ADD COLUMN IF NOT EXISTS paused_by_company_id int REFERENCES companies(id);

-- Deal attachments
CREATE TABLE IF NOT EXISTS deal_attachments (
  id serial PRIMARY KEY,
  deal_id int NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  file_id int NOT NULL REFERENCES files(id),
  kind varchar(20) NOT NULL CHECK (kind IN ('image', 'file')),
  sort_order int DEFAULT 0,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_attachments_unique
  ON deal_attachments(deal_id, file_id, kind);
CREATE INDEX IF NOT EXISTS idx_deal_attachments_deal_id
  ON deal_attachments(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_attachments_file_id
  ON deal_attachments(file_id);

-- Normalized request details (supply/rfq)
CREATE TABLE IF NOT EXISTS deal_request_supply_details (
  request_id int PRIMARY KEY REFERENCES deal_requests(id) ON DELETE CASCADE,
  product_service_name varchar(200) NOT NULL,
  category varchar(100) NOT NULL,
  quantity_required numeric(15,2),
  delivery_location varchar(255),
  delivery_date date,
  target_price_min numeric(15,2),
  target_price_max numeric(15,2),
  currency varchar(10),
  payment_terms_preference text,
  incoterm varchar(10),
  bulk_discount_expectation text,
  supply_type varchar(30),
  key_specifications text,
  material varchar(200),
  dimensions_size varchar(200),
  certifications_required jsonb,
  quality_level varchar(50),
  color_finish varchar(100),
  country_of_origin varchar(100),
  max_lead_time_accepted varchar(100),
  delivery_method_preference varchar(50),
  packaging_requirements text,
  special_conditions_notes text,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Normalized request details (demand)
CREATE TABLE IF NOT EXISTS deal_request_demand_details (
  request_id int PRIMARY KEY REFERENCES deal_requests(id) ON DELETE CASCADE,
  product_service_name varchar(200) NOT NULL,
  available_quantity numeric(15,2),
  offer_validity_days int,
  unit_price numeric(15,2),
  currency varchar(10),
  total_price numeric(15,2),
  volume_discount_tiers jsonb,
  moq numeric(15,2),
  availability_type varchar(30),
  quantity_in_stock numeric(15,2),
  max_produce_quantity numeric(15,2),
  stock_delivery_time varchar(100),
  production_lead_time varchar(100),
  specs_match_rfq varchar(20),
  differences_from_rfq text,
  material_offered varchar(200),
  dimensions varchar(200),
  certifications_held jsonb,
  payment_terms text,
  delivery_terms varchar(10),
  warranty_return_policy text,
  exclusivity_confidentiality text,
  additional_notes text,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deal_request_supply_details_category
  ON deal_request_supply_details(category);
CREATE INDEX IF NOT EXISTS idx_deal_request_demand_details_availability_type
  ON deal_request_demand_details(availability_type);

-- Request attachments
CREATE TABLE IF NOT EXISTS deal_request_attachments (
  id serial PRIMARY KEY,
  request_id int NOT NULL REFERENCES deal_requests(id) ON DELETE CASCADE,
  file_id int NOT NULL REFERENCES files(id),
  sort_order int DEFAULT 0,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(request_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_request_attachments_request_id
  ON deal_request_attachments(request_id);
CREATE INDEX IF NOT EXISTS idx_deal_request_attachments_file_id
  ON deal_request_attachments(file_id);

COMMIT;
