'use client';
import { useEffect, useState } from 'react';
import { History, Search } from 'lucide-react';
import { api } from '@/lib/api';

interface AuditLog {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  createdAt: string;
  actor: { email: string; fullName: string | null };
  target: { email: string; fullName: string | null } | null;
}

const ACTION_LABELS: Record<string, string> = {
  'tenant.update': 'Kullanıcı Güncelle',
  'tenant.extend': 'Abonelik Uzat',
  'tenant.delete': 'Kullanıcı Sil',
  'subscription.create': 'Ödeme Kaydı',
  'subscription.delete': 'Ödeme Kaydı Sil',
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[] | null>(null);

  useEffect(() => {
    api.get<{ logs: AuditLog[] }>('/admin/audit').then((r) => setLogs(r.logs));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">İşlem Geçmişi</h1>
        <p className="text-sm text-slate-500 mt-1">
          Admin panelinden yapılan tüm işlemler (son 500 kayıt)
        </p>
      </div>

      {logs === null ? (
        <div className="card p-6 space-y-3">
          <div className="skeleton h-12" />
          <div className="skeleton h-12" />
        </div>
      ) : logs.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <History size={26} />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">
            Henüz işlem yok
          </h3>
          <p className="text-sm text-slate-500">
            Admin panelinde yapılan her işlem burada kaydedilir
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-slate-200/60">
          {logs.map((log) => (
            <div key={log.id} className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="badge-info">
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(log.createdAt).toLocaleString('tr-TR')}
                    </span>
                  </div>
                  <p className="text-sm mt-1.5 text-slate-700">
                    <strong className="text-slate-900">{log.actor.email}</strong>
                    {log.target && (
                      <>
                        {' → '}
                        <strong className="text-slate-900">{log.target.email}</strong>
                      </>
                    )}
                  </p>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                        Detaylar
                      </summary>
                      <pre className="text-xs bg-slate-50 border border-slate-200 rounded p-2 mt-1 overflow-x-auto font-mono">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
