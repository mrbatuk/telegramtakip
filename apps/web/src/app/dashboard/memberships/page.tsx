'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Users, CheckCircle2, Clock, Inbox, Search, X, Copy, Zap, Plus, Ban, MoreVertical } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/lib/toast';

interface Membership {
  id: string;
  telegramUserId: string;
  telegramUsername: string | null;
  firstName: string | null;
  lastName: string | null;
  startedAt: string;
  expiresAt: string;
  status: string;
  channel: { id: string; name: string };
  order: { package: { name: string; durationDays: number } };
}

function daysLeft(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

const FILTERS: { key: string; label: string; icon: typeof Users }[] = [
  { key: 'ACTIVE', label: 'Aktif', icon: CheckCircle2 },
  { key: 'EXPIRED', label: 'Süresi Dolan', icon: Clock },
  { key: 'all', label: 'Tümü', icon: Users },
];

export default function MembershipsPage() {
  const [memberships, setMemberships] = useState<Membership[] | null>(null);
  const [filter, setFilter] = useState<string>('ACTIVE');
  const [search, setSearch] = useState('');
  const [shrinkingId, setShrinkingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuRect, setMenuRect] = useState<{ top: number; right: number } | null>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (!openMenuId) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-menu-root]') && !target.closest('[data-menu-panel]')) {
        setOpenMenuId(null);
      }
    }
    function onScroll() {
      setOpenMenuId(null);
    }
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [openMenuId]);

  function openMenu(id: string) {
    if (openMenuId === id) {
      setOpenMenuId(null);
      return;
    }
    const el = triggerRefs.current[id];
    if (el) {
      const rect = el.getBoundingClientRect();
      setMenuRect({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpenMenuId(id);
  }

  async function load() {
    setMemberships(null);
    const qs = filter === 'all' ? '' : `?status=${filter}`;
    const r = await api.get<{ memberships: Membership[] }>(`/memberships${qs}`);
    setMemberships(r.memberships);
  }

  useEffect(() => {
    load();
  }, [filter]);

  const filtered = useMemo(() => {
    if (!memberships) return null;
    const q = search.trim().toLowerCase();
    if (!q) return memberships;
    return memberships.filter((m) => {
      const username = (m.telegramUsername ?? '').toLowerCase();
      const name = `${m.firstName ?? ''} ${m.lastName ?? ''}`.toLowerCase();
      const channel = m.channel.name.toLowerCase();
      const pkg = m.order.package.name.toLowerCase();
      return (
        username.includes(q) ||
        name.includes(q) ||
        m.telegramUserId.includes(q) ||
        channel.includes(q) ||
        pkg.includes(q)
      );
    });
  }, [memberships, search]);

  async function extendDays(id: string) {
    const daysStr = prompt('Kaç gün uzatmak istiyorsun?', '30');
    if (!daysStr) return;
    const days = parseInt(daysStr, 10);
    if (isNaN(days) || days < 1) return;
    setBusyId(id);
    try {
      const r = await api.post<{ expiresAt: string }>(`/memberships/${id}/extend`, { days });
      await load();
      toast.success(`${days} gün uzatıldı`, `Yeni bitiş: ${new Date(r.expiresAt).toLocaleDateString('tr-TR')}`);
    } catch (err) {
      toast.error('Uzatılamadı', err instanceof ApiError ? err.message : 'Sunucu hatası');
    } finally {
      setBusyId(null);
    }
  }

  async function revokeMembership(id: string, kick: boolean) {
    const action = kick ? 'iptal edip kanaldan atmak' : 'iptal etmek (kanaldan atmadan)';
    const reason = prompt(`Bu üyeliği ${action} istiyorsun. Sebep (opsiyonel):`);
    if (reason === null) return; // iptal
    if (!confirm(`Onaylıyor musun?`)) return;
    setBusyId(id);
    try {
      await api.post(`/memberships/${id}/revoke`, { kick, reason: reason || undefined });
      await load();
      toast.success(kick ? 'Üyelik iptal edildi + kanaldan atıldı' : 'Üyelik iptal edildi');
    } catch (err) {
      toast.error('İşlem başarısız', err instanceof ApiError ? err.message : 'Sunucu hatası');
    } finally {
      setBusyId(null);
    }
  }

  async function shrinkExpiry(id: string) {
    if (!confirm('Test amaçlı: bu üyeliğin süresi 2 dakikaya çekilsin mi? Otomatik atma o zaman tetiklenir.'))
      return;
    setShrinkingId(id);
    try {
      await api.post(`/memberships/${id}/test-shrink-expiry`, { minutes: 2 });
      await load();
      toast.info(
        'Süre 2 dakikaya çekildi',
        '~2 dk sonra kullanıcı kanaldan otomatik çıkarılır',
      );
    } catch (err) {
      toast.error(
        'İşlem başarısız',
        err instanceof ApiError ? err.message : 'Sunucu hatası',
      );
    } finally {
      setShrinkingId(null);
    }
  }

  function copyUserId(id: string) {
    navigator.clipboard.writeText(id);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Üyelikler</h1>
        <p className="text-sm text-slate-500 mt-1">
          Aktif üyeleri ve süresi dolanları takip et
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <div className="flex gap-1">
          {FILTERS.map((f) => {
            const Icon = f.icon;
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-brand-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon size={15} />
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="relative md:ml-auto md:w-72">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ara: @kullanıcı, user ID, kanal..."
            className="input pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
              title="Temizle"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {filtered === null ? (
        <div className="card p-6 space-y-3">
          <div className="skeleton h-12" />
          <div className="skeleton h-12" />
          <div className="skeleton h-12" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            {search ? <Search size={26} /> : <Inbox size={26} />}
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">
            {search
              ? 'Aramana uygun üyelik yok'
              : 'Bu kategoride üyelik yok'}
          </h3>
          <p className="text-sm text-slate-500">
            {search
              ? `"${search}" eşleşmedi.`
              : 'Onaylanan dekontlardan sonra üyelikler buraya düşer.'}
          </p>
        </div>
      ) : (
        <>
          {search && (
            <p className="text-xs text-slate-500">
              {filtered.length} sonuç ({memberships?.length} içinden)
            </p>
          )}
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  <th className="px-5 py-3">Kullanıcı</th>
                  <th className="px-5 py-3">Kanal</th>
                  <th className="px-5 py-3">Paket</th>
                  <th className="px-5 py-3">Başlangıç</th>
                  <th className="px-5 py-3">Bitiş</th>
                  <th className="px-5 py-3">Kalan</th>
                  <th className="px-5 py-3">Durum</th>
                  <th className="px-5 py-3 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60">
                {filtered.map((m) => {
                  const left = daysLeft(m.expiresAt);
                  const isActive = m.status === 'ACTIVE';
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="space-y-0.5">
                          {(() => {
                            const displayName =
                              [m.firstName, m.lastName].filter(Boolean).join(' ') ||
                              null;
                            if (displayName) {
                              return (
                                <div className="font-medium text-slate-900">
                                  {displayName}
                                  {m.telegramUsername && (
                                    <a
                                      href={`https://t.me/${m.telegramUsername}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="ml-1.5 text-xs font-normal text-brand-600 hover:underline"
                                    >
                                      @{m.telegramUsername}
                                    </a>
                                  )}
                                </div>
                              );
                            }
                            if (m.telegramUsername) {
                              return (
                                <a
                                  href={`https://t.me/${m.telegramUsername}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-medium text-brand-600 hover:underline"
                                >
                                  @{m.telegramUsername}
                                </a>
                              );
                            }
                            return (
                              <span className="font-medium text-slate-400 italic">
                                (isimsiz)
                              </span>
                            );
                          })()}
                          <button
                            onClick={() => copyUserId(m.telegramUserId)}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
                            title="User ID kopyala"
                          >
                            <span className="font-mono">{m.telegramUserId}</span>
                            <Copy size={10} />
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-700">{m.channel.name}</td>
                      <td className="px-5 py-3 text-slate-700">
                        {m.order.package.name}
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {new Date(m.startedAt).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {new Date(m.expiresAt).toLocaleString('tr-TR')}
                      </td>
                      <td className="px-5 py-3">
                        {isActive ? (
                          <span
                            className={
                              left < 3
                                ? 'text-red-600 font-semibold'
                                : left < 7
                                  ? 'text-amber-600 font-medium'
                                  : 'text-slate-700'
                            }
                          >
                            {left > 0 ? `${left} gün` : 'Bugün dolar'}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {m.status === 'ACTIVE' ? (
                          <span className="badge-success">
                            <CheckCircle2 size={11} /> Aktif
                          </span>
                        ) : m.status === 'EXPIRED' ? (
                          <span className="badge-neutral">
                            <Clock size={11} /> Süresi Doldu
                          </span>
                        ) : (
                          <span className="badge-neutral">{m.status}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {isActive && (
                          <div className="inline-block" data-menu-root>
                            <button
                              ref={(el) => { triggerRefs.current[m.id] = el; }}
                              onClick={() => openMenu(m.id)}
                              disabled={busyId === m.id}
                              className="inline-flex items-center gap-1 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100 px-2.5 py-1.5 rounded-md border border-slate-200 transition-colors"
                            >
                              İşlemler
                              <MoreVertical size={12} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {openMenuId && menuRect && typeof window !== 'undefined' &&
        createPortal(
          <div
            data-menu-panel
            style={{ position: 'fixed', top: menuRect.top, right: menuRect.right, zIndex: 70 }}
            className="w-52 bg-white border border-slate-200 rounded-lg shadow-xl py-1"
          >
            <button
              onClick={() => { const id = openMenuId; setOpenMenuId(null); extendDays(id); }}
              className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
            >
              <Plus size={13} className="text-emerald-600" /> Süreyi Uzat
            </button>
            <button
              onClick={() => { const id = openMenuId; setOpenMenuId(null); revokeMembership(id, true); }}
              className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-red-50 hover:text-red-800"
            >
              <Ban size={13} className="text-red-600" /> İptal et + kanaldan at
            </button>
            <button
              onClick={() => { const id = openMenuId; setOpenMenuId(null); revokeMembership(id, false); }}
              className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <X size={13} className="text-slate-500" /> Sadece İptal Et
            </button>
            <div className="border-t border-slate-100 my-1" />
            <button
              onClick={() => { const id = openMenuId; setOpenMenuId(null); shrinkExpiry(id); }}
              disabled={shrinkingId === openMenuId}
              className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-amber-700 hover:bg-amber-50"
            >
              <Zap size={13} /> Test: 2dk'ya çek
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
