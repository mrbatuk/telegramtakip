'use client';
import { useEffect, useState } from 'react';
import { Ticket, Plus, X, Trash2, Edit3, Save, AlertCircle, Copy } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/lib/toast';

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discountPercent: number | null;
  discountAmount: string | null;
  validUntil: string | null;
  usageLimit: number | null;
  usageCount: number;
  perTenantLimit: number | null;
  applicableToPlans: string[];
  isActive: boolean;
  createdAt: string;
  _count: { redemptions: number };
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    const r = await api.get<{ coupons: Coupon[] }>('/admin/coupons');
    setCoupons(r.coupons);
  }
  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    if (!confirm('Bu kuponu silmek istediğine emin misin?')) return;
    try {
      await api.delete(`/admin/coupons/${id}`);
      await load();
      toast.success('Kupon silindi');
    } catch (err) {
      toast.error('Silinemedi', err instanceof ApiError ? err.message : 'Sunucu hatası');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Kuponlar</h1>
          <p className="text-sm text-slate-500 mt-1">Yüzde veya sabit tutar indirim kodları — tenant abonelik ödemesinde kullanılır</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary"><Plus size={16} /> Yeni Kupon</button>
      </div>

      {coupons === null ? (
        <div className="card p-6"><div className="skeleton h-24" /></div>
      ) : coupons.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <Ticket size={26} />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">Henüz kupon yok</h3>
          <p className="text-slate-500 max-w-md mx-auto mb-6">Kampanya, ilk ay indirimi veya özel müşteri fiyatı için kupon oluştur</p>
          <button onClick={() => setCreating(true)} className="btn-primary"><Plus size={16} /> İlk Kuponu Oluştur</button>
        </div>
      ) : (
        <div className="space-y-3">
          {coupons.map((c) => (
            <CouponCard key={c.id} coupon={c} onEdit={() => setEditing(c)} onDelete={() => remove(c.id)} />
          ))}
        </div>
      )}

      {(editing || creating) && (
        <CouponForm
          coupon={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={async () => { setEditing(null); setCreating(false); await load(); }}
        />
      )}
    </div>
  );
}

