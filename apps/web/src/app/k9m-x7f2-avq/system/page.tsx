'use client';
import { useEffect, useState } from 'react';
import {
  Database,
  Radio,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ListTree,
  Layers,
} from 'lucide-react';
import { api } from '@/lib/api';

interface Health {
  database: { ok: boolean };
  queues: Array<{
    name: string;
    waiting?: number;
    active?: number;
    delayed?: number;
    completed?: number;
    failed?: number;
    error?: string;
  }>;
  botEngine: { cachedBots: number };
  config: {
    nodeEnv: string;
    webhookBaseUrl: string;
    publicApiUrl: string;
    publicWebUrl: string;
  };
}

interface Plans {
  plans: Array<{
    key: string;
    name: string;
    maxBots: number;
    maxChannelsPerBot: number;
    maxActiveMembers: number;
    allowedPaymentMethods: string[];
    monthlyPriceTRY: number;
  }>;
}

export default function SystemPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [plans, setPlans] = useState<Plans | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [h, p] = await Promise.all([
        api.get<Health>('/admin/system/health'),
        api.get<Plans>('/admin/system/plans'),
      ]);
      setHealth(h);
      setPlans(p);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 15000); // 15sn'de bir yenile
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Sistem Sağlığı</h1>
          <p className="text-sm text-slate-500 mt-1">
            Veritabanı, kuyruklar, bot engine ve konfigürasyon — her 15sn otomatik yenilenir
          </p>
        </div>
        <button onClick={loadAll} disabled={loading} className="btn-secondary btn-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Yenile
        </button>
      </div>

      {/* Component durumu */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <HealthCard
          icon={Database}
          label="Veritabanı"
          status={health?.database.ok ? 'ok' : health ? 'error' : 'loading'}
          detail="PostgreSQL bağlantısı"
        />
        <HealthCard
          icon={Radio}
          label="Bot Engine"
          status={health ? 'ok' : 'loading'}
          detail={`${health?.botEngine.cachedBots ?? 0} bot bellekte`}
        />
        <HealthCard
          icon={Layers}
          label="Ortam"
          status={health?.config.nodeEnv === 'production' ? 'ok' : health ? 'warning' : 'loading'}
          detail={health?.config.nodeEnv ?? '—'}
        />
      </div>

      {/* Kuyruklar */}
      <div className="card">
        <div className="p-5 border-b border-slate-200/80">
          <h2 className="font-semibold text-slate-900 inline-flex items-center gap-2">
            <ListTree size={17} className="text-brand-600" />
            BullMQ Kuyrukları
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Zamanlanmış job'ların anlık durumu</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-xs font-medium text-slate-500 uppercase text-left">
                <th className="px-5 py-3">Kuyruk</th>
                <th className="px-5 py-3 text-right">Bekleyen</th>
                <th className="px-5 py-3 text-right">Aktif</th>
                <th className="px-5 py-3 text-right">Ertelenmiş</th>
                <th className="px-5 py-3 text-right">Tamamlanan</th>
                <th className="px-5 py-3 text-right">Başarısız</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {health === null ? (
                <tr>
                  <td colSpan={6} className="px-5 py-3">
                    <div className="skeleton h-5" />
                  </td>
                </tr>
              ) : (
                health.queues.map((q) => (
                  <tr key={q.name}>
                    <td className="px-5 py-3 font-mono text-xs">{q.name}</td>
                    {q.error ? (
                      <td colSpan={5} className="px-5 py-3 text-red-600 text-xs">
                        {q.error}
                      </td>
                    ) : (
                      <>
                        <td className="px-5 py-3 text-right">{q.waiting ?? 0}</td>
                        <td className="px-5 py-3 text-right">{q.active ?? 0}</td>
                        <td className="px-5 py-3 text-right">{q.delayed ?? 0}</td>
                        <td className="px-5 py-3 text-right text-emerald-600">{q.completed ?? 0}</td>
                        <td className="px-5 py-3 text-right text-red-600">{q.failed ?? 0}</td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Konfigürasyon */}
      {health && (
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-3">Konfigürasyon</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <ConfigItem k="NODE_ENV" v={health.config.nodeEnv} />
            <ConfigItem k="Webhook Base URL" v={health.config.webhookBaseUrl} />
            <ConfigItem k="Public API URL" v={health.config.publicApiUrl} />
            <ConfigItem k="Public Web URL" v={health.config.publicWebUrl} />
          </dl>
        </div>
      )}

      {/* Planlar */}
      {plans && (
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Plan Limitleri</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase font-medium text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="pb-2">Plan</th>
                  <th className="pb-2 text-right">Aylık (TL)</th>
                  <th className="pb-2 text-right">Max Bot</th>
                  <th className="pb-2 text-right">Kanal/Bot</th>
                  <th className="pb-2 text-right">Max Aktif Üye</th>
                  <th className="pb-2">Ödeme Yöntemleri</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plans.plans.map((p) => (
                  <tr key={p.key}>
                    <td className="py-2 font-medium">{p.name} <span className="text-xs text-slate-400 ml-1">({p.key})</span></td>
                    <td className="py-2 text-right">{p.monthlyPriceTRY}</td>
                    <td className="py-2 text-right">{p.maxBots}</td>
                    <td className="py-2 text-right">{p.maxChannelsPerBot}</td>
                    <td className="py-2 text-right">{p.maxActiveMembers.toLocaleString('tr-TR')}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {p.allowedPaymentMethods.map((m) => (
                          <span key={m} className="badge-neutral text-[10px]">
                            {m}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function HealthCard({
  icon: Icon,
  label,
  status,
  detail,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  status: 'ok' | 'error' | 'warning' | 'loading';
  detail: string;
}) {
  const config = {
    ok: {
      icon: <CheckCircle2 size={14} className="text-emerald-600" />,
      text: 'Sağlıklı',
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
    },
    error: {
      icon: <XCircle size={14} className="text-red-600" />,
      text: 'Hata',
      color: 'text-red-700',
      bg: 'bg-red-50',
    },
    warning: {
      icon: <XCircle size={14} className="text-amber-600" />,
      text: 'Development',
      color: 'text-amber-700',
      bg: 'bg-amber-50',
    },
    loading: {
      icon: <RefreshCw size={14} className="text-slate-500 animate-spin" />,
      text: 'Yükleniyor',
      color: 'text-slate-500',
      bg: 'bg-slate-50',
    },
  }[status];

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2.5 mb-2">
        <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center`}>
          <Icon size={16} />
        </div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
      </div>
      <div className={`flex items-center gap-1 text-xs font-medium ${config.color}`}>
        {config.icon}
        {config.text}
      </div>
      <p className="text-xs text-slate-500 mt-1">{detail}</p>
    </div>
  );
}

function ConfigItem({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium text-slate-500 uppercase">{k}</dt>
      <dd className="font-mono text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1.5 break-all">
        {v}
      </dd>
    </div>
  );
}
