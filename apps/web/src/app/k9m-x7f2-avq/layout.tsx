'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Wallet,
  Activity,
  History,
  LogOut,
  Shield,
  ArrowLeft,
  Settings,
  CreditCard,
  Crown,
  Ticket,
} from 'lucide-react';
import { api, getToken, setToken } from '@/lib/api';
import { ADMIN_PATH } from '@/lib/admin-path';

const NAV = [
  { href: ADMIN_PATH, label: 'Genel Bakış', icon: LayoutDashboard },
  { href: `${ADMIN_PATH}/tenants`, label: 'Kullanıcılar', icon: Users },
  { href: `${ADMIN_PATH}/plans`, label: 'Planlar', icon: Crown },
  { href: `${ADMIN_PATH}/coupons`, label: 'Kuponlar', icon: Ticket },
  { href: `${ADMIN_PATH}/subscriptions`, label: 'Abonelik Gelirleri', icon: Wallet },
  { href: `${ADMIN_PATH}/billing-methods`, label: 'Tahsilat Yöntemleri', icon: CreditCard },
  { href: `${ADMIN_PATH}/settings`, label: 'Sistem Ayarları', icon: Settings },
  { href: `${ADMIN_PATH}/system`, label: 'Sistem Sağlığı', icon: Activity },
  { href: `${ADMIN_PATH}/audit`, label: 'İşlem Geçmişi', icon: History },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<{ email: string; isSuperAdmin: boolean } | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    api
      .get<{ tenant: { email: string; isSuperAdmin: boolean } }>('/auth/me')
      .then((res) => {
        if (!res.tenant.isSuperAdmin) {
          router.replace('/dashboard');
          return;
        }
        setMe(res.tenant);
        setChecking(false);
      })
      .catch(() => {
        setToken(null);
        router.replace('/login');
      });
  }, [router]);

  function logout() {
    setToken(null);
    router.replace('/login');
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-slate-500">Yetki kontrol ediliyor...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Sidebar — koyu tema süper admin için farklı hissi. Viewport'a sabit */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:sticky md:top-0 md:h-screen border-r border-slate-800 bg-slate-900">
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-slate-800 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
            <Shield className="w-4.5 h-4.5 text-white" size={18} />
          </div>
          <div>
            <span className="font-semibold text-white text-sm">Süper Admin</span>
            <p className="text-[10px] text-slate-400 leading-tight">Yönetici paneli</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {NAV.map((n) => {
            const active =
              pathname === n.href || (n.href !== ADMIN_PATH && pathname.startsWith(n.href));
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <Icon size={17} />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-1 shrink-0">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800/60"
          >
            <ArrowLeft size={13} />
            Tenant Paneline Dön
          </Link>
          {me && (
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-medium text-xs shrink-0">
                {me.email.charAt(0).toUpperCase()}
              </div>
              <p className="text-xs text-slate-300 truncate flex-1">{me.email}</p>
              <button
                onClick={logout}
                className="text-slate-500 hover:text-white p-1"
                title="Çıkış"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-red-400" />
          <span className="font-semibold text-sm text-white">Süper Admin</span>
        </div>
        <button onClick={logout} className="text-slate-400 p-2">
          <LogOut size={14} />
        </button>
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 h-16 bg-slate-900 border-t border-slate-800 flex">
        {NAV.slice(0, 5).map((n) => {
          const active =
            pathname === n.href || (n.href !== ADMIN_PATH && pathname.startsWith(n.href));
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] ${
                active ? 'text-white' : 'text-slate-500'
              }`}
            >
              <Icon size={18} />
              {n.label.split(' ')[0]}
            </Link>
          );
        })}
      </div>

      <main className="flex-1 bg-slate-50 pt-14 pb-16 md:pt-0 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
