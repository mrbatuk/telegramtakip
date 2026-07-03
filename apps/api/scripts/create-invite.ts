// Test için kanala 'onay isteyen' invite link oluşturur.
// Kullanım: npx tsx scripts/create-invite.ts
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

  const channels = await prisma.channel.findMany({
    include: { bot: true },
  });

  for (const ch of channels) {
    const token = decrypt(ch.bot.botToken);
    const res = await fetch(
      `https://api.telegram.org/bot${token}/createChatInviteLink`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: Number(ch.telegramChatId),
          name: 'Test — Onay Gerek',
          creates_join_request: true,
        }),
      },
    );
    const data = await res.json();
    console.log(`\n=== ${ch.name} (chat_id: ${ch.telegramChatId}) ===`);
    if (data.ok) {
      console.log('✅ Yeni onay-isteyen invite link:');
      console.log('   ', data.result.invite_link);
    } else {
      console.log('❌ Hata:', data);
    }
  }
  await prisma.$disconnect();
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
