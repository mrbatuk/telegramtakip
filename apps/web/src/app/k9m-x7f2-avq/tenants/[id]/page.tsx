'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  Bot as BotIcon,
  Hash,
  Users,
  Wallet,
  Calendar,
  Ban,
  Play,
  Trash2,
  Save,
  StickyNote,
  Zap,
  AlertCircle,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/lib/toast';
import { ADMIN_PATH } from '@/lib/admin-path';

interface TenantDetail {
  id: string;
  email: string;
  fullName: string | null;
  plan: string;
  subExpiresAt: string | null;
  isSuspended: boolean;
  suspendedReason: string | null;
  adminNotes: string | null;
  planOverride: Record<string, unknown> | null;
  lastLoginAt: string | null;
  createdAt: string;
  bots: Array<{
    id: string;
    botUsername: string;
    botName: string | null;
    channels: Array<{
      id: string;
      name: string;
      isActive: boolean;
      telegramChatId: string;
      _count: { memberships: number; joinRequests: number };
    }>;
    _count: { channels: number };
  }>;
  paymentMethods: Array<{
    id: string;
    type: string;
    label: string;
    isActive: boolean;
    createdAt: string;
  }>;
  subscriptions: Array<{
    id: string;
    plan: string;
    amount: string;
    method: string;
    periodStart: string;
    periodEnd: string;
    createdAt: string;
  }>;
}

