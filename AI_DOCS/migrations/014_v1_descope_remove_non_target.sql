-- Migration: V1 de-scope hard removal (non-v1-target modules)
-- Date: 2026-04-22
--
-- Pre-run safeguards (required):
-- 1) Take a full database backup snapshot before running this migration.
-- 2) Validate that no runtime code references the dropped objects.
-- 3) Run during a maintenance window due to destructive changes.

BEGIN;

-- Drop module tables first (order is dependency-safe with CASCADE)
DROP TABLE IF EXISTS ad_click_events CASCADE;
DROP TABLE IF EXISTS ad_analytics_daily CASCADE;
DROP TABLE IF EXISTS advertisements CASCADE;

DROP TABLE IF EXISTS support_ticket_responses CASCADE;
DROP TABLE IF EXISTS support_tickets CASCADE;

DROP TABLE IF EXISTS support_chat_messages CASCADE;
DROP TABLE IF EXISTS support_chat_rooms CASCADE;

DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS user_device_tokens CASCADE;

DROP TABLE IF EXISTS company_pending_updates CASCADE;
DROP TABLE IF EXISTS company_agents CASCADE;

-- Drop orphaned enum types tied to removed modules
DROP TYPE IF EXISTS ad_status_enum;
DROP TYPE IF EXISTS ad_location_enum;
DROP TYPE IF EXISTS ad_type_enum;
DROP TYPE IF EXISTS support_ticket_status_enum;
DROP TYPE IF EXISTS support_ticket_priority_enum;
DROP TYPE IF EXISTS support_chat_status_enum;

COMMIT;
