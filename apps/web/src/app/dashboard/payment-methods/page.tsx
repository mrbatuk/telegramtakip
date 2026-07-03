'use client';
import { useEffect, useState } from 'react';
import {
  CreditCard,
  Plus,
  X,
  Trash2,
  Power,
  AlertCircle,
  CheckCircle2,
  Lock,
  ExternalLink,
  Info,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/lib/toast';

interface PaymentMethod {
  id: string;
  type: 'PAYTR' | 'IYZICO' | 'STRIPE';
  label: string;
  isActive: boolean;
  createdAt: string;
  credentialsPreview: Record<string, string>;
}

export default function PaymentMethodsPage() {
  const [methods, setMethods] = useState<PaymentMethod[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    const r = await api.get<{ methods: PaymentMethod[] }>('/payment-methods');
    setMethods(r.methods);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(id: string, isActive: boolean) {
    try {
      await api.patch(`/payment-methods/${id}`, { isActive: !isActive });
      await load();
      toast.success(isActive ? 'Yöntem pasifleştirildi' : 'Yöntem aktifleştirildi');
    } catch (err) {
      toast.error(
        'İşlem başarısız',
        err instanceof ApiError ? err.message : 'Sunucu hatası',
      );
    }
  }

  async function remove(id: string) {
    if (!confirm('Bu ödeme yöntemini silmek istediğine emin misin?')) return;
    try {
      await api.delete(`/payment-methods/${id}`);
      await load();
      toast.success('Ödeme yöntemi silindi');
    } catch (err) {
      toast.error(
        'Silinemedi',
        err instanceof ApiError ? err.message : 'Sunucu hatası',
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Ödeme Yöntemleri</h1>
          <p className="text-sm text-slate-500 mt-1">
            PayTR, Iyzico (TR) veya Stripe (global) merchant hesabını bağla — kullanıcı kartla ödesin, sistem otomatik onaylasın
          </p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary">
          {showAdd ? (
            <>
              <X size={16} /> İptal
            </>
          ) : (
            <>
              <Plus size={16} /> Yeni Yöntem
            </>
          )}
        </button>
      </div>

      <div className="card p-4 bg-blue-50 border-blue-200 flex gap-3 items-start">
        <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <strong>Önemli:</strong> Ödeme doğrudan senin merchant hesabına gider, biz aracı olmuyoruz.
          PayTR/Iyzico/Stripe merchant başvuru sürecini sen tamamlarsın — credential'ları aldıktan sonra buraya gir.
        </div>
      </div>

      {showAdd && <AddMethodForm onSaved={() => { setShowAdd(false); load(); }} />}

      {methods === null ? (
        <div className="card p-6 space-y-3">
          <div className="skeleton h-16" />
        </div>
      ) : methods.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-4">
            <CreditCard size={26} />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Henüz ödeme yöntemi yok
          </h3>
          <p className="text-slate-500 max-w-md mx-auto mb-6">
            Şu an sadece IBAN dekontu ile manuel onay çalışıyor. PayTR/Iyzico/Stripe ekleyince kartla
            otomatik tahsilat aktif olur.
          </p>
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus size={16} /> İlk Yöntemi Ekle
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {methods.map((m) => (
            <MethodCard
              key={m.id}
              method={m}
              onToggle={() => toggle(m.id, m.isActive)}
              onDelete={() => remove(m.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MethodCard({
  method,
  onToggle,
  onDelete,
}: {
  method: PaymentMethod;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const typeLabel = {
    PAYTR: 'PayTR',
    IYZICO: 'Iyzico',
    STRIPE: 'Stripe',
  }[method.type];

  const typeColor = {
    PAYTR: 'bg-blue-50 text-blue-600',
    IYZICO: 'bg-purple-50 text-purple-600',
    STRIPE: 'bg-indigo-50 text-indigo-600',
  }[method.type];

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${typeColor}`}>
            <CreditCard size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-slate-900">{method.label}</h3>
              <span className="badge-neutral">{typeLabel}</span>
              {method.isActive ? (
                <span className="badge-success">Aktif</span>
              ) : (
                <span className="badge-warning">Pasif</span>
              )}
              {method.credentialsPreview.test_mode === '1' && (
                <span className="badge-info">Sandbox</span>
              )}
            </div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
              {Object.entries(method.credentialsPreview)
                .filter(([k]) => k !== 'test_mode')
                .map(([k, v]) => (
                  <div key={k} className="flex gap-2 text-slate-500">
                    <span className="font-medium">{k}:</span>
                    <code className="font-mono text-slate-700 break-all">{v}</code>
                  </div>
                ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onToggle}
            className={method.isActive ? 'btn-secondary btn-sm' : 'btn-success btn-sm'}
          >
            <Power size={14} />
            {method.isActive ? 'Pasifleştir' : 'Aktifleştir'}
          </button>
          <button
            onClick={onDelete}
            className="btn-danger-ghost btn-sm btn-icon"
            title="Sil"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function AddMethodForm({ onSaved }: { onSaved: () => void }) {
  const [type, setType] = useState<'PAYTR' | 'IYZICO' | 'STRIPE'>('PAYTR');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // PayTR
  const [merchantId, setMerchantId] = useState('');
  const [merchantKey, setMerchantKey] = useState('');
  const [merchantSalt, setMerchantSalt] = useState('');
  const [testMode, setTestMode] = useState(true);

  // Iyzico
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [iyzicoSandbox, setIyzicoSandbox] = useState(true);

  // Stripe
  const [stripeSecret, setStripeSecret] = useState('');
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('');
  const [stripeCurrency, setStripeCurrency] = useState<'try' | 'usd' | 'eur'>('try');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      let credentials: Record<string, string> = {};
      if (type === 'PAYTR') {
        credentials = {
          merchant_id: merchantId.trim(),
          merchant_key: merchantKey.trim(),
          merchant_salt: merchantSalt.trim(),
          test_mode: testMode ? '1' : '0',
        };
      } else if (type === 'IYZICO') {
        credentials = {
          apiKey: apiKey.trim(),
          secretKey: secretKey.trim(),
          sandbox: iyzicoSandbox ? '1' : '0',
        };
      } else if (type === 'STRIPE') {
        credentials = {
          secretKey: stripeSecret.trim(),
          webhookSecret: stripeWebhookSecret.trim(),
          currency: stripeCurrency,
        };
      }

      await api.post('/payment-methods', {
        type,
        label: label.trim(),
        credentials,
        isActive: true,
      });
      toast.success('Ödeme yöntemi eklendi', `${type} — ${label}`);
      onSaved();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Kaydedilemedi';
      setError(msg);
      toast.error('Kaydedilemedi', msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card p-6 space-y-4">
      <div>
        <h3 className="font-semibold text-slate-900">Yeni Ödeme Yöntemi</h3>
        <p className="text-sm text-slate-500 mt-0.5">
          Merchant hesabından aldığın bilgileri gir
        </p>
      </div>

      <div>
        <label className="label">Sağlayıcı</label>
        <div className="grid grid-cols-3 gap-2">
          {(['PAYTR', 'IYZICO', 'STRIPE'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                type === t
                  ? 'border-brand-600 bg-brand-50 text-brand-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t === 'PAYTR' ? 'PayTR' : t === 'IYZICO' ? 'Iyzico' : 'Stripe'}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {type === 'STRIPE'
            ? 'Global — kart ödemesi, çoklu para birimi'
            : 'Türkiye — TL kart tahsilatı'}
        </p>
      </div>

      <div>
        <label className="label">Etiket</label>
        <input
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ana PayTR hesabım"
          className="input"
        />
        <p className="text-xs text-slate-500 mt-1">Birden fazla hesabın olursa ayırt etmek için</p>
      </div>

      {type === 'PAYTR' && (
        <>
          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Lock size={14} className="text-slate-500" />
              <h4 className="font-medium text-sm text-slate-900">PayTR Credentials</h4>
              <a
                href="https://www.paytr.com/magaza/giris"
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-xs text-brand-600 hover:underline inline-flex items-center gap-0.5"
              >
                PayTR'ye git
                <ExternalLink size={11} />
              </a>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              PayTR mağaza panelinden → <strong>Bilgi</strong> sekmesi → API Bilgileri
            </p>
          </div>

          <div>
            <label className="label">Mağaza No (merchant_id)</label>
            <input
              required
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
              className="input font-mono"
              placeholder="123456"
            />
          </div>
          <div>
            <label className="label">Mağaza Anahtarı (merchant_key)</label>
            <input
              required
              type="password"
              value={merchantKey}
              onChange={(e) => setMerchantKey(e.target.value)}
              className="input font-mono"
            />
          </div>
          <div>
            <label className="label">Mağaza Salt (merchant_salt)</label>
            <input
              required
              type="password"
              value={merchantSalt}
              onChange={(e) => setMerchantSalt(e.target.value)}
              className="input font-mono"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={testMode}
              onChange={(e) => setTestMode(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300"
            />
            <span>
              <strong>Sandbox / Test modu</strong> — gerçek tahsilat olmaz, kart bilgileriyle deneme yapılır
            </span>
          </label>
        </>
      )}

      {type === 'IYZICO' && (
        <>
          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Lock size={14} className="text-slate-500" />
              <h4 className="font-medium text-sm text-slate-900">Iyzico Credentials</h4>
              <a
                href="https://sandbox-merchant.iyzipay.com/"
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-xs text-brand-600 hover:underline inline-flex items-center gap-0.5"
              >
                Iyzico merchant paneli
                <ExternalLink size={11} />
              </a>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Iyzico Merchant Panel → <strong>Ayarlar → API Anahtarları</strong>
            </p>
          </div>

          <div>
            <label className="label">API Key</label>
            <input
              required
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="input font-mono text-sm"
              placeholder="sandbox-XXXXXXXX..."
            />
          </div>
          <div>
            <label className="label">Secret Key</label>
            <input
              required
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              className="input font-mono text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={iyzicoSandbox}
              onChange={(e) => setIyzicoSandbox(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300"
            />
            <span>
              <strong>Sandbox / Test modu</strong> — sandbox-api.iyzipay.com'a bağlanır
            </span>
          </label>
        </>
      )}

      {type === 'STRIPE' && (
        <>
          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Lock size={14} className="text-slate-500" />
              <h4 className="font-medium text-sm text-slate-900">Stripe Credentials</h4>
              <a
                href="https://dashboard.stripe.com/apikeys"
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-xs text-brand-600 hover:underline inline-flex items-center gap-0.5"
              >
                Stripe Dashboard
                <ExternalLink size={11} />
              </a>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Stripe Dashboard → <strong>Developers → API keys</strong> (Secret key) ve{' '}
              <strong>Developers → Webhooks</strong> (Signing secret)
            </p>
          </div>

          <div>
            <label className="label">Secret Key</label>
            <input
              required
              type="password"
              value={stripeSecret}
              onChange={(e) => setStripeSecret(e.target.value)}
              className="input font-mono text-sm"
              placeholder="sk_test_... veya sk_live_..."
            />
            <p className="text-xs text-slate-500 mt-1">Test için sk_test_, canlı için sk_live_</p>
          </div>
          <div>
            <label className="label">Webhook Signing Secret</label>
            <input
              required
              type="password"
              value={stripeWebhookSecret}
              onChange={(e) => setStripeWebhookSecret(e.target.value)}
              className="input font-mono text-sm"
              placeholder="whsec_..."
            />
            <p className="text-xs text-slate-500 mt-1">
              Webhook URL: <code className="bg-slate-100 px-1 rounded">/pay/stripe/webhook/&lt;methodId&gt;</code>{' '}
              — Event: <code className="bg-slate-100 px-1 rounded">checkout.session.completed</code>
            </p>
          </div>
          <div>
            <label className="label">Para Birimi</label>
            <div className="grid grid-cols-3 gap-2">
              {(['try', 'usd', 'eur'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setStripeCurrency(c)}
                  className={`p-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    stripeCurrency === c
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {c.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {error && (
        <div className="text-sm text-red-600 flex items-center gap-1.5">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary">
          <CheckCircle2 size={16} />
          {saving ? 'Kaydediliyor...' : 'Yöntemi Ekle'}
        </button>
      </div>
    </form>
  );
}
