// Sevnur'a test DM gönder ve gerçek Telegram hatasını gör
import { config as dotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createDecipheriv } from 'node:crypto';
dotenv({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '.env') });

function decrypt(encoded: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
  const data = Buffer.from(encoded, 'base64');
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(data.length - 16);
  const ciphertext = data.subarray(12, data.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

async function main() {
  const { prisma } = await import('@tt/db');
  const USER_ID = 8687292744;

  const bot = await prisma.bot.findFirst();
  if (!bot) throw new Error('bot yok');
  const token = decrypt(bot.botToken);

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: USER_ID,
      text: 'Bu bir test mesajıdır — teşhis amaçlı.',
    }),
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));

  await prisma.$disconnect();
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
