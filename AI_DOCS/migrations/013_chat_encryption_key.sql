-- Migration: Add per-room AES-256-GCM encryption key to chat_rooms
-- Each room gets a unique encryption key (AES-256, master-key-wrapped, base64) at creation time.
-- Message text is stored as "enc::<base64(iv+authTag+ciphertext)>".
-- Existing rows will have NULL encryption_key; their messages remain plaintext and are returned as-is.

ALTER TABLE chat_rooms
  ADD COLUMN IF NOT EXISTS encryption_key TEXT;
