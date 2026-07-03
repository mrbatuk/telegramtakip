import Link from 'next/link';
import {
  Send,
  ArrowRight,
  Zap,
  Bot,
  CreditCard,
  CheckCircle2,
  Sparkles,
  Clock,
} from 'lucide-react';

interface PublicPlan {
  key: string;
  name: string;
  description: string | null;
  monthlyPriceTRY: number;
  features: string[];
  sortOrder: number;
}

const FAQ = [
  {
    q: 'Ödemeler benim hesabıma mı geliyor?',
    a: 'Evet. TelegramTakip aracı olmaz — kendi PayTR / Iyzico / Stripe merchant hesabına veya IBAN\'ına doğrudan gelir. Biz sadece takibini kolaylaştıran araç sunuyoruz.',
  },
  {
    q: 'Bir tenant kaç bot ve kanal ekleyebilir?',
    a: 'Plan\'a göre değişir. Sayfadaki fiyat tablosunda her plan için sınırlar yazılı.',
  },
  {
    q: 'Süresi dolan üye otomatik atılır mı?',
    a: 'Evet. Üyelik bitince Telegram API üzerinden kanaldan otomatik çıkarılır. Kullanıcıya "üyeliğin bitti" DM\'i gider, isterse /yenile komutuyla üyeliğini uzatabilir.',
  },
  {
    q: 'Dekont manuel onay yerine otomatik onay olabilir mi?',
    a: 'Evet. PayTR veya Iyzico ile kart ödemeleri anında otomatik onaylanır — kullanıcı kanala saniyeler içinde eklenir. IBAN dekont ise manuel onay kalır.',
  },
  {
    q: 'Ne kadar sürede kullanıma başlayabilirim?',
    a: 'Kayıt olduktan sonra 5 dakika içinde. BotFather\'dan bot al, panele yapıştır, kanalı bağla, paket ekle — hazır.',
  },
  {
    q: 'İptal etmek istersem?',
    a: 'İstediğin an ödemeyi durdurabilirsin. Bir sonraki aya kadar sistem çalışmaya devam eder, sonra otomatik pasif olur.',
  },
];

