'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  UserCheck,
  UserX,
  UserPlus,
  Bot,
  Hash,
  Inbox,
  TrendingUp,
  Wallet,
  ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { ADMIN_PATH } from '@/lib/admin-path';

interface Stats {
  tenants: { total: number; new30Days: number; suspended: number; activeSubscription: number };
  usage: { bots: number; channels: number; activeMemberships: number; pendingOrders: number };
  revenue: { tenantsThisMonth: number; approvedOrdersThisMonth: number; saasThisMonth: number };
  newTenantsLast7Days: { date: string; count: number }[];
}

export default function AdminHome() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get<Stats>('/admin/stats').then(setStats);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Genel Bakış</h1>
        <p className="text-sm text-slate-500 mt-1">
          Sistemin bir bakışta özet durumu
        </p>
      </div>

      {/* Ana KPI kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Toplam Kullanıcı"
          value={stats?.tenants.total}
          icon={Users}
          color="brand"
          href={`${ADMIN_PATH}/tenants`}
        />
        <KpiCard
          label="Aktif Abonelik"
          value={stats?.tenants.activeSubscription}
          icon={UserCheck}
          color="emerald"
        />
        <KpiCard
          label="Askıda"
          value={stats?.tenants.suspended}
          icon={UserX}
          color="amber"
        />
        <KpiCard
          label="Son 30 Gün Yeni"
          value={stats?.tenants.new30Days}
          icon={UserPlus}
          color="brand"
        />
      </div>

      {/* Gelir kartları */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <RevenueCard
          label="Bu Ay SaaS Gelirim"
          amount={stats?.revenue.saasThisMonth}
          sub="Kullanıcılardan aldığın abonelik ücretleri"
          highlight
        />
        <RevenueCard
          label="Kullanıcı Cirosu (Bu Ay)"
          amount={stats?.revenue.tenantsThisMonth}
          sub="Kullanıcıların son müşterilerinden aldığı toplam"
        />
        <StatCard
          label="Onaylı Sipariş (Bu Ay)"
          value={stats?.revenue.approvedOrdersThisMonth}
          sub="Tüm kullanıcılar toplam"
        />
      </div>

      {/* Kullanım özet */}
      <div className="card">
        <div className="p-5 border-b border-slate-200/80">
          <h2 className="font-semibold text-slate-900">Sistem Kullanımı</h2>
          <p className="text-xs text-slate-500 mt-0.5">Anlık toplam sayılar</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-200/60">
          <UsageCell icon={Bot} label="Bot" value={stats?.usage.bots} color="brand" />
          <UsageCell icon={Hash} label="Kanal" value={stats?.usage.channels} color="brand" />
          <UsageCell
            icon={UserCheck}
            label="Aktif Üye"
            value={stats?.usage.activeMemberships}
            color="emerald"
          />
          <UsageCell
            icon={Inbox}
            label="Bekleyen"
            value={stats?.usage.pendingOrders}
            color="amber"
          />
        </div>
      </div>

      {/* Kayıt trendi — basit bar chart */}
      {stats && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-slate-900 inline-flex items-center gap-2">
                <TrendingUp size={17} className="text-emerald-600" />
                Son 7 Gün — Yeni Kayıtlar
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Toplam:{' '}
                <strong>
                  {stats.newTenantsLast7Days.reduce((a, b) => a + b.count, 0)}
                </strong>{' '}
                yeni kayıt
              </p>
            </div>
          </div>
          <BarChart data={stats.newTenantsLast7Days} />
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  href,
}: {
  label: string;
  value: number | undefined;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: 'brand' | 'emerald' | 'amber';
  href?: string;
}) {
  const colors = {
    brand: 'bg-brand-50 text-brand-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
  }[color];

  const inner = (
    <div
      className={`card p-4 ${href ? 'hover:shadow-md hover:border-slate-300 cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">
            {value === undefined ? (
              <span className="skeleton inline-block w-10 h-7 align-middle" />
            ) : (
              value
            )}
          </p>
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors}`}>
          <Icon size={16} />
        </div>
      </div>
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

function RevenueCard({
  label,
  amount,
  sub,
  highlight,
}: {
  label: string;
  amount: number | undefined;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`card p-5 ${
        highlight ? 'bg-gradient-to-br from-emerald-50 to-white border-emerald-200' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <p className={`text-sm font-medium ${highlight ? 'text-emerald-800' : 'text-slate-600'}`}>
          {label}
        </p>
        <Wallet
          size={18}
          className={highlight ? 'text-emerald-600' : 'text-slate-400'}
        />
      </div>
      <p className={`text-3xl font-bold ${highlight ? 'text-emerald-700' : 'text-slate-900'}`}>
        {amount === undefined ? (
          <span className="skeleton inline-block w-24 h-9 align-middle" />
        ) : (
          <>
            {amount.toLocaleString('tr-TR')} <span className="text-lg font-medium">TL</span>
          </>
        )}
      </p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | undefined;
  sub: string;
}) {
  return (
    <div className="card p-5">
      <p className="text-sm font-medium text-slate-600 mb-2">{label}</p>
      <p className="text-3xl font-bold text-slate-900">
        {value === undefined ? (
          <span className="skeleton inline-block w-16 h-9 align-middle" />
        ) : (
          value
        )}
      </p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
    </div>
  );
}

function UsageCell({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number | undefined;
  color: 'brand' | 'emerald' | 'amber';
}) {
  const colors = {
    brand: 'text-brand-600',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
  }[color];

  return (
    <div className="p-4 text-center">
      <Icon size={18} className={`mx-auto ${colors}`} />
      <p className="text-xl font-semibold text-slate-900 mt-2">
        {value === undefined ? '—' : value}
      </p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function BarChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((d) => {
        const height = max > 0 ? (d.count / max) * 100 : 0;
        const label = new Date(d.date).toLocaleDateString('tr-TR', {
          day: '2-digit',
          month: '2-digit',
        });
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
            <div className="text-xs text-slate-600 font-medium">{d.count}</div>
            <div className="w-full flex-1 flex items-end">
              <div
                className={`w-full rounded-t transition-all ${
                  d.count > 0 ? 'bg-brand-500' : 'bg-slate-200'
                }`}
                style={{ height: `${Math.max(height, d.count > 0 ? 8 : 4)}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-500 mt-1">{label}</div>
          </div>
        );
      })}
    </div>
  );
}
