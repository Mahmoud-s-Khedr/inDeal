-- Remove contribution media along with its parent contribution. This keeps
-- contribution deletion atomic while retaining the referenced file records.
ALTER TABLE "company_contribution_media"
  DROP CONSTRAINT "company_contribution_media_contribution_id_fkey";

ALTER TABLE "company_contribution_media"
  ADD CONSTRAINT "company_contribution_media_contribution_id_fkey"
  FOREIGN KEY ("contribution_id") REFERENCES "company_contributions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
