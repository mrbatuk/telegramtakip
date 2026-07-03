'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie, X } from 'lucide-react';

const KEY = 'tt_cookie_consent';

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const v = localStorage.getItem(KEY);
    if (!v) {
      // Küçük bir delay - CLS engellemek için
      const t = setTimeout(() => setShow(true), 500);
      return () => clearTimeout(t);
    }
  }, []);

  function accept() {
    localStorage.setItem(KEY, JSON.stringify({ accepted: true, at: new Date().toISOString() }));
    setShow(false);
  }

  function dismiss() {
    // Reddetmek de kabul etmek de aynı sonuç — sadece bir daha gösterme.
    // Zorunlu çerezler zaten servisin çalışması için gerekli.
    localStorage.setItem(KEY, JSON.stringify({ accepted: false, at: new Date().toISOString() }));
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 pointer-events-none">
      <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-xl shadow-2xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center gap-3 pointer-events-auto">
        <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
          <Cookie size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900">Çerez Kullanımı</p>
          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
            Bu sitede oturum yönetimi için zorunlu çerezler kullanılır. Detaylar için{' '}
            <Link href="/gizlilik" className="text-brand-600 hover:underline">Gizlilik Politikası</Link>
            {' '}ve{' '}
            <Link href="/kvkk" className="text-brand-600 hover:underline">KVKK Aydınlatma Metni</Link>&apos;ni inceleyebilirsin.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
          <button onClick={dismiss} className="btn-ghost btn-sm flex-1 md:flex-none" title="Sadece zorunlu çerezler">
            <X size={14} /> Kapat
          </button>
          <button onClick={accept} className="btn-primary btn-sm flex-1 md:flex-none">
            Kabul Et
          </button>
        </div>
      </div>
    </div>
  );
}
