# TelegramTakip

Telegram ücretli kanal yönetim SaaS — katılma isteklerini otomatik karşılar, ödeme alır, süreli üyelik takip eder.

## Mimari

```
apps/
  api/        — Fastify backend (REST + Telegram webhook)
  web/        — Next.js panel (kanal sahibi dashboard'u)

packages/
  db/         — Prisma schema + migration'lar
  bot-engine/ — grammY multi-tenant Telegram orchestrator
  payments/   — Ödeme sağlayıcı adapter'ları (IBAN, PayTR, Iyzico...)
  scheduler/  — BullMQ job tanımları (süre dolunca atma vb.)
```

## Gereksinimler

- **Node.js 22+**
- **pnpm 10+** (`npm i -g pnpm`)
- **Docker Desktop** (lokal Postgres + Redis için — veya bulut alternatifler kullan)

## Hızlı Başlangıç

```bash
# 1. Bağımlılıklar
pnpm install

# 2. Ortam değişkenleri
cp .env.example .env
# .env dosyasını editleyip değerleri doldur

# 3. Postgres + Redis'i başlat (Docker)
pnpm docker:up

# 4. DB migration
pnpm db:migrate

# 5. Geliştirme sunucularını başlat
pnpm dev
```

API: http://localhost:3001
Panel: http://localhost:3000

## Komutlar

| Komut | Açıklama |
|---|---|
| `pnpm dev` | Tüm app'ler dev modda paralel |
| `pnpm build` | Production build |
| `pnpm typecheck` | TypeScript kontrol |
| `pnpm db:migrate` | Prisma migration uygula |
| `pnpm db:studio` | Prisma Studio GUI (DB görüntüleyici) |
| `pnpm docker:up` | Postgres + Redis container'larını başlat |
| `pnpm docker:down` | Container'ları durdur |
| `pnpm docker:logs` | Container loglarını göster |

## Telegram Bot Kurulumu (test için)

1. Telegram'da [@BotFather](https://t.me/BotFather) ile yeni bot oluştur (`/newbot`)
2. Verdiği token'ı bir kenara not al
3. Test için private bir Telegram kanalı oluştur
4. Botu kanala **admin** olarak ekle, yetkiler:
   - Invite users via link
   - Manage join requests
   - Ban users
5. Kanal ayarları → Channel Type → **Approve new members** ✓
6. Panele giriş yap, bot token'ı yapıştır, kanalı bağla, fiyat tanımla.
7. Başka bir hesaptan kanal istek linkine tıkla → bot DM atmalı.

## Deploy

Bkz. `docs/deploy-digitalocean.md` (Faz 12'de yazılacak).
