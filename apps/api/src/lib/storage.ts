// Dosya saklama: dekontlar için.
// R2 credential'ları varsa S3 API ile R2'ye yazar, yoksa lokal uploads/ klasörüne yazar.
// Faz 1: lokal yeterli. Üretimde R2 önerilir (kalıcı + CDN).

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';

const LOCAL_UPLOADS_DIR = join(process.cwd(), 'uploads');

export interface UploadResult {
  url: string; // public erişilebilir URL veya /uploads/xxx
  storage: 'local' | 'r2';
  key: string;
}

function isR2Configured(): boolean {
  return Boolean(
    config.R2_ACCOUNT_ID &&
      config.R2_ACCESS_KEY_ID &&
      config.R2_SECRET_ACCESS_KEY &&
      config.R2_BUCKET,
  );
}

export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  contentType: string,
): Promise<UploadResult> {
  const ext = extractExt(originalName, contentType);
  const key = `receipts/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${ext}`;

  if (isR2Configured()) {
    return uploadToR2(buffer, key, contentType);
  }
  return uploadToLocal(buffer, key);
}

async function uploadToLocal(buffer: Buffer, key: string): Promise<UploadResult> {
  const fullPath = join(LOCAL_UPLOADS_DIR, key);
  const dir = fullPath.substring(0, fullPath.lastIndexOf(process.platform === 'win32' ? '\\' : '/'));
  await mkdir(dir, { recursive: true });
  await writeFile(fullPath, buffer);
  return {
    storage: 'local',
    key,
    url: `${config.PUBLIC_API_URL}/uploads/${key}`,
  };
}

async function uploadToR2(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<UploadResult> {
  // R2 desteği şimdilik manuel S3 imzalı PUT - Faz 1'de lokal yeterli olduğu için skip.
  // Üretimde @aws-sdk/client-s3 eklenip burası dolacak.
  throw new Error(
    'R2 upload henüz aktif değil. R2 credential\'larını sıfırla veya Faz 1.5\'i bekle.',
  );
}

export function getLocalUploadsDir(): string {
  return LOCAL_UPLOADS_DIR;
}

function extractExt(name: string, contentType: string): string {
  const dot = name.lastIndexOf('.');
  if (dot >= 0 && dot < name.length - 1 && name.length - dot <= 6) {
    return name.substring(dot).toLowerCase();
  }
  // Content type fallback
  if (contentType.includes('jpeg')) return '.jpg';
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('pdf')) return '.pdf';
  if (contentType.includes('webp')) return '.webp';
  return '';
}
