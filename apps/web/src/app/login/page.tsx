'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Send, AlertCircle, ArrowRight, Mail } from 'lucide-react';
import { api, setToken, ApiError } from '@/lib/api';
import { toast } from '@/lib/toast';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNeedsVerification(false);
    setLoading(true);
    try {
      const res = await api.post<{ token: string }>('/auth/login', {
        email,
        password,
      });
      setToken(res.token);
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        const data = err.data as { error?: string };
        if (data.error === 'email_not_verified') {
          setNeedsVerification(true);
          setError(err.message);
          setLoading(false);
          return;
        }
      }
      setError(err instanceof ApiError ? err.message : 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  }

  async function resendVerification() {
    try {
      await api.post('/auth/resend-verification', { email });
      toast.success(
        'Doğrulama e-postası tekrar gönderildi',
        `${email} adresini kontrol et`,
      );
    } catch {
      toast.error('Gönderilemedi', 'Lütfen daha sonra tekrar dene');
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
          <h1 className="text-xl font-semibold text-slate-900 mb-1">Tekrar hoş geldin</h1>
          <p className="text-sm text-slate-500 mb-6">
            Panele giriş yap ve botlarını yönet
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
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Şifre</label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-brand-600 hover:text-brand-700"
                >
                  Şifremi unuttum
                </Link>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div className="text-sm text-red-600 flex items-center gap-1.5">
                <AlertCircle size={14} /> {error}
              </div>
            )}
            {needsVerification && (
              <button
                type="button"
                onClick={resendVerification}
                className="btn-secondary w-full"
              >
                <Mail size={14} /> Doğrulama e-postasını yeniden gönder
              </button>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>
        </div>

        <p className="text-sm text-center mt-5 text-slate-600">
          Hesabın yok mu?{' '}
          <Link href="/register" className="text-brand-600 hover:text-brand-700 font-medium">
            Kayıt ol
          </Link>
        </p>
      </div>
    </main>
  );
}
