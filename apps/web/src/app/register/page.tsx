'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Send, AlertCircle, ArrowRight, MailCheck } from 'lucide-react';
import { api, ApiError } from '@/lib/api';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!acceptTerms) {
      setError('Kullanım sözleşmesini ve KVKK aydınlatma metnini kabul etmelisin');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/register', {
        fullName,
        email,
        password,
        acceptTerms,
      });
      setRegistered(email);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Kayıt başarısız');
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
          {registered ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 mx-auto flex items-center justify-center mb-4">
                <MailCheck size={28} className="text-emerald-600" />
              </div>
              <h1 className="text-xl font-semibold text-slate-900 mb-2">
                Kayıt başarılı 🎉
              </h1>
              <p className="text-sm text-slate-600 mb-6">
                <strong>{registered}</strong> adresine bir doğrulama e-postası gönderdik.
                E-postandaki linke tıklayarak hesabını aktifleştir, sonra giriş yap.
              </p>
              <p className="text-xs text-slate-500 mb-4">
                Gelen kutunda görmüyorsan spam/gereksiz klasörünü kontrol et.
              </p>
              <Link href="/login" className="btn-primary w-full">
                Giriş sayfası
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-slate-900 mb-1">Hesap oluştur</h1>
              <p className="text-sm text-slate-500 mb-6">
                Ücretsiz kayıt ol, hemen botunu bağla
              </p>

              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="label">Ad Soyad</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input"
                    placeholder="Adın Soyadın"
                  />
                </div>
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
                  <label className="label">Şifre</label>
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

                <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 mt-0.5 shrink-0"
                    required
                  />
                  <span>
                    <Link href="/sozlesme" target="_blank" className="text-brand-600 hover:underline">
                      Kullanım Sözleşmesi
                    </Link>
                    'ni ve{' '}
                    <Link href="/kvkk" target="_blank" className="text-brand-600 hover:underline">
                      KVKK Aydınlatma Metni
                    </Link>
                    'ni okudum, kabul ediyorum.
                  </span>
                </label>

                {error && (
                  <div className="text-sm text-red-600 flex items-center gap-1.5">
                    <AlertCircle size={14} /> {error}
                  </div>
                )}
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'Kayıt olunuyor...' : 'Hesap Oluştur'}
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>
            </>
          )}
        </div>

        {!registered && (
          <p className="text-sm text-center mt-5 text-slate-600">
            Zaten hesabın var mı?{' '}
            <Link href="/login" className="text-brand-600 hover:text-brand-700 font-medium">
              Giriş yap
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
