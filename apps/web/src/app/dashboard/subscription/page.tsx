'use client';
import { Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import {
  Crown,
  Calendar,
  Bot,
  Hash,
  Users,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Landmark,
  X,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/lib/toast';

interface PlanConfig {
  key: string;
  name: string;
  description?: string | null;
  maxBots: number;
  maxChannelsPerBot: number;
  maxActiveMembers: number;
  allowedPaymentMethods: string[];
  monthlyPriceTRY: number;
  features?: string[];
  sortOrder?: number;
  quarterlyMultiplier?: number | null;
  yearlyMultiplier?: number | null;
}

interface SubData {
  plan: string;
  subExpiresAt: string | null;
  daysLeft: number;
  isActive: boolean;
  isOnTrial: boolean;
  trialDaysLeft: number;
  limits: PlanConfig & { name: string };
  usage: { bots: number; channels: number; activeMembers: number };
  allPlans: PlanConfig[]; // Array değişti — obje değil
}

interface BillingMethod {
  id: string;
  type: 'PAYTR' | 'IYZICO' | 'IBAN';
  label: string;
  ibanInfo: string | null;
}


export default function SubscriptionPage() {
  return (
    <Suspense fallback={<div className="card p-6"><div className="skeleton h-24" /></div>}>
      <SubscriptionPageInner />
    </Suspense>
  );
}

function SubscriptionPageInner() {
  const [data, setData] = useState<SubData | null>(null);
  const [billingMethods, setBillingMethods] = useState<BillingMethod[]>([]);
  const [modalPlan, setModalPlan] = useState<string | null>(null);

  const params = useSearchParams();
  const paid = params.get('paid');

  useEffect(() => {
    api.get<SubData>('/subscription').then(setData);
    api
      .get<{ methods: BillingMethod[] }>('/subscription/billing-methods')
      .then((r) => setBillingMethods(r.methods));
  }, []);

  useEffect(() => {
    if (paid === '1') toast.success('Ödemen alındı', 'Aboneliğin birkaç saniye içinde aktif olacak');
    if (paid === '0') toast.error('Ödeme tamamlanamadı');
  }, [paid]);

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-64" />
        <div className="skeleton h-40" />
      </div>
    );
  }

  const nearExpiry = data.isActive && data.daysLeft < 7;
  const expired = !data.isActive;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Aboneliğim</h1>
        <p className="text-sm text-slate-500 mt-1">Plan durumun, kalan süre ve yükseltme</p>
      </div>

      {/* Ana kart */}
      <div className={`card p-6 ${
        expired ? 'bg-red-50 border-red-200' :
        nearExpiry ? 'bg-amber-50 border-amber-200' :
        'bg-gradient-to-br from-brand-50 to-white border-brand-200'
      }`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              expired ? 'bg-red-100 text-red-700' :
              nearExpiry ? 'bg-amber-100 text-amber-700' :
              'bg-brand-100 text-brand-700'
            }`}>
              <Crown size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-semibold text-slate-900">{data.limits.name}</h2>
                {data.isOnTrial ? (
                  <span className="badge-info"><Sparkles size={11} /> Deneme</span>
                ) : data.isActive ? (
                  <span className="badge-success"><CheckCircle2 size={11} /> Aktif</span>
                ) : (
                  <span className="badge-danger"><AlertTriangle size={11} /> Süresi Dolmuş</span>
                )}
              </div>
              {data.isOnTrial && (
                <p className="text-sm text-brand-700 font-medium mt-1">
                  Ücretsiz denemenden <strong>{data.trialDaysLeft} gün</strong> kaldı
                </p>
              )}
              <p className="text-sm text-slate-600 mt-1">{data.limits.monthlyPriceTRY.toLocaleString('tr-TR')} TL / ay</p>
              {data.subExpiresAt && (
                <div className="flex items-center gap-1.5 text-sm text-slate-600 mt-2">
                  <Calendar size={14} />
                  Bitiş: <strong className="text-slate-900">{new Date(data.subExpiresAt).toLocaleDateString('tr-TR')}</strong>
                  {data.isActive && (
                    <span className={data.daysLeft < 3 ? 'text-red-600 font-semibold' : data.daysLeft < 7 ? 'text-amber-700 font-medium' : 'text-slate-500'}>
                      · {data.daysLeft} gün kaldı
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <button onClick={() => setModalPlan(data.plan)} className="btn-primary">
            <Sparkles size={14} /> {data.isActive ? 'Uzat / Yenile' : 'Aktifleştir'}
          </button>
        </div>

        {(expired || nearExpiry) && (
          <div className={`mt-4 p-3 bg-white border rounded-lg text-sm ${expired ? 'border-red-200 text-red-800' : 'border-amber-200 text-amber-800'}`}>
            <strong>{expired ? 'Aboneliğin sona erdi.' : 'Abonelik yakında bitiyor.'}</strong>
            {expired
              ? ' Yeni bot ekleyemez ama mevcut botların çalışmaya devam eder. Yenile veya iletişime geç.'
              : ' Kesinti yaşamamak için yenilemeni öneririz.'}
          </div>
        )}
      </div>

      {/* Kullanım */}
      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Kullanım Durumu</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <UsageBar icon={Bot} label="Bot" used={data.usage.bots} limit={data.limits.maxBots} />
          <UsageBar icon={Hash} label="Kanal (max)" used={data.usage.channels} limit={data.limits.maxChannelsPerBot * Math.max(data.usage.bots, 1)} />
          <UsageBar icon={Users} label="Aktif Üye" used={data.usage.activeMembers} limit={data.limits.maxActiveMembers} />
        </div>
        <div className="mt-4 pt-4 border-t border-slate-200 flex items-center gap-2 text-sm text-slate-600 flex-wrap">
          <CreditCard size={14} className="text-slate-400" />
          <span>Kullanabildiğin ödeme yöntemleri:</span>
          {data.limits.allowedPaymentMethods.map((m) => <span key={m} className="badge-neutral text-[10px]">{m}</span>)}
        </div>
      </div>

      {/* Plan karşılaştırma */}
      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 mb-4"><span className="inline-flex items-center gap-2"><Sparkles size={17} className="text-brand-600" /> Diğer Planlar</span></h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {data.allPlans.map((p) => {
            const isCurrent = p.key === data.plan;
            return (
              <div key={p.key} className={`border rounded-xl p-5 flex flex-col ${isCurrent ? 'border-brand-500 bg-brand-50/40' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-lg">{p.name}</h3>
                  {isCurrent && <span className="badge-success text-[10px]">Mevcut</span>}
                </div>
                {p.description && <p className="text-xs text-slate-500 mb-2">{p.description}</p>}
                <p className="text-2xl font-bold text-slate-900">{p.monthlyPriceTRY.toLocaleString('tr-TR')} <span className="text-sm font-medium text-slate-500">TL/ay</span></p>
                <ul className="mt-4 space-y-2 text-sm text-slate-600 flex-1">
                  {(p.features && p.features.length > 0
                    ? p.features
                    : [
                        `${p.maxBots === 999 ? 'Sınırsız' : p.maxBots} bot`,
                        `Bot başına ${p.maxChannelsPerBot === 999 ? 'sınırsız' : p.maxChannelsPerBot} kanal`,
                        `${p.maxActiveMembers.toLocaleString('tr-TR')} aktif üye`,
                        `${p.allowedPaymentMethods.length} ödeme yöntemi`,
                      ]
                  ).map((f, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-600" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setModalPlan(p.key)}
                  className={`mt-4 w-full ${isCurrent ? 'btn-secondary' : 'btn-primary'}`}
                >
                  {isCurrent ? 'Uzat' : 'Bu Plana Geç'}
                  <ArrowRight size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {modalPlan && (() => {
        const p = data.allPlans.find((x) => x.key === modalPlan);
        if (!p) return null;
        return (
          <UpgradeModal
            plan={modalPlan}
            planName={p.name}
            planPrice={p.monthlyPriceTRY}
            quarterlyMultiplier={p.quarterlyMultiplier ?? null}
            yearlyMultiplier={p.yearlyMultiplier ?? null}
            methods={billingMethods}
            onClose={() => setModalPlan(null)}
          />
        );
      })()}
    </div>
  );
}

function UsageBar({
  icon: Icon,
  label,
  used,
  limit,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  used: number;
  limit: number;
}) {
  const percent = Math.min((used / Math.max(limit, 1)) * 100, 100);
  const danger = percent >= 90;
  const warn = percent >= 70;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-sm text-slate-600">
          <Icon size={14} />
          <span>{label}</span>
        </div>
        <span className={`text-sm font-semibold ${danger ? 'text-red-600' : warn ? 'text-amber-600' : 'text-slate-700'}`}>
          {used} / {limit === 999 || limit === 999999 ? '∞' : limit}
        </span>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full transition-all ${danger ? 'bg-red-500' : warn ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function UpgradeModal({
  plan,
  planName,
  planPrice,
  quarterlyMultiplier,
  yearlyMultiplier,
  methods,
  onClose,
}: {
  plan: string;
  planName: string;
  planPrice: number;
  quarterlyMultiplier: number | null;
  yearlyMultiplier: number | null;
  methods: BillingMethod[];
  onClose: () => void;
}) {

  function calcBase(months: number): number {
    const gross = planPrice * months;
    if (months >= 12 && yearlyMultiplier !== null) return Math.round(gross * yearlyMultiplier * 100) / 100;
    if (months >= 3 && quarterlyMultiplier !== null) return Math.round(gross * quarterlyMultiplier * 100) / 100;
    return gross;
  }
  const [months, setMonths] = useState(1);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(methods[0]?.id ?? null);
  const [starting, setStarting] = useState(false);
  const [ibanResult, setIbanResult] = useState<{ ibanInfo: string; amount: number } | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState<{ baseAmount?: number; discount: number; finalAmount: number; description?: string } | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Baz tutar: multiplier'lı hesap (kupon varsa backend'den gelen kesin değeri kullan)
  const base = coupon ? (coupon.baseAmount ?? coupon.finalAmount + coupon.discount) : calcBase(months);
  const total = coupon?.finalAmount ?? base;

  async function applyCoupon(codeOverride?: string) {
    const codeToUse = (codeOverride ?? couponCode).trim().toUpperCase();
    if (!codeToUse) return;
    setCouponChecking(true);
    setCouponError(null);
    try {
      const r = await api.post<{ ok: boolean; baseAmount: number; discount: number; finalAmount: number; description?: string }>(
        '/subscription/validate-coupon',
        { code: codeToUse, plan, months },
      );
      setCoupon(r);
    } catch (err) {
      setCouponError(err instanceof ApiError ? err.message : 'Kupon geçersiz');
      setCoupon(null);
    } finally {
      setCouponChecking(false);
    }
  }

  // Süre değiştikçe kupon uygulanmışsa yeniden hesapla
  useEffect(() => {
    if (coupon && couponCode.trim()) {
      applyCoupon(couponCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months, plan]);

  function clearCoupon() {
    setCoupon(null);
    setCouponCode('');
    setCouponError(null);
  }

  async function startUpgrade() {
    if (!selectedMethod) return;
    setStarting(true);
    try {
      const r = await api.post<{
        type: string;
        paymentUrl?: string;
        ibanInfo?: string;
        amount?: number;
      }>('/subscription/start', {
        plan,
        billingMethodId: selectedMethod,
        months,
        couponCode: coupon ? couponCode.trim().toUpperCase() : undefined,
      });
      if (r.type === 'IBAN') {
        setIbanResult({ ibanInfo: r.ibanInfo ?? '', amount: r.amount ?? 0 });
      } else if (r.paymentUrl) {
        window.location.href = r.paymentUrl;
      }
    } catch (err) {
      toast.error(
        'Başlatılamadı',
        err instanceof ApiError ? err.message : 'Sunucu hatası',
      );
      setStarting(false);
    }
  }

  if (methods.length === 0) {
    return (
      <ModalPortal>
        <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-[60] p-4">
          <div className="card p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Ödeme Yöntemi Yok</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-900"><X size={18} /></button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Şu anda tahsilat yöntemi tanımlanmamış. Kanal sahibiyle iletişime geçerek ödeme yapabilirsin.
            </p>
            <button onClick={onClose} className="btn-secondary w-full">Kapat</button>
          </div>
        </div>
      </ModalPortal>
    );
  }

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-[60] p-4 overflow-y-auto">
      <div className="card p-6 max-w-lg w-full my-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg text-slate-900">{planName} Aboneliği</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900"><X size={18} /></button>
        </div>

        {ibanResult ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-sm font-medium text-emerald-900 mb-2">
                Aboneliğin başlatıldı — ödeme sonrası aktifleşecek
              </p>
              <p className="text-xs text-emerald-700">
                Toplam tutar: <strong>{ibanResult.amount.toLocaleString('tr-TR')} TL</strong>
              </p>
            </div>
            <div>
              <label className="label">Ödeme Bilgileri</label>
              <pre className="p-4 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm whitespace-pre-wrap">{ibanResult.ibanInfo}</pre>
              <p className="text-xs text-slate-500 mt-2">
                Ödeme yaptıktan sonra sistem yöneticisiyle iletişime geç, aboneliğin manuel aktifleştirilecek.
              </p>
            </div>
            <button onClick={onClose} className="btn-primary w-full">Anladım</button>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="label">Süre</label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 3, 12].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMonths(m)}
                    className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                      months === m ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {m} ay
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="label">Ödeme Yöntemi</label>
              <div className="space-y-2">
                {methods.map((m) => {
                  const isSel = selectedMethod === m.id;
                  const Icon = m.type === 'IBAN' ? Landmark : CreditCard;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMethod(m.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors flex items-center gap-3 ${
                        isSel ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <Icon size={18} className={isSel ? 'text-brand-600' : 'text-slate-500'} />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{m.label}</p>
                        <p className="text-xs text-slate-500">{m.type === 'PAYTR' ? 'Kart ile öde (PayTR)' : m.type === 'IYZICO' ? 'Kart ile öde (Iyzico)' : 'Havale / EFT'}</p>
                      </div>
                      {isSel && <CheckCircle2 size={16} className="text-brand-600" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-4">
              <label className="label">Kupon Kodu (opsiyonel)</label>
              {coupon ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                  <div className="text-sm">
                    <p className="font-medium text-emerald-900">✓ {couponCode.toUpperCase()}</p>
                    <p className="text-xs text-emerald-700">-{coupon.discount.toLocaleString('tr-TR')} TL indirim</p>
                  </div>
                  <button type="button" onClick={clearCoupon} className="text-emerald-700 hover:text-emerald-900">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => { setCouponCode(e.target.value); setCouponError(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } }}
                    placeholder="KUPON KODU"
                    className="input font-mono uppercase"
                  />
                  <button type="button" onClick={() => applyCoupon()} disabled={!couponCode.trim() || couponChecking} className="btn-secondary shrink-0">
                    {couponChecking ? '...' : 'Uygula'}
                  </button>
                </div>
              )}
              {couponError && <p className="text-xs text-red-600 mt-1">{couponError}</p>}
            </div>

            <div className="p-3 bg-slate-50 rounded-lg mb-4 space-y-1">
              {coupon && (
                <>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Baz tutar</span>
                    <span className="line-through">{base.toLocaleString('tr-TR')} TL</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-emerald-700">
                    <span>İndirim</span>
                    <span>-{coupon.discount.toLocaleString('tr-TR')} TL</span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between border-t border-slate-200 pt-1">
                <span className="text-sm text-slate-600">Toplam</span>
                <span className="text-xl font-bold text-slate-900">{total.toLocaleString('tr-TR')} TL</span>
              </div>
            </div>

            <button onClick={startUpgrade} disabled={!selectedMethod || starting} className="btn-primary w-full">
              {starting ? 'Yönlendiriliyor...' : 'Ödemeye Geç'}
              <ArrowRight size={16} />
            </button>
          </>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}

function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
