'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  Inbox,
  Check,
  X,
  FileText,
  User,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Copy,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/lib/toast';

interface Order {
  id: string;
  amount: string;
  status: string;
  receiptUrl: string | null;
  receiptUploadedAt: string | null;
  createdAt: string;
  package: { name: string; durationDays: number };
  joinRequest: {
    telegramUserId: string;
    telegramUsername: string | null;
    firstName: string | null;
    lastName: string | null;
    channel: { id: string; name: string; currency: string };
  };
}

const FILTERS: { key: string; label: string; icon: typeof Clock }[] = [
  { key: 'AWAITING_APPROVAL', label: 'Onay Bekleyenler', icon: Clock },
  { key: 'AWAITING_PAYMENT', label: 'Ödeme Bekleyenler', icon: AlertCircle },
  { key: 'APPROVED', label: 'Onaylanan', icon: CheckCircle2 },
  { key: 'all', label: 'Tümü', icon: Inbox },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [filter, setFilter] = useState<string>('AWAITING_APPROVAL');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setOrders(null);
    const qs = filter === 'all' ? '' : `?status=${filter}`;
    const r = await api.get<{ orders: Order[] }>(`/orders${qs}`);
    setOrders(r.orders);
  }

  useEffect(() => {
    load();
  }, [filter]);

  const filtered = useMemo(() => {
    if (!orders) return null;
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => {
      const name = `${o.joinRequest.firstName ?? ''} ${o.joinRequest.lastName ?? ''}`.toLowerCase();
      const username = (o.joinRequest.telegramUsername ?? '').toLowerCase();
      const userId = o.joinRequest.telegramUserId;
      const channel = o.joinRequest.channel.name.toLowerCase();
      const amount = o.amount;
      return (
        name.includes(q) ||
        username.includes(q) ||
        userId.includes(q) ||
        channel.includes(q) ||
        amount.includes(q)
      );
    });
  }, [orders, search]);

  async function approve(id: string) {
    setBusyId(id);
    try {
      await api.post(`/orders/${id}/approve`);
      await load();
      toast.success(
        'Sipariş onaylandı',
        'Kullanıcı kanala eklendi ve üyeliği aktifleştirildi',
      );
    } catch (err) {
      toast.error(
        'Onay başarısız',
        err instanceof ApiError ? err.message : 'Sunucu hatası',
      );
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    const reason = prompt('Red sebebi (opsiyonel):') ?? '';
    setBusyId(id);
    try {
      await api.post(`/orders/${id}/reject`, { reason: reason || undefined });
      await load();
      toast.success('Sipariş reddedildi', 'Kullanıcıya bilgi mesajı gönderildi');
    } catch (err) {
      toast.error(
        'Red başarısız',
        err instanceof ApiError ? err.message : 'Sunucu hatası',
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Siparişler</h1>
        <p className="text-sm text-slate-500 mt-1">
          Dekontları kontrol et, onayla veya reddet
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <div className="flex gap-1 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-1 scrollbar-thin">
          {FILTERS.map((f) => {
            const Icon = f.icon;
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
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
            placeholder="Ara: isim, @kullanıcı, user ID, kanal..."
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
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            {search ? <Search size={26} /> : <Inbox size={26} />}
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">
            {search
              ? 'Aramana uygun sipariş yok'
              : 'Bu kategoride sipariş yok'}
          </h3>
          <p className="text-sm text-slate-500">
            {search
              ? `"${search}" eşleşmedi — başka bir kelimeyle dene.`
              : 'Yeni dekontlar geldikçe burada listelenir.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {search && (
            <p className="text-xs text-slate-500">
              {filtered.length} sonuç ({orders?.length} içinden)
            </p>
          )}
          {filtered.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              busy={busyId === o.id}
              onApprove={() => approve(o.id)}
              onReject={() => reject(o.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order,
  busy,
  onApprove,
  onReject,
}: {
  order: Order;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const name =
    [order.joinRequest.firstName, order.joinRequest.lastName]
      .filter(Boolean)
      .join(' ') ||
    order.joinRequest.telegramUsername ||
    '(isimsiz)';

  function copyUserId() {
    navigator.clipboard.writeText(order.joinRequest.telegramUserId);
  }

  function statusEl() {
    switch (order.status) {
      case 'AWAITING_PAYMENT':
        return (
          <span className="badge-warning">
            <AlertCircle size={11} /> Ödeme Bekleniyor
          </span>
        );
      case 'AWAITING_APPROVAL':
        return (
          <span className="badge-info">
            <Clock size={11} /> Onay Bekliyor
          </span>
        );
      case 'APPROVED':
        return (
          <span className="badge-success">
            <CheckCircle2 size={11} /> Onaylandı
          </span>
        );
      case 'REJECTED':
        return (
          <span className="badge-danger">
            <XCircle size={11} /> Reddedildi
          </span>
        );
      default:
        return <span className="badge-neutral">{order.status}</span>;
    }
  }

  const canAct =
    order.status === 'AWAITING_APPROVAL' || order.status === 'AWAITING_PAYMENT';

  return (
    <div className="card p-5">
      <div className="flex items-start gap-4 flex-wrap md:flex-nowrap">
        {order.receiptUrl ? (
          <a
            href={order.receiptUrl}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 group block"
            title="Dekontu büyüt"
          >
            {order.receiptUrl.endsWith('.pdf') ? (
              <div className="w-24 h-24 bg-red-50 text-red-600 rounded-lg border border-red-100 flex flex-col items-center justify-center gap-1 group-hover:border-red-200 transition-colors">
                <FileText size={26} />
                <span className="text-xs font-medium">PDF</span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={order.receiptUrl}
                alt="dekont"
                className="w-24 h-24 object-cover rounded-lg border border-slate-200 group-hover:border-slate-400 transition-colors"
              />
            )}
          </a>
        ) : (
          <div className="w-24 h-24 rounded-lg bg-slate-50 border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 shrink-0">
            <FileText size={20} />
            <span className="text-[10px] mt-1 text-center px-1">Dekont yok</span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {statusEl()}
            <span className="badge-neutral">
              {order.joinRequest.channel.name}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <User size={15} className="text-slate-400" />
            <span className="font-medium text-slate-900">{name}</span>
            {order.joinRequest.telegramUsername && (
              <a
                href={`https://t.me/${order.joinRequest.telegramUsername}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-brand-600 hover:underline"
              >
                @{order.joinRequest.telegramUsername}
              </a>
            )}
            <button
              onClick={copyUserId}
              title="User ID kopyala"
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded px-2 py-0.5 transition-colors"
            >
              ID: <span className="font-mono">{order.joinRequest.telegramUserId}</span>
              <Copy size={11} />
            </button>
          </div>

          <p className="text-sm text-slate-600 mt-1.5">
            <strong>{order.package.name}</strong> · {order.package.durationDays}{' '}
            gün ·{' '}
            <span className="font-semibold text-slate-900">
              {order.amount} {order.joinRequest.channel.currency}
            </span>
          </p>

          <p className="text-xs text-slate-400 mt-2">
            Oluşturuldu: {new Date(order.createdAt).toLocaleString('tr-TR')}
            {order.receiptUploadedAt &&
              ` · Dekont: ${new Date(order.receiptUploadedAt).toLocaleString('tr-TR')}`}
          </p>
        </div>

        {canAct && (
          <div className="flex md:flex-col gap-2 shrink-0 w-full md:w-auto">
            <button
              onClick={onApprove}
              disabled={busy}
              className="btn-success flex-1 md:flex-none"
            >
              <Check size={16} /> Onayla
            </button>
            <button
              onClick={onReject}
              disabled={busy}
              className="btn-danger flex-1 md:flex-none"
            >
              <X size={16} /> Reddet
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
