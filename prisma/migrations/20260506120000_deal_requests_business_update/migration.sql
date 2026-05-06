ALTER TABLE deal_requests
ADD COLUMN IF NOT EXISTS request_type VARCHAR(16) NOT NULL DEFAULT 'inSupply';

ALTER TABLE deal_request_demand_details
DROP COLUMN IF EXISTS stock_delivery_time;

ALTER TABLE deal_request_supply_details
DROP COLUMN IF EXISTS color_finish,
ADD COLUMN IF NOT EXISTS quality_level_other_text VARCHAR(255);
