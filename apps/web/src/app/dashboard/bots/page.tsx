'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bot as BotIcon,
  Plus,
  ArrowRight,
  Trash2,
  X,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/lib/toast';

interface Bot {
  id: string;
  botUsername: string;
  botName: string | null;
  isActive: boolean;
  _count: { channels: number };
}

export default function BotsPage() {
  const [bots, setBots] = useState<Bot[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [token, setTokenInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const r = await api.get<{ bots: Bot[] }>('/bots');
    setBots(r.bots);
  }

  useEffect(() => {
    load();
  }, []);

  async function addBot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWarning(null);
    setSaving(true);
    try {
      const r = await api.post<{ bot: Bot; warning?: string }>('/bots', {
        botToken: token,
      });
      setTokenInput('');
      setShowAdd(false);
      if (r.warning) {
        setWarning(r.warning);
        toast.warning('Bot eklendi (kısmi)', r.warning);
      } else {
        toast.success('Bot eklendi', `@${r.bot.botUsername} webhook'u ayarlandı`);
      }
      await load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Bot eklenemedi';
      setError(msg);
      toast.error('Bot eklenemedi', msg);
    } finally {
      setSaving(false);
    }
  }

  async function removeBot(id: string) {
    if (!confirm('Bu botu silmek istediğine emin misin? Bağlı kanallar ve üyelikler de silinir.'))
      return;
    try {
      await api.delete(`/bots/${id}`);
      await load();
      toast.success('Bot silindi');
    } catch (err) {
      toast.error(
        'Silinemedi',
        err instanceof ApiError ? err.message : 'Sunucu hatası',
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Botlar</h1>
          <p className="text-sm text-slate-500 mt-1">
            BotFather'dan oluşturduğun bot token'larını ekle ve kanallarına bağla
          </p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary">
          {showAdd ? (
            <>
              <X size={16} /> İptal
            </>
          ) : (
            <>
              <Plus size={16} /> Bot Ekle
            </>
          )}
        </button>
      </div>

      {warning && (
        <div className="card p-4 bg-amber-50 border-amber-200 flex gap-3">
          <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">{warning}</p>
        </div>
      )}

      {showAdd && (
        <form onSubmit={addBot} className="card p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-slate-900">Yeni Bot Ekle</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Telegram'da{' '}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 hover:underline inline-flex items-center gap-0.5"
              >
                @BotFather
                <ExternalLink size={11} />
              </a>{' '}
              komutu <code className="px-1 bg-slate-100 rounded text-xs">/newbot</code> ile
              bot oluştur, sana verdiği token'ı buraya yapıştır.
            </p>
          </div>
          <div>
            <label className="label">Bot Token</label>
            <input
              type="text"
              required
              placeholder="123456:ABC-DEF..."
              value={token}
              onChange={(e) => setTokenInput(e.target.value)}
              className={`input font-mono text-sm ${error ? 'input-error' : ''}`}
            />
          </div>
          {error && (
            <div className="text-sm text-red-600 flex items-center gap-1.5">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={saving || !token} className="btn-primary">
              {saving ? 'Doğrulanıyor...' : 'Ekle ve Webhook Ayarla'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAdd(false);
                setError(null);
              }}
              className="btn-secondary"
            >
              İptal
            </button>
          </div>
        </form>
      )}

      {bots === null ? (
        <div className="card p-6 space-y-3">
          <div className="skeleton h-12" />
          <div className="skeleton h-12" />
        </div>
      ) : bots.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-4">
            <BotIcon size={26} />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Henüz bot yok
          </h3>
          <p className="text-slate-500 max-w-md mx-auto mb-6">
            BotFather'dan oluşturduğun ilk botu ekleyerek başla.
          </p>
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus size={16} /> Bot Ekle
          </button>
        </div>
      ) : (
        <div className="card divide-y divide-slate-200/60">
          {bots.map((b) => (
            <div key={b.id} className="p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                  <BotIcon size={20} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 truncate">
                    {b.botName ?? b.botUsername}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-sm text-slate-500">@{b.botUsername}</span>
                    <span className="badge-neutral">
                      {b._count.channels} kanal
                    </span>
                    {b.isActive ? (
                      <span className="badge-success">Aktif</span>
                    ) : (
                      <span className="badge-warning">Pasif</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link href={`/dashboard/bots/${b.id}`} className="btn-secondary btn-sm">
                  Yönet
                  <ArrowRight size={14} />
                </Link>
                <button
                  onClick={() => removeBot(b.id)}
                  className="btn-danger-ghost btn-sm btn-icon"
                  title="Botu sil"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