interface TenantResponse {
  tenant: TenantDetail;
  stats: { totalRevenue: number; activeMemberships: number };
}

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<TenantResponse | null>(null);

  const [plan, setPlan] = useState<string>('STARTER');
  const [availablePlans, setAvailablePlans] = useState<Array<{ key: string; name: string; monthlyPriceTRY: string }>>([]);
  const [planOverride, setPlanOverride] = useState<string>('');
  const [subExpiresAt, setSubExpiresAt] = useState<string>('');
  const [isSuspended, setIsSuspended] = useState(false);
  const [suspendedReason, setSuspendedReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const r = await api.get<TenantResponse>(`/admin/tenants/${id}`);
    setData(r);
    setPlan(r.tenant.plan);
    setSubExpiresAt(
      r.tenant.subExpiresAt ? r.tenant.subExpiresAt.slice(0, 10) : '',
    );
    setIsSuspended(r.tenant.isSuspended);
    setSuspendedReason(r.tenant.suspendedReason ?? '');
    setAdminNotes(r.tenant.adminNotes ?? '');
    setPlanOverride(r.tenant.planOverride ? JSON.stringify(r.tenant.planOverride, null, 2) : '');
  }

  useEffect(() => {
    if (id) load();
    api
      .get<{ plans: Array<{ key: string; name: string; monthlyPriceTRY: string }> }>('/admin/plans')
      .then((r) => setAvailablePlans(r.plans));
  }, [id]);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      let overrideValue: Record<string, unknown> | null = null;
      if (planOverride.trim()) {
        try {
          overrideValue = JSON.parse(planOverride);
        } catch {
          throw new ApiError('planOverride geçerli JSON olmalı', 400, null);
        }
      }
      await api.patch(`/admin/tenants/${id}`, {
        plan,
        subExpiresAt: subExpiresAt ? new Date(subExpiresAt).toISOString() : null,
        isSuspended,
        suspendedReason: suspendedReason || null,
        adminNotes: adminNotes || null,
        planOverride: overrideValue,
      });
      await load();
      toast.success(
        'Değişiklikler kaydedildi',
        isSuspended
          ? 'Kullanıcı askıya alındı — bir sonraki giriş denemesinde reddedilecek.'
          : 'Yeni ayarlar geçerli.',
      );
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Kaydedilemedi';
      setError(msg);
      toast.error('Kaydedilemedi', msg);
    } finally {
      setSaving(false);
    }
  }

  async function extendDays(days: number) {
    if (!confirm(`Aboneliği ${days} gün uzatmak istediğine emin misin?`)) return;
    try {
      const r = await api.post<{ subExpiresAt: string }>(
        `/admin/tenants/${id}/extend`,
        { days },
      );
      await load();
      toast.success(
        `Abonelik ${days} gün uzatıldı`,
        `Yeni bitiş: ${new Date(r.subExpiresAt).toLocaleDateString('tr-TR')}`,
      );
    } catch (err) {
      toast.error(
        'Uzatılamadı',
        err instanceof ApiError ? err.message : 'Sunucu hatası',
      );
    }
  }

  async function deleteTenant() {
    if (
      !confirm(
        `${data?.tenant.email} kullanıcısını KALICI olarak silmek istediğine emin misin? ` +
          `Bağlı tüm botlar, kanallar, üyelikler, abonelikler silinir.`,
      )
    )
      return;
    try {
      await api.delete(`/admin/tenants/${id}`);
      toast.success('Kullanıcı silindi');
      router.push(`${ADMIN_PATH}/tenants`);
    } catch (err) {
      toast.error(
        'Silinemedi',
        err instanceof ApiError ? err.message : 'Sunucu hatası',
      );
    }
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-6 w-24" />
        <div className="skeleton h-32" />
      </div>
    );
  }

  const { tenant, stats } = data;
  const totalMembers = tenant.bots.reduce(
    (sum, b) =>
      sum + b.channels.reduce((s2, c) => s2 + c._count.memberships, 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`${ADMIN_PATH}/tenants`}
          className="text-sm text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 mb-2"
        >
          <ChevronLeft size={14} /> Tüm Kullanıcılar
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-semibold text-lg shrink-0">
              {tenant.email.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold text-slate-900">
                  {tenant.fullName ?? tenant.email.split('@')[0]}
                </h1>
                {tenant.isSuspended && (
                  <span className="badge-danger">
                    <Ban size={11} /> Askıda
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500">{tenant.email}</p>
              <p className="text-xs text-slate-400 mt-1">
                Kayıt: {new Date(tenant.createdAt).toLocaleDateString('tr-TR')}
                {tenant.lastLoginAt &&
                  ` · Son giriş: ${new Date(tenant.lastLoginAt).toLocaleDateString('tr-TR')}`}
              </p>
            </div>
          </div>
          <button onClick={deleteTenant} className="btn-danger btn-sm">
            <Trash2 size={14} /> Kalıcı Sil
          </button>
        </div>
      </div>

      {/* Kısa istatistik */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat icon={BotIcon} label="Bot" value={tenant.bots.length} />
        <MiniStat
          icon={Hash}
          label="Kanal"
          value={tenant.bots.reduce((s, b) => s + b._count.channels, 0)}
        />
        <MiniStat icon={Users} label="Aktif Üye" value={stats.activeMemberships} />
        <MiniStat
          icon={Wallet}
          label="Toplam Ciro (Kullanıcının)"
          value={`${stats.totalRevenue.toLocaleString('tr-TR')} TL`}
        />
      </div>

      {/* Abonelik ve plan */}
      <div className="card p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-slate-900">Abonelik Yönetimi</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Plan, abonelik süresi, askı durumu
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Plan</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="input"
            >
              {availablePlans.length === 0 && <option value={plan}>{plan}</option>}
              {availablePlans.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name} ({Number(p.monthlyPriceTRY).toLocaleString('tr-TR')} TL/ay)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={13} /> Abonelik Bitiş Tarihi
              </span>
            </label>
            <input
              type="date"
              value={subExpiresAt}
              onChange={(e) => setSubExpiresAt(e.target.value)}
              className="input"
            />
            <div className="flex gap-1 mt-2">
              <button
                type="button"
                onClick={() => extendDays(30)}
                className="btn-ghost btn-sm text-xs"
              >
                <Zap size={11} /> +30 gün
              </button>
              <button
                type="button"
                onClick={() => extendDays(90)}
                className="btn-ghost btn-sm text-xs"
              >
                <Zap size={11} /> +90 gün
              </button>
              <button
                type="button"
                onClick={() => extendDays(365)}
                className="btn-ghost btn-sm text-xs"
              >
                <Zap size={11} /> +365 gün
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isSuspended}
              onChange={(e) => setIsSuspended(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300"
            />
            <span className="text-sm font-medium text-slate-700 inline-flex items-center gap-1.5">
              {isSuspended ? <Ban size={13} className="text-red-600" /> : <Play size={13} className="text-emerald-600" />}
              {isSuspended ? 'Hesap askıda — giriş yapamaz' : 'Hesap aktif — giriş yapabilir'}
            </span>
          </label>
          {isSuspended && (
            <div className="mt-3">
              <label className="label text-xs">Askı Sebebi (kullanıcıya görünür)</label>
              <input
                type="text"
                value={suspendedReason}
                onChange={(e) => setSuspendedReason(e.target.value)}
                className="input"
                placeholder="Örn. Ödeme yapılmadı"
              />
            </div>
          )}
        </div>

        <div>
          <label className="label">
            <span className="inline-flex items-center gap-1.5">
              <StickyNote size={13} /> Admin Notları (sadece admin görür)
            </span>
          </label>
          <textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            rows={3}
            className="input"
            placeholder="İç notlar, hatırlatmalar..."
          />
        </div>

        <div>
          <label className="label">Plan Override (JSON — gelişmiş)</label>
          <textarea
            value={planOverride}
            onChange={(e) => setPlanOverride(e.target.value)}
            rows={4}
            className="input font-mono text-xs"
            placeholder={'{\n  "maxBots": 10,\n  "monthlyPriceTRY": 799\n}'}
          />
          <p className="text-xs text-slate-500 mt-1">
            Bu tenant&apos;a özel limit/fiyat ezmesi. Örn: <code className="bg-slate-100 px-1 rounded">{'{"maxBots": 5}'}</code> Pro planın botunu 5 yapar. Boş bırakılırsa plan varsayılanları kullanılır.
          </p>
        </div>

        {error && (
          <div className="text-sm text-red-600 flex items-center gap-1.5">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary">
            <Save size={16} />
            {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
          </button>
        </div>
      </div>

      {/* Botlar özet (read-only) */}
      {tenant.bots.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Botları ({tenant.bots.length})</h2>
          <div className="space-y-3">
            {tenant.bots.map((b) => (
              <div key={b.id} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <BotIcon size={15} className="text-brand-600" />
                  <p className="font-medium text-slate-900">
                    {b.botName ?? b.botUsername}
                  </p>
                  <span className="text-xs text-slate-500">@{b.botUsername}</span>
                  <span className="badge-neutral">{b._count.channels} kanal</span>
                </div>
                {b.channels.length > 0 && (
                  <ul className="text-xs text-slate-600 space-y-1 ml-6">
                    {b.channels.map((c) => (
                      <li key={c.id} className="flex items-center gap-2">
                        <Hash size={11} className="text-slate-400" />
                        {c.name}
                        {c.isActive ? (
                          <span className="badge-success text-[10px]">Aktif</span>
                        ) : (
                          <span className="badge-warning text-[10px]">Pasif</span>
                        )}
                        <span className="text-slate-400">
                          · {c._count.memberships} üye · {c._count.joinRequests} istek
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Son abonelik ödemeleri */}
      {tenant.subscriptions.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Son Abonelik Ödemeleri</h2>
            <Link href={`${ADMIN_PATH}/subscriptions?tenantId=${tenant.id}`} className="text-xs text-brand-600 hover:underline">
              Hepsini gör →
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {tenant.subscriptions.slice(0, 5).map((s) => (
              <li key={s.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{s.plan}</span>
                  <span className="text-slate-500">
                    {' '}
                    · {new Date(s.periodStart).toLocaleDateString('tr-TR')} →{' '}
                    {new Date(s.periodEnd).toLocaleDateString('tr-TR')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-emerald-700">{s.amount} TL</span>
                  <p className="text-xs text-slate-400">{s.method}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Total sub */}
      {tenant.paymentMethods.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-3">Ödeme Yöntemleri</h2>
          <ul className="space-y-2">
            {tenant.paymentMethods.map((pm) => (
              <li key={pm.id} className="flex items-center gap-2 text-sm">
                <span className="badge-neutral">{pm.type}</span>
                <span>{pm.label}</span>
                {pm.isActive ? (
                  <span className="badge-success">Aktif</span>
                ) : (
                  <span className="badge-warning">Pasif</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon size={14} />
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p className="text-lg font-semibold text-slate-900 mt-1">{value}</p>
    </div>
  );
}
