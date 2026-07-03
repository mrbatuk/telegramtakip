import { LegalLayout } from '../legal-layout';

export const metadata = { title: 'Kullanım Sözleşmesi — TelegramTakip' };

export default function TermsPage() {
  return (
    <LegalLayout title="Kullanım Sözleşmesi" updated="01.07.2026">
      <h2>1. Taraflar</h2>
      <p>
        İşbu Kullanım Sözleşmesi (&quot;Sözleşme&quot;), <strong>TelegramTakip</strong> hizmetini
        sunan hizmet sağlayıcı (&quot;Şirket&quot;) ile hizmeti kullanan gerçek veya tüzel kişi
        (&quot;Kullanıcı&quot;) arasında akdedilmiştir. Kayıt formunu doldurarak Kullanıcı bu
        Sözleşme&apos;yi kabul etmiş sayılır.
      </p>

      <h2>2. Hizmetin Tanımı</h2>
      <p>
        TelegramTakip; Kullanıcı&apos;nın kendi Telegram kanallarını yönetmesine olanak
        tanıyan bir SaaS (Software as a Service) platformudur. Bu kapsamda:
      </p>
      <ul>
        <li>Katılma isteklerine otomatik yanıt gönderimi,</li>
        <li>Ödeme dekont ve/veya kart ile ödeme kabulü,</li>
        <li>Süreli üyelik yönetimi ve süresi dolan üyelerin otomatik çıkarılması,</li>
        <li>Panelden raporlama ve müşteri yönetimi araçları,</li>
      </ul>
      <p>gibi özellikler sunulmaktadır.</p>

      <h2>3. Kullanıcı Yükümlülükleri</h2>
      <ul>
        <li>
          Kullanıcı, sisteme kayıt olurken doğru ve güncel bilgi vermeyi taahhüt eder.
        </li>
        <li>
          Kullanıcı, Telegram bot token&apos;ının, kanal yetkilerinin ve ödeme sağlayıcı
          bilgilerinin güvenliğinden bizzat sorumludur.
        </li>
        <li>
          Kullanıcı, yasadışı içerik dağıtımı, telif ihlali, çocuk istismarı içerikleri,
          uyuşturucu satışı veya benzeri yasadışı faaliyetler için hizmeti kullanmayacağını
          kabul eder.
        </li>
        <li>
          Kullanıcı, kendi kanalındaki son kullanıcılara sunduğu içerik, hizmet ve ödemenin
          hukuki sorumluluğunu kabul eder.
        </li>
      </ul>

      <h2>4. Ödeme ve Abonelik</h2>
      <p>
        TelegramTakip; Starter, Pro ve Business olmak üzere üç aylık abonelik planı sunar. Plan
        değişikliği, iptal ve iade taleplerinde Kullanıcı Şirket ile iletişime geçer. Ödeme
        alınmadığı sürece hesap askıya alınabilir.
      </p>
      <p>
        Kullanıcı&apos;nın kendi son müşterilerinden aldığı ödemeler, Kullanıcı&apos;nın kendi
        merchant hesabına doğrudan aktarılır — Şirket bu ödemelerin hiçbirine aracılık etmez
        ve komisyon almaz.
      </p>

      <h2>5. Hizmet Sürekliliği</h2>
      <p>
        Şirket, hizmetin kesintisiz sunulması için makul çaba gösterir; ancak bakım, güncelleme,
        Telegram API değişiklikleri veya mücbir sebeplerden kaynaklanan geçici kesintilerden
        sorumlu tutulamaz.
      </p>

      <h2>6. Fesih</h2>
      <p>
        Kullanıcı hesabını istediği zaman kapatabilir. Şirket, işbu Sözleşme&apos;ye aykırı
        kullanım tespiti hâlinde önceden bildirim yaparak veya yapmayarak hesabı askıya alma
        veya kapatma hakkını saklı tutar.
      </p>

      <h2>7. Değişiklikler</h2>
      <p>
        Şirket, işbu Sözleşme&apos;nin şartlarını gerektiğinde güncelleyebilir. Güncellemeler
        Kullanıcı&apos;nın kayıtlı e-postasına bildirilir. Değişikliklerden sonra hizmetin
        kullanımına devam eden Kullanıcı, güncel şartları kabul etmiş sayılır.
      </p>

      <h2>8. İletişim</h2>
      <p>
        Sözleşme&apos;ye ilişkin her türlü soru ve talep için Kullanıcı kayıtlı e-posta
        adresi üzerinden Şirket&apos;e ulaşabilir.
      </p>
    </LegalLayout>
  );
}
