'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Send, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Bir hata oluştu');
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
          {sent ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 mx-auto flex items-center justify-center mb-4">
                <CheckCircle2 size={28} className="text-emerald-600" />
              </div>
              <h1 className="text-xl font-semibold text-slate-900 mb-2">
                Sıfırlama linki gönderildi
              </h1>
              <p className="text-sm text-slate-600 mb-6">
                Eğer <strong>{email}</strong> sistemde kayıtlıysa, birkaç dakika içinde bir
                sıfırlama e-postası göreceksin. Spam klasörünü de kontrol et.
              </p>
              <Link href="/login" className="btn-secondary w-full">
                Giriş sayfası
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-slate-900 mb-1">Şifremi Unuttum</h1>
              <p className="text-sm text-slate-500 mb-6">
                E-posta adresini gir, sana sıfırlama linki gönderelim
              </p>
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="label">E-posta</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    placeholder="ornek@mail.com"
                  />
                </div>
                {error && (
                  <div className="text-sm text-red-600 flex items-center gap-1.5">
                    <AlertCircle size={14} /> {error}
                  </div>
                )}
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'Gönderiliyor...' : 'Sıfırlama Linki Gönder'}
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-sm text-center mt-5 text-slate-600">
          <Link href="/login" className="text-brand-600 hover:text-brand-700 font-medium">
            ← Giriş sayfasına dön
          </Link>
        </p>
      </div>
    </main>
  );
}
