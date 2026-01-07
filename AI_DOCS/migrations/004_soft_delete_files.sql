-- Migration: Add soft delete support to files table
-- Date: 2026-01-06
-- Feature: Orphan cleanup for R2 storage

-- Add soft delete column
ALTER TABLE files ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Index for cleanup job queries (only index soft-deleted files)
CREATE INDEX IF NOT EXISTS idx_files_deleted_at ON files(deleted_at) WHERE deleted_at IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN files.deleted_at IS 'Soft delete timestamp. NULL = active, populated = pending permanent deletion';
