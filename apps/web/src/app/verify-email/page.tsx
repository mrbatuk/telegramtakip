'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Send, CheckCircle2, XCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { api, ApiError } from '@/lib/api';

type State = 'loading' | 'success' | 'error' | 'missing';

export default function VerifyEmailPage() {
  const params = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<State>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setState('missing');
      return;
    }
    api
      .post<{ ok: boolean; message?: string }>('/auth/verify-email', { token })
      .then((r) => {
        setState('success');
        setMessage(r.message ?? 'E-posta doğrulandı');
      })
      .catch((err) => {
        setState('error');
        setMessage(
          err instanceof ApiError ? err.message : 'Doğrulama başarısız',
        );
      });
  }, [token]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-white to-brand-50/30">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center shadow-sm">
            <Send size={20} className="text-white" />
          </div>
          <span className="font-semibold text-lg text-slate-900">TelegramTakip</span>
        </Link>

        <div className="card p-8 text-center">
          {state === 'loading' && (
            <>
              <RefreshCw size={40} className="mx-auto text-slate-400 animate-spin mb-3" />
              <p className="text-slate-600">Doğrulanıyor...</p>
            </>
          )}
          {state === 'success' && (
            <>
              <div className="w-14 h-14 rounded-full bg-emerald-100 mx-auto flex items-center justify-center mb-4">
                <CheckCircle2 size={28} className="text-emerald-600" />
              </div>
              <h1 className="text-xl font-semibold text-slate-900 mb-2">Doğrulama Başarılı</h1>
              <p className="text-sm text-slate-600 mb-6">{message}</p>
              <Link href="/login" className="btn-primary w-full">
                Giriş Yap <ArrowRight size={16} />
              </Link>
            </>
          )}
          {state === 'error' && (
            <>
              <div className="w-14 h-14 rounded-full bg-red-100 mx-auto flex items-center justify-center mb-4">
                <XCircle size={28} className="text-red-600" />
              </div>
              <h1 className="text-xl font-semibold text-slate-900 mb-2">Doğrulama Başarısız</h1>
              <p className="text-sm text-slate-600 mb-6">{message}</p>
              <Link href="/login" className="btn-secondary w-full">
                Giriş sayfasına dön
              </Link>
              <p className="text-xs text-slate-500 mt-3">
                Link süresi dolduysa giriş sayfasında &quot;Yeni doğrulama linki gönder&quot;
                seçeneğini kullan.
              </p>
            </>
          )}
          {state === 'missing' && (
            <>
              <h1 className="text-xl font-semibold text-slate-900 mb-2">Token Yok</h1>
              <p className="text-sm text-slate-600 mb-4">
                Geçerli bir doğrulama linki gerekli. Kayıt e-postandaki linke tıkladığından emin ol.
              </p>
              <Link href="/login" className="btn-secondary w-full">
                Giriş sayfası
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
