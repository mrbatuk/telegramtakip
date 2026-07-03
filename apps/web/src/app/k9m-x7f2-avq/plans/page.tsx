'use client';
import { useEffect, useState } from 'react';
import {
  Crown,
  Plus,
  X,
  Trash2,
  Edit3,
  Save,
  AlertCircle,
  Eye,
  EyeOff,
  Info,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/lib/toast';

interface Plan {
  id: string;
  key: string;
  name: string;
  description: string | null;
  monthlyPriceTRY: string;
  maxBots: number;
  maxChannelsPerBot: number;
  maxActiveMembers: number;
  allowedPaymentMethods: string[];
  features: string[];
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  quarterlyMultiplier: string | null;
  yearlyMultiplier: string | null;
}

const PAYMENT_TYPES = ['IBAN', 'PAYTR', 'IYZICO', 'STRIPE', 'USDT_TRC20'];

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    const r = await api.get<{ plans: Plan[] }>('/admin/plans');
    setPlans(r.plans);
  }
  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    if (!confirm('Bu planı silmek istediğine emin misin?')) return;
    try {
      await api.delete(`/admin/plans/${id}`);
      await load();
      toast.success('Plan silindi');
    } catch (err) {
      toast.error('Silinemedi', err instanceof ApiError ? err.message : 'Sunucu hatası');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Planlar</h1>
          <p className="text-sm text-slate-500 mt-1">
            Fiyat, limit ve özellikleri buradan yönet. Landing + tenant paneli anında güncellenir.
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary">
          <Plus size={16} /> Yeni Plan
        </button>
      </div>

      <div className="card p-4 bg-blue-50 border-blue-200 flex gap-3 items-start">
        <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <strong>İpucu:</strong> Fiyatı değiştirdiğinde mevcut kullanıcılar bir sonraki
          yenilemede yeni fiyattan öder. Anlık iptal yoktur. Plan silmek yerine
          &quot;Yeni Kayıtlara Kapalı&quot; yapabilirsin.
        </div>
      </div>

      {plans === null ? (
        <div className="card p-6"><div className="skeleton h-32" /></div>
      ) : (
        <div className="space-y-3">
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} onEdit={() => setEditing(p)} onDelete={() => remove(p.id)} />
          ))}
        </div>
      )}

      {(editing || creating) && (
        <PlanForm
          plan={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={async () => { setEditing(null); setCreating(false); await load(); }}
        />
      )}
    </div>
  );
}

