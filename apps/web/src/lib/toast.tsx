'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

// Basit event bus tabanlı toast sistemi. Bağımlılıksız.

type ToastKind = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
  duration: number;
}

let nextId = 1;
const listeners = new Set<(t: ToastItem) => void>();

function emit(kind: ToastKind, title: string, description?: string, duration = 3500) {
  const t: ToastItem = { id: nextId++, kind, title, description, duration };
  listeners.forEach((l) => l(t));
}

export const toast = {
  success(title: string, description?: string) {
    emit('success', title, description);
  },
  error(title: string, description?: string) {
    emit('error', title, description, 5500);
  },
  info(title: string, description?: string) {
    emit('info', title, description);
  },
  warning(title: string, description?: string) {
    emit('warning', title, description, 4500);
  },
};

// ---- UI ----

const STYLES: Record<
  ToastKind,
  {
    Icon: typeof CheckCircle2;
    iconColor: string;
    bg: string;
    border: string;
    title: string;
  }
> = {
  success: {
    Icon: CheckCircle2,
    iconColor: 'text-emerald-600',
    bg: 'bg-white',
    border: 'border-emerald-200',
    title: 'text-emerald-900',
  },
  error: {
    Icon: AlertCircle,
    iconColor: 'text-red-600',
    bg: 'bg-white',
    border: 'border-red-200',
    title: 'text-red-900',
  },
  warning: {
    Icon: AlertTriangle,
    iconColor: 'text-amber-600',
    bg: 'bg-white',
    border: 'border-amber-200',
    title: 'text-amber-900',
  },
  info: {
    Icon: Info,
    iconColor: 'text-brand-600',
    bg: 'bg-white',
    border: 'border-brand-200',
    title: 'text-brand-900',
  },
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener = (t: ToastItem) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => {
        setItems((prev) => prev.filter((p) => p.id !== t.id));
      }, t.duration);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  function dismiss(id: number) {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-[calc(100vw-2rem)] w-96">
      {items.map((t) => {
        const s = STYLES[t.kind];
        const Icon = s.Icon;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto ${s.bg} ${s.border} border rounded-xl shadow-lg p-3.5 flex gap-3 items-start animate-slide-in`}
            role="status"
          >
            <div className={`shrink-0 mt-0.5 ${s.iconColor}`}>
              <Icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${s.title}`}>{t.title}</p>
              {t.description && (
                <p className="text-xs text-slate-600 mt-0.5">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-slate-400 hover:text-slate-700 p-0.5 -m-0.5"
              aria-label="Kapat"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
