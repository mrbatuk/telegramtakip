'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Wallet,
  Plus,
  X,
  AlertCircle,
  Trash2,
  Search,
  TrendingUp,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/lib/toast';
import { ADMIN_PATH } from '@/lib/admin-path';

interface Subscription {
  id: string;
  tenantId: string;
  plan: string;
  amount: string;
  currency: string;
  method: string;
  periodStart: string;
  periodEnd: string;
  note: string | null;
  createdAt: string;
  tenant: { id: string; email: string; fullName: string | null };
}

interface TenantOption {
  id: string;
  email: string;
  fullName: string | null;
}

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[] | null>(null);
  const [totalAmount, setTotalAmount] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');

  async function load() {
    const r = await api.get<{
      subscriptions: Subscription[];
      totalAmount: number;
    }>('/admin/subscriptions');
    setSubs(r.subscriptions);
    setTotalAmount(r.totalAmount);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!subs) return null;
    const q = search.trim().toLowerCase();
    if (!q) return subs;
    return subs.filter(
      (s) =>
        s.tenant.email.toLowerCase().includes(q) ||
        (s.tenant.fullName ?? '').toLowerCase().includes(q) ||
        s.plan.toLowerCase().includes(q) ||
        s.method.toLowerCase().includes(q),
    );
  }, [subs, search]);

  async function remove(id: string) {
    if (!confirm('Bu ödeme kaydını silmek istediğine emin misin?')) return;
    try {
      await api.delete(`/admin/subscriptions/${id}`);
      await load();
      toast.success('Ödeme kaydı silindi');
    } catch (err) {
      toast.error(
        'Silinemedi',
        err instanceof ApiError ? err.message : 'Sunucu hatası',
      );
    }
  }

  // Bu ay & geçen ay toplamlarını hesapla
  const thisMonth = useMemo(() => {
    if (!subs) return 0;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return subs
      .filter((s) => new Date(s.createdAt) >= start)
      .reduce((sum, s) => sum + parseFloat(s.amount), 0);
  }, [subs]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Abonelik Gelirleri</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kullanıcılarından aldığın SaaS abonelik ödemelerinin kaydı
          </p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary">
          {showAdd ? (
            <>
              <X size={16} /> İptal
            </>
          ) : (
            <>
              <Plus size={16} /> Yeni Ödeme Kaydı
            </>
          )}
        </button>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <RevCard label="Bu Ay" amount={thisMonth} highlight />
        <RevCard label="Toplam (Tüm Zamanlar)" amount={totalAmount} />
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-600">Toplam Kayıt</p>
            <TrendingUp size={18} className="text-slate-400" />
          </div>
          <p className="text-3xl font-bold text-slate-900">{subs?.length ?? '—'}</p>
        </div>
      </div>

      {showAdd && <AddSubForm onSaved={() => { setShowAdd(false); load(); }} />}

      {/* Arama */}
      <div className="relative md:max-w-md">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Kullanıcı, plan veya yöntem ara..."
          className="input pl-9"
        />
      </div>

      {filtered === null ? (
        <div className="card p-6 space-y-3">
          <div className="skeleton h-12" />
          <div className="skeleton h-12" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <Wallet size={26} />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">
            {search ? 'Aramana uygun kayıt yok' : 'Henüz ödeme kaydı yok'}
          </h3>
          <p className="text-sm text-slate-500">
            Kullanıcılardan tahsilat aldıkça buraya kaydet
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                <th className="px-5 py-3">Kullanıcı</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3 text-right">Tutar</th>
                <th className="px-5 py-3">Yöntem</th>
                <th className="px-5 py-3">Dönem</th>
                <th className="px-5 py-3">Kayıt</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <Link
                      href={`${ADMIN_PATH}/tenants/${s.tenantId}`}
                      className="text-brand-600 hover:underline"
                    >
                      {s.tenant.email}
                    </Link>
                    {s.tenant.fullName && (
                      <p className="text-xs text-slate-500">{s.tenant.fullName}</p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className="badge-neutral">{s.plan}</span>
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-emerald-700">
                    {s.amount} {s.currency}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600">{s.method}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">
                    {new Date(s.periodStart).toLocaleDateString('tr-TR')} →{' '}
                    {new Date(s.periodEnd).toLocaleDateString('tr-TR')}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">
                    {new Date(s.createdAt).toLocaleDateString('tr-TR')}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => remove(s.id)}
                      className="btn-danger-ghost btn-sm btn-icon"
                      title="Sil"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RevCard({
  label,
  amount,
  highlight,
}: {
  label: string;
  amount: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`card p-5 ${
        highlight ? 'bg-gradient-to-br from-emerald-50 to-white border-emerald-200' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <p
          className={`text-sm font-medium ${highlight ? 'text-emerald-800' : 'text-slate-600'}`}
        >
          {label}
        </p>
        <Wallet size={18} className={highlight ? 'text-emerald-600' : 'text-slate-400'} />
      </div>
      <p className={`text-3xl font-bold ${highlight ? 'text-emerald-700' : 'text-slate-900'}`}>
        {amount.toLocaleString('tr-TR')} <span className="text-lg font-medium">TL</span>
      </p>
    </div>
  );
}

function AddSubForm({ onSaved }: { onSaved: () => void }) {
  const [tenantId, setTenantId] = useState('');
  const [tenantSearch, setTenantSearch] = useState('');
  const [tenantResults, setTenantResults] = useState<TenantOption[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<TenantOption | null>(null);

  const [plan, setPlan] = useState<string>('STARTER');
  const [planOptions, setPlanOptions] = useState<Array<{ key: string; name: string; monthlyPriceTRY: string }>>([]);

  useEffect(() => {
    api.get<{ plans: Array<{ key: string; name: string; monthlyPriceTRY: string }> }>('/admin/plans')
      .then((r) => setPlanOptions(r.plans));
  }, []);
  const [amount, setAmount] = useState('399');
  const [method, setMethod] = useState<'IBAN_TRANSFER' | 'MANUAL_CASH' | 'PAYTR' | 'IYZICO' | 'OTHER'>(
    'IBAN_TRANSFER',
  );
  const [periodStart, setPeriodStart] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [periodEnd, setPeriodEnd] = useState<string>(
    new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
  );
  const [note, setNote] = useState('');
  const [extendSub, setExtendSub] = useState(true);
  const [upgradePlan, setUpgradePlan] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenantSearch || selectedTenant) {
      setTenantResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await api.get<{ tenants: TenantOption[] }>(
        `/admin/tenants?q=${encodeURIComponent(tenantSearch)}&limit=10`,
      );
      setTenantResults(r.tenants);
    }, 250);
    return () => clearTimeout(t);
  }, [tenantSearch, selectedTenant]);

  // Plan değiştikçe varsayılan tutarı güncelle
  useEffect(() => {
    const found = planOptions.find((p) => p.key === plan);
    if (found) setAmount(String(found.monthlyPriceTRY));
  }, [plan, planOptions]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) {
      setError('Kullanıcı seç');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await api.post('/admin/subscriptions', {
        tenantId,
        plan,
        amount: parseFloat(amount),
        currency: 'TRY',
        method,
        periodStart: new Date(periodStart).toISOString(),
        periodEnd: new Date(periodEnd).toISOString(),
        note: note || undefined,
        extendTenantSub: extendSub,
        upgradePlan,
      });
      toast.success(
        'Ödeme kaydedildi',
        `${amount} TL — ${plan}${extendSub ? ' · abonelik uzatıldı' : ''}`,
      );
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
        <h3 className="font-semibold text-slate-900">Yeni Ödeme Kaydı</h3>
        <p className="text-sm text-slate-500 mt-0.5">
          Ödeme aldığında elle kaydet — sistem tenant'ın plan + abonelik bitiş tarihini otomatik günceller.
        </p>
      </div>

      <div>
        <label className="label">Kullanıcı</label>
        {selectedTenant ? (
          <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
            <div>
              <p className="text-sm font-medium">{selectedTenant.email}</p>
              {selectedTenant.fullName && (
                <p className="text-xs text-slate-500">{selectedTenant.fullName}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedTenant(null);
                setTenantId('');
                setTenantSearch('');
              }}
              className="btn-ghost btn-sm"
            >
              Değiştir
            </button>
          </div>
        ) : (
          <>
            <input
              type="text"
              value={tenantSearch}
              onChange={(e) => setTenantSearch(e.target.value)}
              placeholder="E-posta ile ara..."
              className="input"
            />
            {tenantResults.length > 0 && (
              <ul className="mt-2 border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-auto">
                {tenantResults.map((t) => (
                  <li
                    key={t.id}
                    className="p-2.5 hover:bg-slate-50 cursor-pointer text-sm"
                    onClick={() => {
                      setSelectedTenant(t);
                      setTenantId(t.id);
                    }}
                  >
                    <p className="font-medium">{t.email}</p>
                    {t.fullName && <p className="text-xs text-slate-500">{t.fullName}</p>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="label">Plan</label>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="input"
          >
            {planOptions.map((p) => (
              <option key={p.key} value={p.key}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Tutar (TRY)</label>
          <input
            type="number"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label">Yöntem</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as typeof method)}
            className="input"
          >
            <option value="IBAN_TRANSFER">IBAN Transferi</option>
            <option value="MANUAL_CASH">Nakit</option>
            <option value="PAYTR">PayTR</option>
            <option value="IYZICO">Iyzico</option>
            <option value="OTHER">Diğer</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="label">Dönem Başlangıç</label>
          <input
            type="date"
            required
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label">Dönem Bitiş</label>
          <input
            type="date"
            required
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="label">Not (opsiyonel)</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="input"
          placeholder="İç not"
        />
      </div>

      <div className="border-t border-slate-200 pt-3 space-y-2">
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={extendSub}
            onChange={(e) => setExtendSub(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300"
          />
          <span>Kullanıcının abonelik bitiş tarihini otomatik güncelle</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={upgradePlan}
            onChange={(e) => setUpgradePlan(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300"
          />
          <span>Kullanıcının planını bu plan'a değiştir</span>
        </label>
      </div>

      {error && (
        <div className="text-sm text-red-600 flex items-center gap-1.5">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? 'Kaydediliyor...' : 'Ödemeyi Kaydet'}
      </button>
    </form>
  );
}
