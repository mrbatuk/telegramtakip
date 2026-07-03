// Yasal sayfalar için ortak layout (KVKK, Sözleşme, Gizlilik)
import Link from 'next/link';
import { Send, ChevronLeft } from 'lucide-react';

export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <Send size={16} className="text-white" />
            </div>
            <span className="font-semibold text-slate-900">TelegramTakip</span>
          </Link>
          <Link
            href="/"
            className="text-sm text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
          >
            <ChevronLeft size={14} /> Ana sayfa
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="card p-8 md:p-10">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">{title}</h1>
          <p className="text-xs text-slate-500 mb-8">Son güncelleme: {updated}</p>
          <div className="prose prose-slate max-w-none text-sm md:text-[15px] leading-relaxed text-slate-700 space-y-4 [&>h2]:text-lg [&>h2]:font-semibold [&>h2]:text-slate-900 [&>h2]:mt-6 [&>h2]:mb-2 [&>h3]:font-medium [&>h3]:text-slate-900 [&>h3]:mt-4 [&>h3]:mb-1 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&_a]:text-brand-600 [&_a:hover]:underline">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