function PlanCard({ plan, onEdit, onDelete }: { plan: Plan; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="card p-5">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
          <Crown size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900">{plan.name}</h3>
            <span className="badge-neutral">{plan.key}</span>
            {plan.isActive ? <span className="badge-success">Aktif</span> : <span className="badge-warning">Kapalı</span>}
            {!plan.isPublic && <span className="badge-info"><EyeOff size={10} /> Gizli</span>}
          </div>
          {plan.description && <p className="text-xs text-slate-500 mt-0.5">{plan.description}</p>}
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-600">
            <div><span className="font-medium">Fiyat:</span> {Number(plan.monthlyPriceTRY).toLocaleString('tr-TR')} TL/ay</div>
            <div><span className="font-medium">Max bot:</span> {plan.maxBots}</div>
            <div><span className="font-medium">Kanal/bot:</span> {plan.maxChannelsPerBot}</div>
            <div><span className="font-medium">Max üye:</span> {plan.maxActiveMembers.toLocaleString('tr-TR')}</div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {plan.allowedPaymentMethods.map((m) => (
              <span key={m} className="badge-neutral text-[10px]">{m}</span>
            ))}
          </div>
          {plan.features.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-brand-600 cursor-pointer hover:underline">
                {plan.features.length} özellik göster
              </summary>
              <ul className="mt-2 text-xs text-slate-600 space-y-0.5 pl-4 list-disc">
                {plan.features.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </details>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button onClick={onEdit} className="btn-secondary btn-sm"><Edit3 size={13} /> Düzenle</button>
          <button onClick={onDelete} className="btn-danger-ghost btn-sm"><Trash2 size={13} /> Sil</button>
        </div>
      </div>
    </div>
  );
}

function PlanForm({ plan, onClose, onSaved }: { plan: Plan | null; onClose: () => void; onSaved: () => void }) {
  const isNew = !plan;
  const [key, setKey] = useState(plan?.key ?? '');
  const [name, setName] = useState(plan?.name ?? '');
  const [description, setDescription] = useState(plan?.description ?? '');
  const [price, setPrice] = useState(plan ? plan.monthlyPriceTRY : '399');
  const [maxBots, setMaxBots] = useState(String(plan?.maxBots ?? 1));
  const [maxCh, setMaxCh] = useState(String(plan?.maxChannelsPerBot ?? 1));
  const [maxMem, setMaxMem] = useState(String(plan?.maxActiveMembers ?? 200));
  const [payments, setPayments] = useState<string[]>(plan?.allowedPaymentMethods ?? ['IBAN']);
  const [features, setFeatures] = useState<string[]>(plan?.features ?? ['']);
  const [isActive, setIsActive] = useState(plan?.isActive ?? true);
  const [isPublic, setIsPublic] = useState(plan?.isPublic ?? true);
  const [sortOrder, setSortOrder] = useState(String(plan?.sortOrder ?? 0));
  const [quarterly, setQuarterly] = useState(plan?.quarterlyMultiplier ?? '');
  const [yearly, setYearly] = useState(plan?.yearlyMultiplier ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function togglePayment(p: string) {
    setPayments((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const cleanFeatures = features.map((f) => f.trim()).filter((f) => f.length > 0);
      const body = {
        key: key.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim() || null,
        monthlyPriceTRY: parseFloat(price),
        maxBots: parseInt(maxBots, 10),
        maxChannelsPerBot: parseInt(maxCh, 10),
        maxActiveMembers: parseInt(maxMem, 10),
        allowedPaymentMethods: payments,
        features: cleanFeatures,
        isActive,
        isPublic,
        sortOrder: parseInt(sortOrder, 10) || 0,
        quarterlyMultiplier: quarterly ? parseFloat(quarterly) : null,
        yearlyMultiplier: yearly ? parseFloat(yearly) : null,
      };
      if (isNew) await api.post('/admin/plans', body);
      else await api.patch(`/admin/plans/${plan!.id}`, body);
      toast.success(isNew ? 'Plan oluşturuldu' : 'Plan güncellendi');
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
    <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-[60] p-4 overflow-y-auto">
      <form onSubmit={onSubmit} className="card p-6 max-w-2xl w-full my-8 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">{isNew ? 'Yeni Plan' : `${plan!.name} Düzenle`}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-900"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Kısa Ad (Key)</label>
            <input required value={key} onChange={(e) => setKey(e.target.value.toUpperCase())} className="input font-mono" placeholder="STARTER, PRO, AGENCY..." />
            <p className="text-xs text-slate-500 mt-1">Sadece büyük harf, rakam, - ve _</p>
          </div>
          <div>
            <label className="label">Görünen Ad</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Starter" />
          </div>
        </div>

        <div>
          <label className="label">Açıklama (opsiyonel)</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="input" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="label">Aylık Fiyat (TL)</label>
            <input type="number" required min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Max Bot</label>
            <input type="number" required min={1} value={maxBots} onChange={(e) => setMaxBots(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Kanal/Bot</label>
            <input type="number" required min={1} value={maxCh} onChange={(e) => setMaxCh(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Max Aktif Üye</label>
            <input type="number" required min={1} value={maxMem} onChange={(e) => setMaxMem(e.target.value)} className="input" />
          </div>
        </div>

        <div>
          <label className="label">İzinli Ödeme Yöntemleri</label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {PAYMENT_TYPES.map((p) => (
              <label key={p} className={`cursor-pointer border rounded-lg p-2 text-center text-xs transition-colors ${
                payments.includes(p) ? 'border-brand-600 bg-brand-50 text-brand-700 font-medium' : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <input type="checkbox" checked={payments.includes(p)} onChange={() => togglePayment(p)} className="hidden" />
                {p}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Özellikler (landing'de gösterilir)</label>
          <div className="space-y-2">
            {features.map((f, i) => (
              <div key={i} className="flex gap-2">
                <input value={f} onChange={(e) => setFeatures((prev) => prev.map((v, j) => j === i ? e.target.value : v))} className="input" placeholder="Örn: 1 bot" />
                <button type="button" onClick={() => setFeatures((prev) => prev.filter((_, j) => j !== i))} className="btn-danger-ghost btn-sm">
                  <X size={13} />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setFeatures((prev) => [...prev, ''])} className="btn-ghost btn-sm">
              <Plus size={13} /> Özellik Ekle
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t pt-4">
          <div>
            <label className="label">Sıralama</label>
            <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="input" />
            <p className="text-xs text-slate-500 mt-1">Küçük olan önce</p>
          </div>
          <div>
            <label className="label">3 Ay İndirim Çarpanı</label>
            <input type="number" step="0.01" min={0} max={1} value={quarterly} onChange={(e) => setQuarterly(e.target.value)} placeholder="0.90 = %10 indirim" className="input" />
          </div>
          <div>
            <label className="label">Yıllık İndirim Çarpanı</label>
            <input type="number" step="0.01" min={0} max={1} value={yearly} onChange={(e) => setYearly(e.target.value)} placeholder="0.80 = %20 indirim" className="input" />
          </div>
        </div>

        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 rounded" />
            <Eye size={13} /> Yeni Kayıtlara Aktif
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="w-4 h-4 rounded" />
            <Eye size={13} /> Landing'de Göster
          </label>
        </div>

        {error && <div className="text-sm text-red-600 flex items-center gap-1.5"><AlertCircle size={14} /> {error}</div>}

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={saving} className="btn-primary">
            <Save size={16} /> {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">İptal</button>
        </div>
      </form>
    </div>
  );
}
