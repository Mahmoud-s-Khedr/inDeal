/**
 * AES-256-GCM per-room chat message encryption utility.
 *
 * Each chat room has a unique AES-256 room key stored (base64-encoded) in chat_rooms.encryption_key.
 * The room key itself is encrypted with a master key from CHAT_MASTER_KEY env var (64 hex chars = 32 bytes).
 *
 * Message format stored in DB: "enc::<base64(iv[12] + authTag[16] + ciphertext)>"
 * Legacy plaintext messages (no prefix) are returned as-is.
 */

const crypto = require('crypto');

const ENC_PREFIX = 'enc::';
const IV_LENGTH = 12; // AES-GCM recommended IV size
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // AES-256

/**
 * Derive the master key buffer from env. Throws if not set or invalid.
 */
const getMasterKey = () => {
  const hex = process.env.CHAT_MASTER_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('CHAT_MASTER_KEY must be set to a 64-character hex string (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
};

/**
 * AES-256-GCM encrypt a plaintext buffer with a given key buffer.
 * Returns Buffer: iv(12) + authTag(16) + ciphertext
 */
const aesEncrypt = (plaintext, keyBuffer) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
};

/**
 * AES-256-GCM decrypt a payload buffer (iv + authTag + ciphertext) with a given key buffer.
 */
const aesDecrypt = (payload, keyBuffer) => {
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
};

/**
 * Generate a new room AES-256 key, encrypt it with the master key, and return as base64 string.
 */
const generateRoomKey = () => {
  const masterKey = getMasterKey();
  const roomKey = crypto.randomBytes(KEY_LENGTH);
  const encrypted = aesEncrypt(roomKey, masterKey);
  return encrypted.toString('base64');
};

/**
 * Encrypt a message text using the room's encrypted key.
 * Returns a string prefixed with ENC_PREFIX.
 * Returns null if text is null/undefined.
 */
const encryptMessage = (text, encryptedRoomKey) => {
  if (text === null || text === undefined) return null;
  const masterKey = getMasterKey();
  const encryptedKeyBuf = Buffer.from(encryptedRoomKey, 'base64');
  const roomKey = aesDecrypt(encryptedKeyBuf, masterKey);
  const payload = aesEncrypt(Buffer.from(text, 'utf8'), roomKey);
  return `${ENC_PREFIX}${payload.toString('base64')}`;
};

/**
 * Decrypt a stored message text.
 * - If it starts with ENC_PREFIX, decrypt and return plaintext.
 * - Otherwise, return as-is (legacy plaintext message).
 * Returns null if stored is null/undefined.
 */
const decryptMessage = (stored, encryptedRoomKey) => {
  if (stored === null || stored === undefined) return null;
  if (!stored.startsWith(ENC_PREFIX)) return stored; // legacy plaintext
  try {
    const masterKey = getMasterKey();
    const encryptedKeyBuf = Buffer.from(encryptedRoomKey, 'base64');
    const roomKey = aesDecrypt(encryptedKeyBuf, masterKey);
    const payload = Buffer.from(stored.slice(ENC_PREFIX.length), 'base64');
    return aesDecrypt(payload, roomKey).toString('utf8');
  } catch {
    return null; // decryption failed, return null
  }
};

module.exports = {
  generateRoomKey,
  encryptMessage,
  decryptMessage,
};
