// Varsayılan planları seed eder (STARTER, PRO, BUSINESS).
// Kullanım: cd apps/api && npx tsx scripts/seed-plans.ts
import { config as dotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
dotenv({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '.env') });

async function main() {
  const { prisma } = await import('@tt/db');

  const plans = [
    {
      key: 'STARTER',
      name: 'Starter',
      description: 'Küçük kanallar için başlangıç planı',
      monthlyPriceTRY: 399,
      maxBots: 1,
      maxChannelsPerBot: 1,
      maxActiveMembers: 200,
      allowedPaymentMethods: ['IBAN'],
      features: [
        '1 bot',
        '1 kanal',
        '200 aktif üye',
        'IBAN ile dekont onayı',
        'E-posta bildirimi',
        'Süreli üyelik otomatiği',
      ],
      isActive: true,
      isPublic: true,
      sortOrder: 10,
      quarterlyMultiplier: 0.9,
      yearlyMultiplier: 0.8,
    },
    {
      key: 'PRO',
      name: 'Pro',
      description: 'Aktif kanal işletenler için',
      monthlyPriceTRY: 999,
      maxBots: 3,
      maxChannelsPerBot: 5,
      maxActiveMembers: 1000,
      allowedPaymentMethods: ['IBAN', 'PAYTR', 'IYZICO', 'STRIPE'],
      features: [
        '3 bot',
        'Bot başına 5 kanal',
        '1.000 aktif üye',
        'PayTR + Iyzico + Stripe + IBAN',
        'Otomatik ödeme + onay',
        '3 gün uyarı DM',
        'Öncelikli e-posta desteği',
      ],
      isActive: true,
      isPublic: true,
      sortOrder: 20,
      quarterlyMultiplier: 0.9,
      yearlyMultiplier: 0.8,
    },
    {
      key: 'BUSINESS',
      name: 'Business',
      description: 'Kurumsal kullanım için sınırsız',
      monthlyPriceTRY: 2499,
      maxBots: 999,
      maxChannelsPerBot: 999,
      maxActiveMembers: 999999,
      allowedPaymentMethods: ['IBAN', 'PAYTR', 'IYZICO', 'STRIPE', 'USDT_TRC20'],
      features: [
        'Sınırsız bot',
        'Sınırsız kanal',
        'Sınırsız aktif üye',
        'Tüm ödeme yöntemleri (+ USDT TRC20)',
        'Öncelikli teknik destek',
        'Özel entegrasyonlar',
      ],
      isActive: true,
      isPublic: true,
      sortOrder: 30,
      quarterlyMultiplier: 0.9,
      yearlyMultiplier: 0.8,
    },
  ];

  for (const p of plans) {
    const existing = await prisma.planConfig.findUnique({ where: { key: p.key } });
    if (existing) {
      console.log(`[skip] ${p.key} zaten var`);
    } else {
      await prisma.planConfig.create({ data: p });
      console.log(`[ok] ${p.key} oluşturuldu`);
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
