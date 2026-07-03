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
  Info,
  Landmark,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/lib/toast';

interface BillingMethod {
  id: string;
  type: 'PAYTR' | 'IYZICO' | 'IBAN';
  label: string;
  isActive: boolean;
  ibanInfo: string | null;
  createdAt: string;
  credentialsPreview: Record<string, string>;
}

export default function BillingMethodsPage() {
  const [methods, setMethods] = useState<BillingMethod[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    const r = await api.get<{ methods: BillingMethod[] }>('/admin/billing-methods');
    setMethods(r.methods);
  }
  useEffect(() => { load(); }, []);

  async function toggle(id: string, isActive: boolean) {
    try {
      await api.patch(`/admin/billing-methods/${id}`, { isActive: !isActive });
      await load();
      toast.success(isActive ? 'Yöntem pasifleştirildi' : 'Yöntem aktifleştirildi');
    } catch (err) {
      toast.error('İşlem başarısız', err instanceof ApiError ? err.message : 'Sunucu hatası');
    }
  }

  async function remove(id: string) {
    if (!confirm('Bu tahsilat yöntemini silmek istediğine emin misin?')) return;
    try {
      await api.delete(`/admin/billing-methods/${id}`);
      await load();
      toast.success('Yöntem silindi');
    } catch (err) {
      toast.error('Silinemedi', err instanceof ApiError ? err.message : 'Sunucu hatası');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tahsilat Yöntemleri</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kullanıcılarından SaaS aboneliklerini tahsil etmek için kullandığın PayTR / Iyzico / IBAN
          </p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary">
          {showAdd ? <><X size={16} /> İptal</> : <><Plus size={16} /> Yeni Yöntem</>}
        </button>
      </div>

      <div className="card p-4 bg-blue-50 border-blue-200 flex gap-3 items-start">
        <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <strong>Nasıl çalışır:</strong> Buradaki yöntemler kullanıcı planı yükseltirken
          &quot;Aboneliğim&quot; sayfasında görünür. PayTR/Iyzico ile otomatik tahsilat, IBAN ile
          manuel onay akışı çalışır.
        </div>
      </div>

      {showAdd && <AddForm onSaved={() => { setShowAdd(false); load(); }} />}

      {methods === null ? (
        <div className="card p-6"><div className="skeleton h-16" /></div>
      ) : methods.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-4">
            <CreditCard size={26} />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Henüz tahsilat yöntemi yok</h3>
          <p className="text-slate-500 max-w-md mx-auto mb-6">
            İlk yöntemi ekleyerek kullanıcılardan tahsilat alabilirsin
          </p>
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus size={16} /> İlk Yöntemi Ekle
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {methods.map((m) => (
            <MethodCard key={m.id} method={m} onToggle={() => toggle(m.id, m.isActive)} onDelete={() => remove(m.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function MethodCard({ method, onToggle, onDelete }: { method: BillingMethod; onToggle: () => void; onDelete: () => void }) {
  const typeLabel = { PAYTR: 'PayTR', IYZICO: 'Iyzico', IBAN: 'IBAN' }[method.type];
  const typeColor = {
    PAYTR: 'bg-blue-50 text-blue-600',
    IYZICO: 'bg-purple-50 text-purple-600',
    IBAN: 'bg-emerald-50 text-emerald-600',
  }[method.type];
  const Icon = method.type === 'IBAN' ? Landmark : CreditCard;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${typeColor}`}>
            <Icon size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-slate-900">{method.label}</h3>
              <span className="badge-neutral">{typeLabel}</span>
              {method.isActive ? <span className="badge-success">Aktif</span> : <span className="badge-warning">Pasif</span>}
              {method.type !== 'IBAN' && method.credentialsPreview.test_mode === '1' && (
                <span className="badge-info">Sandbox</span>
              )}
              {method.type === 'IYZICO' && method.credentialsPreview.sandbox === '1' && (
                <span className="badge-info">Sandbox</span>
              )}
            </div>
            {method.type === 'IBAN' && method.ibanInfo && (
              <pre className="mt-2 text-xs text-slate-600 font-mono whitespace-pre-wrap">{method.ibanInfo}</pre>
            )}
            {method.type !== 'IBAN' && (
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                {Object.entries(method.credentialsPreview)
                  .filter(([k]) => k !== 'test_mode' && k !== 'sandbox')
                  .map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-slate-500">
                      <span className="font-medium">{k}:</span>
                      <code className="font-mono text-slate-700 break-all">{v}</code>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onToggle} className={method.isActive ? 'btn-secondary btn-sm' : 'btn-success btn-sm'}>
            <Power size={14} /> {method.isActive ? 'Pasifleştir' : 'Aktifleştir'}
          </button>
          <button onClick={onDelete} className="btn-danger-ghost btn-sm btn-icon" title="Sil">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function AddForm({ onSaved }: { onSaved: () => void }) {
  const [type, setType] = useState<'PAYTR' | 'IYZICO' | 'IBAN'>('IBAN');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // IBAN
  const [ibanInfo, setIbanInfo] = useState('');

  // PayTR
  const [merchantId, setMerchantId] = useState('');
  const [merchantKey, setMerchantKey] = useState('');
  const [merchantSalt, setMerchantSalt] = useState('');
  const [paytrTest, setPaytrTest] = useState(true);

  // Iyzico
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [iyzicoSandbox, setIyzicoSandbox] = useState(true);

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
          test_mode: paytrTest ? '1' : '0',
        };
      } else if (type === 'IYZICO') {
        credentials = {
          apiKey: apiKey.trim(),
          secretKey: secretKey.trim(),
          sandbox: iyzicoSandbox ? '1' : '0',
        };
      }
      await api.post('/admin/billing-methods', {
        type,
        label: label.trim(),
        credentials,
        ibanInfo: type === 'IBAN' ? ibanInfo : undefined,
        isActive: true,
      });
      toast.success('Tahsilat yöntemi eklendi');
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
        <h3 className="font-semibold text-slate-900">Yeni Tahsilat Yöntemi</h3>
        <p className="text-sm text-slate-500 mt-0.5">Kullanıcılardan tahsilat için kullanacağın hesap</p>
      </div>

      <div>
        <label className="label">Sağlayıcı</label>
        <div className="grid grid-cols-3 gap-2">
          {(['IBAN', 'PAYTR', 'IYZICO'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setType(t)}
              className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                type === t ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}>
              {t === 'IBAN' ? 'IBAN' : t === 'PAYTR' ? 'PayTR' : 'Iyzico'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Etiket</label>
        <input required value={label} onChange={(e) => setLabel(e.target.value)}
          placeholder={type === 'IBAN' ? 'Ana banka hesabım' : 'Ana PayTR / Iyzico'} className="input" />
      </div>

      {type === 'IBAN' && (
        <div>
          <label className="label">IBAN Bilgileri (kullanıcıya gösterilecek)</label>
          <textarea rows={4} value={ibanInfo} onChange={(e) => setIbanInfo(e.target.value)}
            className="input font-mono text-sm"
            placeholder={'Adı Soyadı: ...\nIBAN: TR00 ...\nAçıklama: e-posta'}
          />
        </div>
      )}

      {type === 'PAYTR' && (
        <>
          <div className="border-t border-slate-200 pt-4 flex items-center gap-2">
            <Lock size={14} className="text-slate-500" />
            <h4 className="font-medium text-sm text-slate-900">PayTR Credentials</h4>
          </div>
          <div>
            <label className="label">Mağaza No</label>
            <input required value={merchantId} onChange={(e) => setMerchantId(e.target.value)} className="input font-mono" />
          </div>
          <div>
            <label className="label">Mağaza Anahtarı</label>
            <input required type="password" value={merchantKey} onChange={(e) => setMerchantKey(e.target.value)} className="input font-mono" />
          </div>
          <div>
            <label className="label">Mağaza Salt</label>
            <input required type="password" value={merchantSalt} onChange={(e) => setMerchantSalt(e.target.value)} className="input font-mono" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={paytrTest} onChange={(e) => setPaytrTest(e.target.checked)} className="w-4 h-4 rounded border-slate-300" />
            <span><strong>Sandbox / Test</strong> — gerçek tahsilat olmaz</span>
          </label>
        </>
      )}

      {type === 'IYZICO' && (
        <>
          <div className="border-t border-slate-200 pt-4 flex items-center gap-2">
            <Lock size={14} className="text-slate-500" />
            <h4 className="font-medium text-sm text-slate-900">Iyzico Credentials</h4>
          </div>
          <div>
            <label className="label">API Key</label>
            <input required value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="input font-mono text-sm" />
          </div>
          <div>
            <label className="label">Secret Key</label>
            <input required type="password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} className="input font-mono text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={iyzicoSandbox} onChange={(e) => setIyzicoSandbox(e.target.checked)} className="w-4 h-4 rounded border-slate-300" />
            <span><strong>Sandbox / Test</strong> — sandbox-api.iyzipay.com</span>
          </label>
        </>
      )}

      {error && <div className="text-sm text-red-600 flex items-center gap-1.5"><AlertCircle size={14} /> {error}</div>}

      <button type="submit" disabled={saving} className="btn-primary">
        <CheckCircle2 size={16} /> {saving ? 'Kaydediliyor...' : 'Yöntemi Ekle'}
      </button>
    </form>
  );
}
