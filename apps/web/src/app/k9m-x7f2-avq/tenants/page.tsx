'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  X,
  Ban,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { ADMIN_PATH } from '@/lib/admin-path';

interface Tenant {
  id: string;
  email: string;
  fullName: string | null;
  plan: string;
  subExpiresAt: string | null;
  isSuspended: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  _count: { bots: number; subscriptions: number };
}

const PLAN_COLORS: Record<string, string> = {
  STARTER: 'bg-slate-100 text-slate-700',
  PRO: 'bg-blue-100 text-blue-700',
  BUSINESS: 'bg-purple-100 text-purple-700',
};

function isSubActive(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso) > new Date();
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [plan, setPlan] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [planOptions, setPlanOptions] = useState<Array<{ key: string; name: string }>>([]);

  useEffect(() => {
    api.get<{ plans: Array<{ key: string; name: string }> }>('/admin/plans')
      .then((r) => setPlanOptions(r.plans));
  }, []);

  async function load() {
    setTenants(null);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (plan) params.set('plan', plan);
    if (status) params.set('status', status);
    const r = await api.get<{ tenants: Tenant[]; total: number }>(
      `/admin/tenants?${params.toString()}`,
    );
    setTenants(r.tenants);
    setTotal(r.total);
  }

  useEffect(() => {
    load();
  }, [plan, status]);

  useEffect(() => {
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Kullanıcılar</h1>
        <p className="text-sm text-slate-500 mt-1">
          Tüm kayıtlı kullanıcılar — plan değiştir, abonelik uzat, askıya al
        </p>
      </div>

      {/* Filtreler */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1 md:max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="E-posta veya isim..."
            className="input pl-9"
          />
          {q && (
            <button
              onClick={() => setQ('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <select value={plan} onChange={(e) => setPlan(e.target.value)} className="input md:w-40">
          <option value="">Tüm Planlar</option>
          {planOptions.map((p) => (
            <option key={p.key} value={p.key}>{p.name}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="input md:w-44"
        >
          <option value="">Tüm Durumlar</option>
          <option value="active">Aktif Abonelik</option>
          <option value="expired">Süresi Dolan</option>
          <option value="suspended">Askıda</option>
        </select>
      </div>

      {tenants === null ? (
        <div className="card p-6 space-y-3">
          <div className="skeleton h-14" />
          <div className="skeleton h-14" />
        </div>
      ) : tenants.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <Users size={26} />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">
            {q || plan || status ? 'Aramana uygun kullanıcı yok' : 'Henüz kullanıcı yok'}
          </h3>
          <p className="text-sm text-slate-500">
            Kayıt olan kullanıcılar burada listelenir.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            {tenants.length} sonuç ({total} toplam)
          </p>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  <th className="px-5 py-3">Kullanıcı</th>
                  <th className="px-5 py-3">Plan</th>
                  <th className="px-5 py-3">Abonelik</th>
                  <th className="px-5 py-3">Bot</th>
                  <th className="px-5 py-3">Son Giriş</th>
                  <th className="px-5 py-3">Kayıt</th>
                  <th className="px-5 py-3 text-right">Aksiyon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60">
                {tenants.map((t) => {
                  const active = isSubActive(t.subExpiresAt);
                  const days = daysUntil(t.subExpiresAt);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-medium text-sm shrink-0">
                            {t.email.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-medium text-slate-900 truncate">
                                {t.fullName ?? t.email.split('@')[0]}
                              </p>
                              {t.isSuspended && (
                                <span className="badge-danger">
                                  <Ban size={10} /> Askıda
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 truncate">{t.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`badge ${PLAN_COLORS[t.plan]}`}>{t.plan}</span>
                      </td>
                      <td className="px-5 py-3">
                        {t.subExpiresAt ? (
                          <div className="text-xs">
                            <p
                              className={
                                active
                                  ? 'text-slate-700 font-medium'
                                  : 'text-red-600 font-medium'
                              }
                            >
                              {new Date(t.subExpiresAt).toLocaleDateString('tr-TR')}
                            </p>
                            {active ? (
                              <p
                                className={
                                  days !== null && days < 3
                                    ? 'text-red-600'
                                    : days !== null && days < 7
                                      ? 'text-amber-600'
                                      : 'text-slate-500'
                                }
                              >
                                {days} gün kaldı
                              </p>
                            ) : (
                              <p className="text-red-500">Süresi dolmuş</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Ayarlanmadı</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-700">{t._count.bots}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {t.lastLoginAt
                          ? new Date(t.lastLoginAt).toLocaleDateString('tr-TR')
                          : '—'}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {new Date(t.createdAt).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`${ADMIN_PATH}/tenants/${t.id}`}
                          className="btn-secondary btn-sm"
                        >
                          Yönet
                          <ArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
