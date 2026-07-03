// Bot webhook durumunu Telegram'dan çeker.
// Kullanım: npx tsx scripts/check-webhook.ts
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

  const bots = await prisma.bot.findMany();
  for (const bot of bots) {
    const token = decrypt(bot.botToken);
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const data = await res.json();
    console.log(`\n=== ${bot.botUsername} (${bot.id}) ===`);
    console.log(JSON.stringify(data, null, 2));

    // Kanal admin durumu
    const channels = await prisma.channel.findMany({ where: { botId: bot.id } });
    for (const ch of channels) {
      const mRes = await fetch(
        `https://api.telegram.org/bot${token}/getChatMember?chat_id=${ch.telegramChatId}&user_id=${(await fetch(`https://api.telegram.org/bot${token}/getMe`).then((r) => r.json())).result.id}`,
      );
      const mData = await mRes.json();
      console.log(`\n  --- Bot's status in "${ch.name}" ---`);
      console.log(`  ${JSON.stringify(mData.result?.status ?? mData, null, 2)}`);
    }
  }
  await prisma.$disconnect();
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
