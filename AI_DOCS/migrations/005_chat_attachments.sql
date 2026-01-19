-- Migration: Add attachment support to chat messages
-- Date: 2026-01-19
-- Description: Adds attachment_file_id column to chat_messages table for file uploads

-- Add attachment column
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS attachment_file_id INT REFERENCES files(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_attachment_file_id 
ON chat_messages(attachment_file_id);

-- Verify the change
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'chat_messages' AND column_name = 'attachment_file_id';