async function fetchPlans(): Promise<PublicPlan[]> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/api/v1/public/plans`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.plans as PublicPlan[];
  } catch {
    return [];
  }
}

export default async function Home() {
  const plans = await fetchPlans();
  const orderedPlans = [...plans].sort((a, b) => a.sortOrder - b.sortOrder);
  const midIdx = Math.floor(orderedPlans.length / 2);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/30">
      {/* Nav */}
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-sm">
              <Send size={16} className="text-white" />
            </div>
            <span className="font-semibold text-slate-900">TelegramTakip</span>
          </div>
          <div className="flex items-center gap-2">
            <a href="#fiyatlar" className="text-sm text-slate-600 hover:text-slate-900 hidden sm:inline px-3 py-1.5">Fiyatlar</a>
            <a href="#sss" className="text-sm text-slate-600 hover:text-slate-900 hidden sm:inline px-3 py-1.5">SSS</a>
            <Link href="/login" className="btn-ghost btn-sm">Giriş</Link>
            <Link href="/register" className="btn-primary btn-sm">Ücretsiz Başla</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-16 md:pt-24 pb-12 text-center">
        <span className="badge-info mb-5 inline-flex">
          <Zap size={11} /> Türkiye'de üretildi, KVKK uyumlu
        </span>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900 mb-5 leading-[1.1]">
          Ücretli Telegram kanalını
          <br />
          <span className="text-brand-600">otomatik yönet</span>
        </h1>
        <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto leading-relaxed">
          Katılma isteklerine otomatik fiyat mesajı. Kart (PayTR, Iyzico, Stripe) veya IBAN ile ödeme.
          Dekont onayı. Süreli üyelik ve süresi dolanı kanaldan otomatik atma. Hepsi tek panelden.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/register" className="btn-primary btn-lg">
            Ücretsiz Başla <ArrowRight size={16} />
          </Link>
          <a href="#fiyatlar" className="btn-secondary btn-lg">Fiyatları Gör</a>
        </div>
        <p className="text-xs text-slate-500 mt-4">Kredi kartı gerekmez · Kurulum 5 dakika</p>
      </section>

      {/* Feature grid */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard icon={Bot} color="brand" title="Otomatik Cevap"
            description="Katılma isteği gelen herkese saniyeler içinde fiyat ve ödeme bilgisi DM olarak iletilir. Elle uğraşma." />
          <FeatureCard icon={CreditCard} color="emerald" title="Çok Yönlü Ödeme"
            description="IBAN dekontu (manuel onay) veya PayTR/Iyzico/Stripe ile otomatik tahsilat. Ödeme senin hesabına gider — biz aracı değiliz." />
          <FeatureCard icon={Clock} color="amber" title="Süreli Üyelik"
            description="1 aylık, 3 aylık, yıllık paketler. Süresi dolan üye otomatik çıkarılır. Yenileme DM ile otomatik hatırlatma." />
        </div>
      </section>

      {/* Pricing */}
      <section id="fiyatlar" className="bg-white border-y border-slate-200 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">Fiyatlar</h2>
            <p className="text-slate-600">Basit ve şeffaf. İstediğin an planını değiştir veya iptal et.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {orderedPlans.length === 0 && (
              <div className="col-span-full text-center text-slate-500 py-8">
                Fiyatlar yükleniyor — bir sorun varsa iletişime geç.
              </div>
            )}
            {orderedPlans.map((plan, i) => (
              <div key={plan.key} className={`card p-6 relative ${
                i === midIdx && orderedPlans.length >= 2 ? 'border-brand-500 shadow-lg shadow-brand-100 ring-1 ring-brand-500' : ''
              }`}>
                {i === midIdx && orderedPlans.length >= 2 && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 badge-info bg-brand-600 text-white ring-0 px-2.5 py-1">
                    <Sparkles size={11} /> En Popüler
                  </div>
                )}
                <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                {plan.description && <p className="text-xs text-slate-500 mt-1">{plan.description}</p>}
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-slate-900">{plan.monthlyPriceTRY.toLocaleString('tr-TR')}</span>
                  <span className="text-sm text-slate-500">TL/ay</span>
                </div>
                <ul className="mt-5 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/register" className={`mt-6 w-full ${i === midIdx ? 'btn-primary' : 'btn-secondary'}`}>
                  Başla <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 text-center mt-6">Fiyatlara KDV dahildir.</p>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">3 adımda kurulum</h2>
          <p className="text-slate-600">5 dakika, sonra bot senin için çalışır</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Step n={1} title="Bot oluştur" text="BotFather'dan token al, panele yapıştır." />
          <Step n={2} title="Kanalı bağla" text="Botu kanalına admin yap — otomatik tespit edilir." />
          <Step n={3} title="Otomatik çalışsın" text="Katılma isteği gelen DM alır, öder, kanala eklenir." />
        </div>
      </section>

      {/* FAQ */}
      <section id="sss" className="bg-slate-50 border-y border-slate-200 py-16">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Sıkça Sorulanlar</h2>
          </div>
          <div className="space-y-3">
            {FAQ.map((f, i) => (
              <details key={i} className="card p-5 group">
                <summary className="font-medium text-slate-900 cursor-pointer flex items-center justify-between">
                  {f.q}
                  <span className="text-slate-400 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
          Botunu bugün otomatikleştir
        </h2>
        <Link href="/register" className="btn-primary btn-lg">
          Ücretsiz Başla <ArrowRight size={16} />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-brand-600 flex items-center justify-center">
              <Send size={14} className="text-white" />
            </div>
            <span className="font-medium">TelegramTakip</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/sozlesme" className="hover:text-slate-900">Kullanım Sözleşmesi</Link>
            <Link href="/kvkk" className="hover:text-slate-900">KVKK</Link>
            <Link href="/gizlilik" className="hover:text-slate-900">Gizlilik</Link>
          </div>
          <div>© 2026 TelegramTakip</div>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({ icon: Icon, color, title, description }: {
  icon: React.ComponentType<{ size?: number }>;
  color: 'brand' | 'emerald' | 'amber';
  title: string;
  description: string;
}) {
  const colors = {
    brand: 'bg-brand-50 text-brand-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
  }[color];
  return (
    <div className="card p-6">
      <div className={`w-11 h-11 rounded-xl ${colors} flex items-center justify-center mb-4`}>
        <Icon size={20} />
      </div>
      <h3 className="font-semibold text-slate-900 mb-1.5">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <div className="card p-6">
      <div className="w-9 h-9 rounded-full bg-brand-600 text-white font-bold flex items-center justify-center mb-3">{n}</div>
      <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
    </div>
  );
}
