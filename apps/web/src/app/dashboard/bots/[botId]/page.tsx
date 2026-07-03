'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Hash,
  Users,
  UserPlus,
  Plus,
  X,
  Edit3,
  Trash2,
  Power,
  AlertCircle,
  AlertTriangle,
  MessageSquare,
  CreditCard,
  Package as PackageIcon,
  ChevronLeft,
  ExternalLink,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/lib/toast';

interface Channel {
  id: string;
  telegramChatId: string;
  name: string;
  welcomeMessage: string;
  ibanInfo: string | null;
  currency: string;
  isActive: boolean;
  packages: Package[];
  _count: { joinRequests: number; memberships: number };
}

interface Package {
  id: string;
  name: string;
  price: string;
  durationDays: number;
  isActive: boolean;
}

export default function BotDetailPage() {
  const { botId } = useParams<{ botId: string }>();
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const [chatId, setChatId] = useState('');
  const [name, setName] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [ibanInfo, setIbanInfo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const r = await api.get<{ channels: Channel[] }>(`/bots/${botId}/channels`);
    setChannels(r.channels);
  }

  useEffect(() => {
    if (botId) load();
  }, [botId]);

  async function addChannel(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post(`/bots/${botId}/channels`, {
        telegramChatId: parseInt(chatId, 10),
        name,
        welcomeMessage: welcomeMessage || undefined,
        ibanInfo: ibanInfo || undefined,
      });
      setShowAdd(false);
      setChatId('');
      setName('');
      setWelcomeMessage('');
      setIbanInfo('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Kanal eklenemedi');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/bots"
          className="text-sm text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 mb-2"
        >
          <ChevronLeft size={14} />
          Tüm Botlar
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Kanallar</h1>
            <p className="text-sm text-slate-500 mt-1">
              Botu kanala admin yaptığında otomatik tespit edilir; istersen elle de
              ekleyebilirsin
            </p>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="btn-primary">
            {showAdd ? (
              <>
                <X size={16} /> İptal
              </>
            ) : (
              <>
                <Plus size={16} /> Kanal Ekle
              </>
            )}
          </button>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={addChannel} className="card p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-slate-900">Manuel Kanal Ekle</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Bu form genelde gerekmez — botu kanala admin yapınca otomatik eklenir.
            </p>
          </div>
          <div>
            <label className="label">Kanal Chat ID</label>
            <input
              type="text"
              required
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              className="input font-mono text-sm"
              placeholder="-1001234567890"
            />
            <p className="text-xs text-slate-500 mt-1.5">
              Bulmak için:{' '}
              <a
                href="https://t.me/getidsbot"
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 hover:underline inline-flex items-center gap-0.5"
              >
                @getidsbot
                <ExternalLink size={11} />
              </a>{' '}
              ile kanaldan bir mesajı forward et.
            </p>
          </div>
          <div>
            <label className="label">Kanal Adı</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Hoş Geldin Mesajı</label>
            <textarea
              rows={3}
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              className="input"
              placeholder="Merhaba! Kanalımıza katılmak için aşağıdaki ödeme bilgilerini kullanabilirsin."
            />
          </div>
          <div>
            <label className="label">IBAN Bilgileri</label>
            <textarea
              rows={3}
              value={ibanInfo}
              onChange={(e) => setIbanInfo(e.target.value)}
              className="input font-mono text-sm"
              placeholder={'Adı Soyadı: ...\nIBAN: TR00 ...\nAçıklama: ...'}
            />
          </div>
          {error && (
            <div className="text-sm text-red-600 flex items-center gap-1.5">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Ekleniyor...' : 'Kanalı Ekle'}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="btn-secondary"
            >
              İptal
            </button>
          </div>
        </form>
      )}

      {channels === null ? (
        <div className="card p-6 space-y-3">
          <div className="skeleton h-20" />
          <div className="skeleton h-20" />
        </div>
      ) : channels.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-4">
            <Hash size={26} />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Henüz kanal yok
          </h3>
          <p className="text-slate-500 max-w-md mx-auto">
            Telegram'da botu kanalına admin olarak ekle — burada otomatik
            görünecek. Yetki olarak{' '}
            <strong>Manage Join Requests</strong> ve <strong>Invite Users</strong>{' '}
            gerekli.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {channels.map((c) => (
            <ChannelCard key={c.id} channel={c} onChange={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChannelCard({
  channel,
  onChange,
}: {
  channel: Channel;
  onChange: () => void;
}) {
  const [showAddPkg, setShowAddPkg] = useState(false);
  const [pkgName, setPkgName] = useState('');
  const [pkgPrice, setPkgPrice] = useState('');
  const [pkgDays, setPkgDays] = useState('30');
  const [pkgErr, setPkgErr] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(channel.name);
  const [editWelcome, setEditWelcome] = useState(channel.welcomeMessage);
  const [editIban, setEditIban] = useState(channel.ibanInfo ?? '');
  const [editErr, setEditErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function addPackage(e: React.FormEvent) {
    e.preventDefault();
    setPkgErr(null);
    try {
      await api.post(`/channels/${channel.id}/packages`, {
        name: pkgName,
        price: parseFloat(pkgPrice),
        durationDays: parseInt(pkgDays, 10),
      });
      setPkgName('');
      setPkgPrice('');
      setPkgDays('30');
      setShowAddPkg(false);
      onChange();
      toast.success('Paket eklendi', `${pkgName} — ${pkgPrice} ${channel.currency}`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Paket eklenemedi';
      setPkgErr(msg);
      toast.error('Paket eklenemedi', msg);
    }
  }

  async function removePackage(id: string) {
    if (!confirm('Bu paketi silmek istediğine emin misin?')) return;
    try {
      await api.delete(`/packages/${id}`);
      onChange();
      toast.success('Paket silindi');
    } catch (err) {
      toast.error(
        'Silinemedi',
        err instanceof ApiError ? err.message : 'Sunucu hatası',
      );
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setEditErr(null);
    setSaving(true);
    try {
      await api.patch(`/channels/${channel.id}`, {
        name: editName,
        welcomeMessage: editWelcome,
        ibanInfo: editIban || null,
      });
      setEditing(false);
      onChange();
      toast.success('Kanal güncellendi');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Kaydedilemedi';
      setEditErr(msg);
      toast.error('Kaydedilemedi', msg);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    try {
      await api.patch(`/channels/${channel.id}`, { isActive: !channel.isActive });
      onChange();
      toast.success(
        channel.isActive ? 'Kanal pasifleştirildi' : 'Kanal aktifleştirildi',
      );
    } catch (err) {
      toast.error(
        'İşlem başarısız',
        err instanceof ApiError ? err.message : 'Sunucu hatası',
      );
    }
  }

  async function deleteChannel() {
    if (
      !confirm(
        `"${channel.name}" kanalını silmek istediğine emin misin? ` +
          'Bağlı paketler, dekontlar ve üyelik kayıtları da silinir.',
      )
    )
      return;
    try {
      await api.delete(`/channels/${channel.id}`);
      onChange();
      toast.success('Kanal silindi');
    } catch (err) {
      toast.error(
        'Silinemedi',
        err instanceof ApiError ? err.message : 'Sunucu hatası',
      );
    }
  }

  return (
    <div
      className={`card overflow-hidden ${
        !channel.isActive ? 'border-amber-200' : ''
      }`}
    >
      {/* Header */}
      <div className="p-5 border-b border-slate-200/60">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                channel.isActive
                  ? 'bg-brand-50 text-brand-600'
                  : 'bg-amber-50 text-amber-600'
              }`}
            >
              <Hash size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-semibold text-slate-900 truncate">
                  {channel.name}
                </h3>
                {channel.isActive ? (
                  <span className="badge-success">Aktif</span>
                ) : (
                  <span className="badge-warning">Pasif</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap text-sm text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                    {channel.telegramChatId}
                  </code>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users size={14} />
                  {channel._count.memberships} üye
                </span>
                <span className="inline-flex items-center gap-1">
                  <UserPlus size={14} />
                  {channel._count.joinRequests} istek
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setEditing(!editing)}
              className="btn-secondary btn-sm"
            >
              {editing ? (
                <>
                  <X size={14} /> İptal
                </>
              ) : (
                <>
                  <Edit3 size={14} /> Düzenle
                </>
              )}
            </button>
            <button
              onClick={toggleActive}
              className={channel.isActive ? 'btn-secondary btn-sm' : 'btn-success btn-sm'}
              title={channel.isActive ? 'Pasifleştir' : 'Aktifleştir'}
            >
              <Power size={14} />
              {channel.isActive ? 'Pasifleştir' : 'Aktifleştir'}
            </button>
            <button
              onClick={deleteChannel}
              className="btn-danger-ghost btn-sm btn-icon"
              title="Kanalı sil"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {!channel.isActive && !editing && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-lg p-3.5 flex gap-3">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <p>
              Kanal pasif — katılma istekleri işlenmiyor. Önce{' '}
              <strong>en az 1 paket</strong> ekle, sonra <strong>Aktifleştir</strong>{' '}
              tıkla.
            </p>
          </div>
        )}

        {editing ? (
          <form onSubmit={saveEdit} className="space-y-4">
            <div>
              <label className="label">Kanal Adı</label>
              <input
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">
                <span className="inline-flex items-center gap-1.5">
                  <MessageSquare size={14} /> Hoş Geldin Mesajı
                </span>
              </label>
              <textarea
                rows={3}
                required
                value={editWelcome}
                onChange={(e) => setEditWelcome(e.target.value)}
                className="input"
                placeholder="Merhaba! Kanalımıza katılmak için aşağıdaki ödeme bilgilerini kullanabilirsin."
              />
              <p className="text-xs text-slate-500 mt-1">
                Katılma isteği gönderene bu metin DM olarak iletilir.
              </p>
            </div>
            <div>
              <label className="label">
                <span className="inline-flex items-center gap-1.5">
                  <CreditCard size={14} /> IBAN / Ödeme Bilgileri
                </span>
              </label>
              <textarea
                rows={4}
                value={editIban}
                onChange={(e) => setEditIban(e.target.value)}
                className="input font-mono text-sm"
                placeholder={
                  'Adı Soyadı: Mehmet Yılmaz\nIBAN: TR00 0000 0000 0000 0000 0000 00\nAçıklama: kullanıcı_adı'
                }
              />
            </div>
            {editErr && (
              <div className="text-sm text-red-600 flex items-center gap-1.5">
                <AlertCircle size={14} /> {editErr}
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setEditName(channel.name);
                  setEditWelcome(channel.welcomeMessage);
                  setEditIban(channel.ibanInfo ?? '');
                }}
                className="btn-secondary"
              >
                İptal
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <MessageSquare size={14} className="text-slate-500" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Hoş Geldin Mesajı
                </p>
              </div>
              <p className="text-sm whitespace-pre-wrap break-words text-slate-700 leading-relaxed">
                {channel.welcomeMessage}
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <CreditCard size={14} className="text-slate-500" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  IBAN / Ödeme
                </p>
              </div>
              {channel.ibanInfo ? (
                <p className="text-sm whitespace-pre-wrap break-words text-slate-700 font-mono leading-relaxed">
                  {channel.ibanInfo}
                </p>
              ) : (
                <p className="text-sm text-slate-400 italic">
                  Henüz tanımlanmadı — &quot;Düzenle&quot; ile ekle.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Packages */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-sm text-slate-900 inline-flex items-center gap-1.5">
              <PackageIcon size={15} className="text-slate-500" />
              Paketler{' '}
              <span className="text-slate-400 font-normal">
                ({channel.packages.length})
              </span>
            </h4>
            <button
              onClick={() => setShowAddPkg(!showAddPkg)}
              className="btn-ghost btn-sm"
            >
              {showAddPkg ? (
                <>
                  <X size={13} /> İptal
                </>
              ) : (
                <>
                  <Plus size={13} /> Paket Ekle
                </>
              )}
            </button>
          </div>

          {showAddPkg && (
            <form
              onSubmit={addPackage}
              className="bg-slate-50 border border-slate-200/80 p-4 rounded-lg mb-3 grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end"
            >
              <div>
                <label className="label text-xs">Ad</label>
                <input
                  required
                  value={pkgName}
                  onChange={(e) => setPkgName(e.target.value)}
                  className="input"
                  placeholder="1 Aylık"
                />
              </div>
              <div>
                <label className="label text-xs">
                  Fiyat ({channel.currency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={pkgPrice}
                  onChange={(e) => setPkgPrice(e.target.value)}
                  className="input"
                  placeholder="299"
                />
              </div>
              <div>
                <label className="label text-xs">Süre (gün)</label>
                <input
                  type="number"
                  required
                  value={pkgDays}
                  onChange={(e) => setPkgDays(e.target.value)}
                  className="input"
                />
              </div>
              <button type="submit" className="btn-primary">
                Ekle
              </button>
              {pkgErr && (
                <p className="text-sm text-red-600 col-span-full">{pkgErr}</p>
              )}
            </form>
          )}

          {channel.packages.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg">
              <PackageIcon size={24} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">
                Henüz paket yok — en az bir paket eklemelisin.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200/60 border border-slate-200/80 rounded-lg overflow-hidden">
              {channel.packages.map((p) => (
                <li
                  key={p.id}
                  className="px-4 py-3 flex items-center justify-between bg-white hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                      <PackageIcon size={16} />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 text-sm">
                        {p.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {p.price} {channel.currency} · {p.durationDays} gün
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removePackage(p.id)}
                    className="btn-danger-ghost btn-sm btn-icon"
                    title="Sil"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
