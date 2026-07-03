# DigitalOcean'a Deploy Rehberi

Adım adım. Senin yapacağın her şey aşağıda, kopyala-yapıştır kıvamında.

## Adım 0 — Ön Hazırlık (Bu Hafta)

1. **DigitalOcean hesabı:** https://www.digitalocean.com — kart doğrula. (Bazen $200/60 gün kupon teklif ederler, kabul et.)
2. **Domain al:** Namecheap veya GoDaddy. Örnek: `kanalbot.com`. ~150 TL/yıl.
3. **BotFather'dan test botu** oluştur. Token'ı bir yere not al.
4. **Cloudflare** ücretsiz hesap aç (DNS + SSL hızlandırma için).

## Adım 1 — Droplet Oluştur (~10 dakika)

DigitalOcean → **Create → Droplets**:

- **Image:** Marketplace → **Docker on Ubuntu 22.04**
- **Plan:** Basic → Regular → **2GB RAM, 1 CPU, 50GB ($12/ay)**
- **Region:** Frankfurt (TR'ye en yakın hızlı bölge)
- **Authentication:** SSH key (önerilen) veya password (basit ama daha az güvenli)
- **Hostname:** `telegramtakip-prod`

Droplet hazır olunca **public IP**'sini not al (örn. `134.209.x.x`).

## Adım 2 — Domain'i Cloudflare'e Bağla

1. **Cloudflare'e domain ekle:** Add Site → kanalbot.com → Free plan.
2. Cloudflare sana 2 nameserver verir (`xxx.ns.cloudflare.com`).
3. Namecheap/GoDaddy panelinde domain'in nameserver'larını Cloudflare'in verdiğiyle değiştir.
4. **Cloudflare DNS** sekmesinde 2 A kaydı ekle:
   - `kanalbot.com` → Droplet IP, **Proxy KAPALI (DNS only — gri bulut)**
   - `api.kanalbot.com` → Droplet IP, **Proxy KAPALI**
   - (Proxy'yi kapalı tut, çünkü Caddy zaten SSL alacak. Sonra istersen aç.)
5. DNS yayılana kadar ~5 dakika bekle.

## Adım 3 — Droplet'e Bağlan ve Repo'yu Çek

Bilgisayarından terminal aç:

```bash
ssh root@DROPLET_IP

# Repo'yu çek (özel ise SSH key + GitHub ayarları gerekir — şimdilik public veya direkt scp)
mkdir -p /opt/telegramtakip
cd /opt/telegramtakip
```

**Lokalden upload (en basit yol):** Kendi bilgisayarından, proje klasöründe:

```bash
# Lokal makinede:
tar czf /tmp/tt.tar.gz --exclude=node_modules --exclude=.next --exclude=dist .
scp /tmp/tt.tar.gz root@DROPLET_IP:/opt/telegramtakip/

# Sunucuda:
cd /opt/telegramtakip
tar xzf tt.tar.gz
rm tt.tar.gz
```

Daha sonra GitHub'a koyabilir, `git pull` ile günceller hale getirebilirsin.

## Adım 4 — `.env` Üret (Üretim Değerleriyle)

```bash
cd /opt/telegramtakip
cp .env.example .env

# Güçlü random anahtarlar üret:
node -e "console.log('JWT='+require('crypto').randomBytes(48).toString('hex')); console.log('ENC='+require('crypto').randomBytes(32).toString('hex'))"
# Çıktıdaki JWT ve ENC değerlerini .env'e yapıştır

nano .env
```

Doldur:
```env
NODE_ENV=production
POSTGRES_USER=tt
POSTGRES_PASSWORD=<güçlü-şifre-üret>
POSTGRES_DB=telegramtakip

JWT_SECRET=<yukarda-üretilen-JWT>
ENCRYPTION_KEY=<yukarda-üretilen-ENC>

TELEGRAM_WEBHOOK_BASE_URL=https://api.kanalbot.com
PUBLIC_API_URL=https://api.kanalbot.com
PUBLIC_WEB_URL=https://kanalbot.com
```

`Caddyfile`'ı kendi domain'inle düzenle:
```bash
nano Caddyfile
# kanalbot.com → senin domain'inle değiştir
```

## Adım 5 — Ayağa Kaldır

```bash
cd /opt/telegramtakip
docker compose -f docker-compose.prod.yml up -d --build
```

İlk build ~5-10 dakika sürer. Logları izle:
```bash
docker compose -f docker-compose.prod.yml logs -f
```

## Adım 6 — DB Migration

```bash
docker compose -f docker-compose.prod.yml exec api node -e "
const { execSync } = require('child_process');
execSync('npx prisma migrate deploy', { cwd: '/app/packages/db', stdio: 'inherit' });
"
```

(İlk seferde alternatif: lokalde `pnpm db:migrate` yap, schema'yı direkt sunucudaki DB'ye uygular.)

## Adım 7 — Doğrulama

1. Tarayıcıda `https://kanalbot.com` → panel açılmalı.
2. `https://api.kanalbot.com/health` → `{ "status": "ok", ... }` dönmeli.
3. Panele kayıt ol → giriş yap → bot ekle → kanal ekle → paket tanımla.
4. BotFather'dan oluşturduğun botu Telegram'da kanalına admin yap (yetkiler: Invite users, Manage join requests, Ban users).
5. Kanal ayarları → "Approve new members" ✓
6. Başka bir hesaptan kanal istek linkine tıkla → bot DM atmalı.
7. Botla konuşmaya başla, dekont (test resmi) gönder → panel'de "Onay Bekleyenler"de görünmeli.
8. Onayla → kullanıcı kanala alınır + üyelik kaydı oluşur.

## Adım 8 — Cloudflare Proxy (İsteğe Bağlı, DDoS Koruma)

Her şey çalışınca Cloudflare'de DNS kayıtlarının "Proxy" simgesini (turuncu bulut) aç. Caddy zaten SSL halletti, Cloudflare ekstra koruma katar.

## Yedekleme (Önemli — İlk Müşteri Gelmeden Kur)

```bash
# Günlük postgres yedeği (cron)
crontab -e
# Eklenmek üzere:
0 3 * * * docker compose -f /opt/telegramtakip/docker-compose.prod.yml exec -T postgres pg_dump -U tt telegramtakip | gzip > /opt/backups/tt-$(date +\%Y\%m\%d).sql.gz
```

İdeal: Cloudflare R2 veya S3'e otomatik upload da ekle (rclone ile).

## Sorun Giderme

- **Caddy SSL alamıyor:** DNS doğru ayarlandı mı? Port 80 + 443 firewall'da açık mı?
- **Bot DM atmıyor:** Webhook URL doğru mu? `curl https://api.kanalbot.com/health` çalışıyor mu? Bot kanalda admin mi? "Approve new members" açık mı?
- **DB bağlantı hatası:** `.env`'deki `POSTGRES_PASSWORD` ve `DATABASE_URL`'deki şifre uyuşuyor mu?
- **Container restart loop:** `docker compose logs api` ile hatayı oku.

## Güncelleme

```bash
cd /opt/telegramtakip
# Yeni kodu yükle (scp veya git pull)
docker compose -f docker-compose.prod.yml up -d --build
```

## Maliyet Özeti

| Kalem | Aylık |
|---|---|
| DigitalOcean Droplet 2GB | $12 (~420 TL) |
| Domain (yıllık ÷ 12) | ~15 TL |
| Cloudflare | 0 TL |
| **Toplam** | **~435 TL/ay** |
