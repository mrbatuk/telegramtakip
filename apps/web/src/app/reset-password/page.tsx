'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Send, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Şifreler eşleşmiyor');
      return;
    }
    if (password.length < 8) {
      setError('Şifre en az 8 karakter olmalı');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'İşlem başarısız');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-white to-brand-50/30">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center shadow-sm">
            <Send size={20} className="text-white" />
          </div>
          <span className="font-semibold text-lg text-slate-900">TelegramTakip</span>
        </Link>

        <div className="card p-8">
          {done ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 mx-auto flex items-center justify-center mb-4">
                <CheckCircle2 size={28} className="text-emerald-600" />
              </div>
              <h1 className="text-xl font-semibold text-slate-900 mb-2">Şifre güncellendi</h1>
              <p className="text-sm text-slate-600 mb-6">
                Yeni şifrenle giriş yapabilirsin.
              </p>
              <Link href="/login" className="btn-primary w-full">
                Giriş Yap <ArrowRight size={16} />
              </Link>
            </div>
          ) : !token ? (
            <div className="text-center">
              <h1 className="text-xl font-semibold text-slate-900 mb-2">Token Yok</h1>
              <p className="text-sm text-slate-600 mb-6">
                Geçerli bir sıfırlama linki gerekli.
              </p>
              <Link href="/forgot-password" className="btn-secondary w-full">
                Yeni link iste
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-slate-900 mb-1">Yeni Şifre Belirle</h1>
              <p className="text-sm text-slate-500 mb-6">
                En az 8 karakter olmalı
              </p>
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="label">Yeni şifre</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                    placeholder="En az 8 karakter"
                  />
                </div>
                <div>
                  <label className="label">Şifre tekrar</label>
                  <input
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="input"
                  />
                </div>
                {error && (
                  <div className="text-sm text-red-600 flex items-center gap-1.5">
                    <AlertCircle size={14} /> {error}
                  </div>
                )}
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
