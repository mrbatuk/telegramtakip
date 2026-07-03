'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bot as BotIcon,
  Inbox,
  Users,
  Plus,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import { OnboardingChecklist } from '@/components/OnboardingChecklist';

interface Bot {
  id: string;
  botUsername: string;
  botName: string | null;
  _count: { channels: number };
}

export default function DashboardHome() {
  const [bots, setBots] = useState<Bot[] | null>(null);
  const [pending, setPending] = useState<number>(0);
  const [active, setActive] = useState<number>(0);

  useEffect(() => {
    api.get<{ bots: Bot[] }>('/bots').then((r) => setBots(r.bots));
    api
      .get<{ orders: unknown[] }>('/orders?status=AWAITING_APPROVAL')
      .then((r) => setPending(r.orders.length));
    api
      .get<{ memberships: unknown[] }>('/memberships?status=ACTIVE')
      .then((r) => setActive(r.memberships.length));
  }, []);

  return (
    <div className="space-y-6">
      <OnboardingChecklist />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Genel Bakış</h1>
        <p className="text-sm text-slate-500 mt-1">
          Botlarının ve üyeliklerinin özet durumu
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Bot"
          value={bots?.length ?? null}
          icon={BotIcon}
          color="brand"
          href="/dashboard/bots"
        />
        <StatCard
          label="Onay Bekleyen"
          value={pending}
          icon={Inbox}
          color={pending > 0 ? 'amber' : 'slate'}
          href={pending > 0 ? '/dashboard/orders' : undefined}
          highlight={pending > 0}
        />
        <StatCard
          label="Aktif Üyelik"
          value={active}
          icon={Users}
          color="emerald"
          href="/dashboard/memberships"
        />
      </div>

      {bots !== null && bots.length === 0 ? (
        <EmptyState />
      ) : (
        bots && bots.length > 0 && (
          <div className="card">
            <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">Botların</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {bots.length} bot bağlı
                </p>
              </div>
              <Link href="/dashboard/bots" className="btn-secondary btn-sm">
                Tümünü Gör
                <ArrowRight size={14} />
              </Link>
            </div>
            <ul className="divide-y divide-slate-200/60">
              {bots.map((b) => (
                <li
                  key={b.id}
                  className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                      <BotIcon size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {b.botName ?? b.botUsername}
                      </p>
                      <p className="text-sm text-slate-500 truncate">
                        @{b.botUsername} · {b._count.channels} kanal
                      </p>
                    </div>
                  </div>
                  <Link href={`/dashboard/bots/${b.id}`} className="btn-secondary btn-sm">
                    Yönet
                    <ArrowRight size={14} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  href,
  highlight,
}: {
  label: string;
  value: number | null;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: 'brand' | 'emerald' | 'amber' | 'slate';
  href?: string;
  highlight?: boolean;
}) {
  const colorClasses = {
    brand: 'bg-brand-50 text-brand-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-600',
  }[color];

  const inner = (
    <div
      className={`card p-5 transition-all ${
        href ? 'hover:shadow-md hover:border-slate-300 cursor-pointer' : ''
      } ${highlight ? 'ring-2 ring-amber-200' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="text-3xl font-semibold text-slate-900 mt-2">
            {value === null ? (
              <span className="skeleton inline-block w-12 h-8 align-middle" />
            ) : (
              value
            )}
          </p>
        </div>
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses}`}
        >
          <Icon size={20} />
        </div>
      </div>
      {href && highlight && (
        <p className="text-xs text-amber-700 mt-3 flex items-center gap-1">
          İncele <ArrowRight size={12} />
        </p>
      )}
    </div>
  );

  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

function EmptyState() {
  return (
    <div className="card p-10 text-center">
      <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-4">
        <Sparkles size={26} />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">
        Hoş geldin! Hadi başlayalım
      </h3>
      <p className="text-slate-500 max-w-md mx-auto mb-6">
        BotFather'dan oluşturduğun Telegram botunu ekle, kanalını bağla ve
        ücretli üyelik takibini otomatikleştir.
      </p>
      <Link href="/dashboard/bots" className="btn-primary">
        <Plus size={16} />
        İlk Botunu Ekle
      </Link>
    </div>
  );
}
