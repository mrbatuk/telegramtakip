import { LegalLayout } from '../legal-layout';

export const metadata = { title: 'KVKK Aydınlatma Metni — TelegramTakip' };

export default function KvkkPage() {
  return (
    <LegalLayout title="KVKK Aydınlatma Metni" updated="01.07.2026">
      <h2>1. Veri Sorumlusu</h2>
      <p>
        6698 sayılı <strong>Kişisel Verilerin Korunması Kanunu</strong> (&quot;KVKK&quot;)
        uyarınca, TelegramTakip hizmetini sağlayan <strong>Şirket</strong> Veri Sorumlusu
        sıfatını haizdir. İşbu Aydınlatma Metni, kişisel verilerinizin işlenme amaçları,
        kimlere aktarılabileceği ve haklarınızı açıklar.
      </p>

      <h2>2. İşlenen Kişisel Veriler</h2>
      <ul>
        <li>
          <strong>Kimlik ve İletişim Verileri:</strong> ad, soyad, e-posta adresi.
        </li>
        <li>
          <strong>Hesap Verileri:</strong> şifre (hashlenmiş), abonelik ve plan bilgileri,
          son giriş tarihi.
        </li>
        <li>
          <strong>Kullanım Verileri:</strong> Kullanıcı&apos;nın panele eklediği bot
          token&apos;ları (şifreli), kanal ve paket tanımları, kabul ettiği son müşteri
          ödemeleri, dekont görselleri.
        </li>
        <li>
          <strong>İşlem Kayıtları:</strong> güvenlik amacıyla loglanan IP adresi, tarayıcı
          bilgileri, admin tarafında yapılan işlemler.
        </li>
      </ul>

      <h2>3. Kişisel Verilerin İşlenme Amaçları</h2>
      <ul>
        <li>Sözleşmenin kurulması ve ifası (hizmetin sağlanması),</li>
        <li>Hesap güvenliği (kimlik doğrulama, şifre sıfırlama),</li>
        <li>Yasal yükümlülüklerin yerine getirilmesi,</li>
        <li>Hizmet kalitesinin iyileştirilmesi ve destek sunulması,</li>
        <li>Kullanıcı&apos;ya sistem bildirimleri gönderimi.</li>
      </ul>

      <h2>4. Kişisel Verilerin Aktarımı</h2>
      <p>
        Kişisel verileriniz üçüncü kişilerle ticari amaçla paylaşılmaz. Yalnızca hukuki
        yükümlülük gerektiğinde yetkili kamu kurumlarına, sunucu ve altyapı hizmeti sağlayan
        (DigitalOcean, Cloudflare vb.) hizmet tedarikçilerimize kısmen aktarılabilir. Ödeme
        sağlayıcılarına (PayTR, Iyzico, Stripe) yapılan her aktarım, Kullanıcı&apos;nın kendi
        merchant hesabı üzerinden gerçekleştirilir; Şirket bu ödemelere aracılık etmez.
      </p>

      <h2>5. Verilerin Saklanma Süresi</h2>
      <p>
        Kişisel verileriniz, hesabınız aktif olduğu sürece ve ilgili mevzuatta belirlenen
        zamanaşımı süreleri boyunca saklanır. Hesabınız kapatıldığında, yasal saklama
        yükümlülüğü kapsamında olmayan veriler makul süre içinde silinir.
      </p>

      <h2>6. KVKK Haklarınız</h2>
      <p>KVKK m. 11 uyarınca aşağıdaki haklara sahipsiniz:</p>
      <ul>
        <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme,</li>
        <li>İşlenmişse buna ilişkin bilgi talep etme,</li>
        <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,</li>
        <li>Verilerin aktarıldığı üçüncü kişileri bilme,</li>
        <li>Verilerin eksik veya yanlış işlenmiş olması hâlinde düzeltilmesini isteme,</li>
        <li>Verilerin silinmesini veya yok edilmesini isteme,</li>
        <li>Otomatik sistemler yoluyla analiz edilerek aleyhinize bir sonucun ortaya
          çıkmasına itiraz etme,</li>
        <li>Kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız hâlinde zararın
          giderilmesini talep etme.</li>
      </ul>

      <h2>7. İletişim</h2>
      <p>
        KVKK kapsamındaki haklarınızı kullanmak için sisteme kayıtlı e-posta adresiniz ile
        Şirket&apos;e başvurabilirsiniz. Başvurular en geç 30 gün içinde yanıtlanır.
      </p>
    </LegalLayout>
  );
}
