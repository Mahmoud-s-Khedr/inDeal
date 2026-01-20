-- Notification System Performance Indexes
-- This migration adds indexes to improve query performance for large notification volumes

-- Index for listing notifications by user (most common query)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- Composite index for unread notification count (filtered index)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE is_read = false;

-- Index for ordering by created_at (descending for recent first)
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Composite index for cleanup job (retention policy queries)
CREATE INDEX IF NOT EXISTS idx_notifications_read_created ON notifications(is_read, created_at);
