import { LegalLayout } from '../legal-layout';

export const metadata = { title: 'Gizlilik Politikası — TelegramTakip' };

export default function PrivacyPage() {
  return (
    <LegalLayout title="Gizlilik Politikası" updated="01.07.2026">
      <p>
        TelegramTakip olarak kullanıcılarımızın gizliliğine önem veriyoruz. İşbu Gizlilik
        Politikası, hizmetimizi kullanırken hangi bilgilerin toplandığını, nasıl
        kullanıldığını ve nasıl korunduğunu açıklar.
      </p>

      <h2>1. Toplanan Bilgiler</h2>
      <p>
        Kayıt esnasında adınız, e-posta adresiniz ve şifreniz alınır. Şifreleriniz düz metin
        olarak asla saklanmaz; endüstri standardı Argon2id algoritması ile hashlenir.
      </p>
      <p>
        Sisteme eklediğiniz bot token&apos;ları AES-256-GCM ile şifreli olarak saklanır ve
        sadece Telegram API çağrıları için çözülür.
      </p>

      <h2>2. Çerezler</h2>
      <p>
        Giriş oturumunuzu korumak için tarayıcınızda oturum jetonu (JWT) tutulur. Reklam veya
        üçüncü taraf takip çerezleri kullanılmaz.
      </p>

      <h2>3. E-posta İletişimi</h2>
      <p>
        Sizinle iletişime geçmek için yalnızca hesap doğrulama, şifre sıfırlama, sistem
        bildirimleri (yeni dekont, abonelik hatırlatması) ve zorunlu güncellemeler için
        e-posta göndeririz. Pazarlama e-postası göndermeyiz.
      </p>

      <h2>4. Üçüncü Taraf Servisler</h2>
      <p>
        Hizmetin işleyişi için altyapı sağlayıcı olarak sunucu barındırma hizmeti
        (DigitalOcean), CDN (Cloudflare), e-posta gönderim servisi (SMTP sağlayıcınız) gibi
        üçüncü taraflardan yararlanırız. Bu servislerin kendi gizlilik politikaları geçerlidir.
      </p>

      <h2>5. Veri Güvenliği</h2>
      <ul>
        <li>Tüm veri iletimi HTTPS/TLS ile şifrelenir.</li>
        <li>Veritabanı şifreli disk üzerinde tutulur ve düzenli olarak yedeklenir.</li>
        <li>Kimlik doğrulama JWT + Argon2 kombinasyonu ile sağlanır.</li>
        <li>Admin işlemleri denetim kayıtları (audit log) altında tutulur.</li>
      </ul>

      <h2>6. Verilerinizin Silinmesi</h2>
      <p>
        Hesabınızı istediğiniz zaman kapatabilirsiniz. Hesap kapatıldığında yasal saklama
        zorunluluğu bulunmayan tüm veriler makul süre içinde silinir.
      </p>

      <h2>7. İletişim</h2>
      <p>
        Gizlilik konusundaki sorularınız için sisteme kayıtlı e-posta adresiniz ile iletişime
        geçebilirsiniz.
      </p>
    </LegalLayout>
  );
}
