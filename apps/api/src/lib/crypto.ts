import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';
import { config } from '../config.js';

// AES-256-GCM ile string şifreleme.
// Format: base64(iv || ciphertext || authTag)
// iv: 12 byte, authTag: 16 byte

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  return Buffer.from(config.ENCRYPTION_KEY, 'hex');
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, getKey(), iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, ciphertext, authTag]).toString('base64');
}

export function decrypt(encoded: string): string {
  const data = Buffer.from(encoded, 'base64');

  if (data.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('Geçersiz şifreli veri (çok kısa)');
  }

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(data.length - TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH, data.length - TAG_LENGTH);

  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}

// Webhook secret oluşturucu (URL-safe hex)
export function generateWebhookSecret(): string {
  return randomBytes(24).toString('hex');
}
