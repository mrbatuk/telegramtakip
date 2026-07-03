// Sevnur'un kanaldaki durumunu kontrol eder
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

  const channels = await prisma.channel.findMany({ include: { bot: true } });
  for (const ch of channels) {
    const token = decrypt(ch.bot.botToken);

    // Sevnur'un durumu
    const mRes = await fetch(
      `https://api.telegram.org/bot${token}/getChatMember?chat_id=${ch.telegramChatId}&user_id=${USER_ID}`,
    );
    const mData = await mRes.json();
    console.log(`\n=== ${ch.name} ===`);
    console.log(`Sevnur status: ${JSON.stringify(mData, null, 2)}`);

    // Pending join requests
    // Not: getChatMemberCount only. Bekleyen join requestleri sorgulayacak method yok.
    // Ama admin log'una bakabiliriz — atlayalım.
  }
  await prisma.$disconnect();
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