function CouponCard({ coupon, onEdit, onDelete }: { coupon: Coupon; onEdit: () => void; onDelete: () => void }) {
  const usageOk = coupon.usageLimit === null || coupon.usageCount < coupon.usageLimit;
  const expired = coupon.validUntil ? new Date(coupon.validUntil) < new Date() : false;

  function copyCode() {
    navigator.clipboard.writeText(coupon.code);
    toast.info('Kupon kodu kopyalandı');
  }

  return (
    <div className="card p-5">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
          <Ticket size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={copyCode} className="font-mono font-semibold text-slate-900 hover:text-brand-600 flex items-center gap-1">
              {coupon.code} <Copy size={12} />
            </button>
            {coupon.isActive && !expired && usageOk ? <span className="badge-success">Aktif</span> :
             expired ? <span className="badge-danger">Süresi Doldu</span> :
             !usageOk ? <span className="badge-warning">Kota Doldu</span> :
             <span className="badge-warning">Kapalı</span>}
          </div>
          {coupon.description && <p className="text-xs text-slate-500 mt-1">{coupon.description}</p>}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
            <div>
              <span className="font-medium">İndirim:</span>{' '}
              {coupon.discountPercent !== null ? `%${coupon.discountPercent}` :
               coupon.discountAmount ? `${coupon.discountAmount} TL` : '—'}
            </div>
            <div>
              <span className="font-medium">Kullanım:</span>{' '}
              {coupon.usageCount} / {coupon.usageLimit ?? '∞'}
            </div>
            {coupon.perTenantLimit && (
              <div>
                <span className="font-medium">Tenant başı:</span> {coupon.perTenantLimit}
              </div>
            )}
            {coupon.validUntil && (
              <div>
                <span className="font-medium">Son:</span> {new Date(coupon.validUntil).toLocaleDateString('tr-TR')}
              </div>
            )}
            {coupon.applicableToPlans.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="font-medium">Plan:</span>
                {coupon.applicableToPlans.map((p) => <span key={p} className="badge-neutral text-[10px]">{p}</span>)}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button onClick={onEdit} className="btn-secondary btn-sm"><Edit3 size={13} /> Düzenle</button>
          <button onClick={onDelete} className="btn-danger-ghost btn-sm"><Trash2 size={13} /> Sil</button>
        </div>
      </div>
    </div>
  );
}

function CouponForm({ coupon, onClose, onSaved }: { coupon: Coupon | null; onClose: () => void; onSaved: () => void }) {
  const isNew = !coupon;
  const [code, setCode] = useState(coupon?.code ?? '');
  const [description, setDescription] = useState(coupon?.description ?? '');
  const [discountPercent, setDiscountPercent] = useState(coupon?.discountPercent?.toString() ?? '10');
  const [discountAmount, setDiscountAmount] = useState(coupon?.discountAmount ?? '');
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>(
    coupon?.discountAmount ? 'amount' : 'percent',
  );
  const [validUntil, setValidUntil] = useState(coupon?.validUntil?.slice(0, 10) ?? '');
  const [usageLimit, setUsageLimit] = useState(coupon?.usageLimit?.toString() ?? '');
  const [perTenantLimit, setPerTenantLimit] = useState(coupon?.perTenantLimit?.toString() ?? '1');
  const [applicableToPlans, setApplicableToPlans] = useState<string[]>(coupon?.applicableToPlans ?? []);
  const [isActive, setIsActive] = useState(coupon?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        code: code.trim().toUpperCase(),
        description: description.trim() || null,
        discountPercent: discountType === 'percent' ? parseInt(discountPercent, 10) : null,
        discountAmount: discountType === 'amount' ? parseFloat(discountAmount) : null,
        validUntil: validUntil ? new Date(validUntil).toISOString() : null,
        usageLimit: usageLimit ? parseInt(usageLimit, 10) : null,
        perTenantLimit: perTenantLimit ? parseInt(perTenantLimit, 10) : null,
        applicableToPlans,
        isActive,
      };
      if (isNew) await api.post('/admin/coupons', body);
      else await api.patch(`/admin/coupons/${coupon!.id}`, body);
      toast.success(isNew ? 'Kupon oluşturuldu' : 'Kupon güncellendi');
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
      <form onSubmit={onSubmit} className="card p-6 max-w-lg w-full my-8 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">{isNew ? 'Yeni Kupon' : 'Kupon Düzenle'}</h3>
          <button type="button" onClick={onClose} className="text-slate-400"><X size={18} /></button>
        </div>

        <div>
          <label className="label">Kupon Kodu</label>
          <input required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ILKAY, YAZ2026, DENEME50" className="input font-mono" />
        </div>

        <div>
          <label className="label">Açıklama (opsiyonel)</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="input" placeholder="Örn: İlk ay %20 indirim" />
        </div>

        <div>
          <label className="label">İndirim Türü</label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setDiscountType('percent')} className={`p-3 rounded-lg border text-sm font-medium ${discountType === 'percent' ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200'}`}>
              Yüzde (%)
            </button>
            <button type="button" onClick={() => setDiscountType('amount')} className={`p-3 rounded-lg border text-sm font-medium ${discountType === 'amount' ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200'}`}>
              Sabit Tutar (TL)
            </button>
          </div>
        </div>

        {discountType === 'percent' ? (
          <div>
            <label className="label">İndirim Yüzdesi</label>
            <input type="number" required min={1} max={100} value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} className="input" />
          </div>
        ) : (
          <div>
            <label className="label">İndirim Tutarı (TL)</label>
            <input type="number" required min={0} step="0.01" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} className="input" />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Son Kullanma (opsiyonel)</label>
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Toplam Kullanım Limiti</label>
            <input type="number" min={1} value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} placeholder="Sınırsız için boş" className="input" />
          </div>
        </div>

        <div>
          <label className="label">Tenant Başı Kullanım</label>
          <input type="number" min={1} value={perTenantLimit} onChange={(e) => setPerTenantLimit(e.target.value)} className="input" />
          <p className="text-xs text-slate-500 mt-1">Aynı kullanıcı kaç kez kullanabilir</p>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 rounded" />
          Aktif
        </label>

        {error && <div className="text-sm text-red-600 flex items-center gap-1.5"><AlertCircle size={14} /> {error}</div>}

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={saving} className="btn-primary"><Save size={16} /> {saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
          <button type="button" onClick={onClose} className="btn-secondary">İptal</button>
        </div>
      </form>
    </div>
  );
}
