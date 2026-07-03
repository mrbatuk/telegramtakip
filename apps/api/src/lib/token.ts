// Doğrulama ve şifre sıfırlama linkleri için token yardımcısı.
// URL'ye ham token gider, DB'de SHA-256 hash'i saklanır.

import { createHash, randomBytes } from 'node:crypto';

export interface GeneratedToken {
  raw: string; // URL'de kullanılacak
  hash: string; // DB'de saklanacak
}

export function generateToken(length = 32): GeneratedToken {
  const raw = randomBytes(length).toString('base64url');
  const hash = hashToken(raw);
  return { raw, hash };
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
