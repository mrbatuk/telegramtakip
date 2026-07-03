'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, ArrowRight, Sparkles, X } from 'lucide-react';
import { api } from '@/lib/api';

interface Step {
  key: string;
  label: string;
  done: boolean;
}

interface OnboardingData {
  steps: Step[];
  doneCount: number;
  totalCount: number;
  allDone: boolean;
}

const DISMISS_KEY = 'tt_onboarding_dismissed';

export function OnboardingChecklist() {
  const [data, setData] = useState<OnboardingData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDismissed(!!localStorage.getItem(DISMISS_KEY));
    }
    api.get<OnboardingData>('/onboarding')
      .then(setData)
      .catch(() => {});
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  }

  if (!data || dismissed || data.allDone) return null;

  const percent = Math.round((data.doneCount / data.totalCount) * 100);

  // Sıradaki adıma yönlendirme linki
  const nextStep = data.steps.find((s) => !s.done);
  const nextHref: Record<string, string> = {
    bot: '/dashboard/bots',
    channel: '/dashboard/bots',
    package: '/dashboard/bots',
    activate: '/dashboard/bots',
    firstMember: '/dashboard/bots',
  };

  return (
    <div className="card p-5 bg-gradient-to-br from-brand-50 via-white to-brand-50/30 border-brand-200">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-11 h-11 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Hoş geldin! Başlangıç adımları</h3>
            <p className="text-sm text-slate-600 mt-0.5">
              <strong>{data.doneCount}/{data.totalCount}</strong> tamamlandı
              — botun tam olarak çalışması için birkaç adım kaldı
            </p>
          </div>
        </div>
        <button onClick={() => setMinimized(!minimized)} className="btn-ghost btn-sm" title={minimized ? 'Aç' : 'Küçült'}>
          {minimized ? '▾' : '▴'}
        </button>
        <button onClick={dismiss} className="btn-ghost btn-sm" title="Bir daha gösterme">
          <X size={14} />
        </button>
      </div>

      <div className="w-full h-2 bg-white rounded-full overflow-hidden mb-4 ring-1 ring-slate-200">
        <div className="h-full bg-brand-600 transition-all" style={{ width: `${percent}%` }} />
      </div>

      {!minimized && (
        <>
          <ul className="space-y-2 mb-4">
            {data.steps.map((step) => (
              <li key={step.key} className="flex items-center gap-2.5 text-sm">
                {step.done ? (
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                ) : (
                  <Circle size={18} className="text-slate-300 shrink-0" />
                )}
                <span className={step.done ? 'text-slate-500 line-through' : 'text-slate-900 font-medium'}>
                  {step.label}
                </span>
              </li>
            ))}
          </ul>

          {nextStep && (
            <Link href={nextHref[nextStep.key] ?? '/dashboard/bots'} className="btn-primary btn-sm">
              Devam Et: {nextStep.label.split(' ').slice(0, 3).join(' ')}...
              <ArrowRight size={13} />
            </Link>
          )}
        </>
      )}
    </div>
  );
}
