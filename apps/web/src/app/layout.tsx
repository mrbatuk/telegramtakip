import './globals.css';
import type { Metadata } from 'next';
import { Toaster } from '@/lib/toast';
import { CookieConsent } from '@/components/CookieConsent';

export const metadata: Metadata = {
  title: 'TelegramTakip — Ücretli Kanal Yönetimi',
  description: 'Telegram ücretli kanallarınız için otomatik üye + ödeme yönetimi',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>
        {children}
        <Toaster />
        <CookieConsent />
      </body>
    </html>
  );
}
