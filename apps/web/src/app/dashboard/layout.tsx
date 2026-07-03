'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Bot,
  Inbox,
  Users,
  LogOut,
  Send,
  CreditCard,
  Crown,
  Shield,
  Settings,
} from 'lucide-react';
import { api, getToken, setToken } from '@/lib/api';
import { ADMIN_PATH } from '@/lib/admin-path';

const NAV = [
  { href: '/dashboard', label: 'Genel', icon: LayoutDashboard },
  { href: '/dashboard/bots', label: 'Botlar', icon: Bot },
  { href: '/dashboard/orders', label: 'Onay Bekleyenler', icon: Inbox },
  { href: '/dashboard/memberships', label: 'Aktif Üyelikler', icon: Users },
  { href: '/dashboard/payment-methods', label: 'Ödeme Yöntemleri', icon: CreditCard },
  { href: '/dashboard/subscription', label: 'Aboneliğim', icon: Crown },
  { href: '/dashboard/settings', label: 'Ayarlar', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<{ email: string; plan: string; isSuperAdmin: boolean } | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    api
      .get<{ tenant: { email: string; plan: string; isSuperAdmin: boolean } }>('/auth/me')
      .then((res) => setMe(res.tenant))
      .catch(() => {
        setToken(null);
        router.replace('/login');
      });
  }, [router]);

  function logout() {
    setToken(null);
    router.replace('/login');
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar — viewport'a sabit, ortadaki nav gerekirse kendi içinde kayar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:sticky md:top-0 md:h-screen border-r border-slate-200 bg-white">
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-slate-200 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <Send className="w-4.5 h-4.5 text-white" size={18} />
          </div>
          <span className="font-semibold text-slate-900">TelegramTakip</span>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {NAV.map((n) => {
            const active = pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href));
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={active ? 'nav-link-active' : 'nav-link'}
              >
                <Icon size={18} />
                {n.label}
              </Link>
            );
          })}
        </nav>

        {me && (
          <div className="p-2.5 border-t border-slate-200 shrink-0 space-y-0.5">
            {me.isSuperAdmin && (
              <Link
                href={ADMIN_PATH}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50"
              >
                <Shield size={14} />
                Admin Paneline Git
              </Link>
            )}
            <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-medium text-xs shrink-0">
                {me.email.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-900 truncate" title={me.email}>
                  {me.email}
                </p>
                <span className="inline-block text-[9px] font-semibold text-slate-500 uppercase tracking-wide">
                  {me.plan} plan
                </span>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 w-full"
            >
              <LogOut size={14} />
              Çıkış Yap
            </button>
          </div>
        )}
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-brand-600 flex items-center justify-center">
            <Send size={14} className="text-white" />
          </div>
          <span className="font-semibold">TelegramTakip</span>
        </Link>
        <button onClick={logout} className="btn-ghost btn-sm">
          <LogOut size={14} />
        </button>
      </div>

      {/* Mobile bottom tab bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 h-16 bg-white border-t border-slate-200 flex">
        {NAV.map((n) => {
          const active = pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href));
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] ${
                active ? 'text-brand-700' : 'text-slate-500'
              }`}
            >
              <Icon size={20} />
              {n.label.split(' ')[0]}
            </Link>
          );
        })}
      </div>

      <main className="flex-1 md:overflow-x-hidden pt-14 pb-16 md:pt-0 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
