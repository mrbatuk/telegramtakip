'use client';
import { useEffect, useState } from 'react';
import {
  Mail,
  Save,
  Wifi,
  Send,
  AlertCircle,
  CheckCircle2,
  Info,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/lib/toast';

interface Settings {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassPreview: string;
  smtpPassSet: boolean;
  emailFromName: string;
  emailFromAddress: string;
  adminNotificationEmail: string;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
  trialEnabled: boolean;
  trialDays: number;
  trialDefaultPlan: string;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);

  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [fromName, setFromName] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [testEmailAddr, setTestEmailAddr] = useState('');
  const [trialEnabled, setTrialEnabled] = useState(true);
  const [trialDays, setTrialDays] = useState('14');
  const [trialDefaultPlan, setTrialDefaultPlan] = useState('PRO');
  const [planOptions, setPlanOptions] = useState<Array<{ key: string; name: string }>>([]);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get<{ settings: Settings }>('/admin/settings');
      setSettings(r.settings);
      setSmtpHost(r.settings.smtpHost);
      setSmtpPort(String(r.settings.smtpPort));
      setSmtpSecure(r.settings.smtpSecure);
      setSmtpUser(r.settings.smtpUser);
      setSmtpPass(''); // hiç doldurulmaz — güvenlik
      setFromName(r.settings.emailFromName);
      setFromAddress(r.settings.emailFromAddress);
      setAdminEmail(r.settings.adminNotificationEmail);
      setTrialEnabled(r.settings.trialEnabled);
      setTrialDays(String(r.settings.trialDays));
      setTrialDefaultPlan(r.settings.trialDefaultPlan);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    api.get<{ plans: Array<{ key: string; name: string }> }>('/admin/plans')
      .then((r) => setPlanOptions(r.plans))
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.put('/admin/settings', {
        smtpHost: smtpHost || null,
        smtpPort: parseInt(smtpPort, 10) || 587,
        smtpSecure,
        smtpUser: smtpUser || null,
        // Boş ise dokunma — mevcut şifreyi koru
        smtpPass: smtpPass || undefined,
        emailFromName: fromName || null,
        emailFromAddress: fromAddress || null,
        adminNotificationEmail: adminEmail || null,
        trialEnabled,
        trialDays: parseInt(trialDays, 10) || 14,
        trialDefaultPlan,
      });
      setSmtpPass('');
      await load();
      toast.success('Ayarlar kaydedildi', 'SMTP değişiklikleri anında geçerli');
    } catch (err) {
      toast.error(
        'Kaydedilemedi',
        err instanceof ApiError ? err.message : 'Sunucu hatası',
      );
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    try {
      const r = await api.post<{ ok: boolean; error?: string }>(
        '/admin/settings/test-connection',
      );
      if (r.ok) {
        toast.success('Bağlantı başarılı', 'SMTP sunucusuna ulaşıldı');
      } else {
        toast.error('Bağlantı başarısız', r.error);
      }
      await load();
    } finally {
      setTesting(false);
    }
  }

  async function sendTest() {
    if (!testEmailAddr) {
      toast.warning('E-posta gir', 'Test için bir hedef e-posta gerekli');
      return;
    }
    setSendingTest(true);
    try {
      const r = await api.post<{ ok: boolean; error?: string }>(
        '/admin/settings/test-send',
        { to: testEmailAddr },
      );
      if (r.ok) {
        toast.success('Test e-postası gönderildi', `${testEmailAddr} adresini kontrol et`);
      } else {
        toast.error('Gönderilemedi', r.error);
      }
    } finally {
      setSendingTest(false);
    }
  }

  if (loading || !settings) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-64" />
        <div className="skeleton h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Sistem Ayarları</h1>
        <p className="text-sm text-slate-500 mt-1">
          Email (SMTP) ve bildirim yapılandırması
        </p>
      </div>

      {/* Durum kartı */}
      <div className="card p-4 flex items-start gap-3 bg-blue-50 border-blue-200">
        <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p>
            SMTP boş bırakılırsa e-postalar gönderilmez, konsola log&apos;lanır (dev modu).
            Zoho, Gmail, Yandex gibi sağlayıcıların SMTP bilgilerini buraya girebilirsin.
          </p>
        </div>
      </div>

      {/* SMTP kartı */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail size={17} className="text-brand-600" />
            <h2 className="font-semibold text-slate-900">SMTP Sunucusu</h2>
          </div>
          {settings.lastTestAt && (
            <div className="flex items-center gap-1 text-xs">
              {settings.lastTestOk ? (
                <>
                  <CheckCircle2 size={12} className="text-emerald-600" />
                  <span className="text-emerald-700">
                    Son test başarılı ({new Date(settings.lastTestAt).toLocaleString('tr-TR')})
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle size={12} className="text-red-600" />
                  <span className="text-red-700">
                    Son test başarısız ({new Date(settings.lastTestAt).toLocaleString('tr-TR')})
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {settings.lastTestMessage && !settings.lastTestOk && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 font-mono">
            {settings.lastTestMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="label">SMTP Sunucusu</label>
            <input
              type="text"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              className="input"
              placeholder="smtp.zoho.com"
            />
          </div>
          <div>
            <label className="label">Port</label>
            <input
              type="number"
              value={smtpPort}
              onChange={(e) => setSmtpPort(e.target.value)}
              className="input"
              placeholder="587"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={smtpSecure}
            onChange={(e) => setSmtpSecure(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300"
          />
          <span>
            SSL/TLS bağlantı kullan (port 465 için açık, 587 için genelde kapalı — STARTTLS)
          </span>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Kullanıcı Adı</label>
            <input
              type="text"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              className="input"
              placeholder="noreply@domainin.com"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="label">
              <span className="inline-flex items-center gap-1">
                <Lock size={12} /> Şifre / App Password
              </span>
            </label>
            <input
              type="password"
              value={smtpPass}
              onChange={(e) => setSmtpPass(e.target.value)}
              className="input"
              placeholder={
                settings.smtpPassSet
                  ? `Mevcut: ${settings.smtpPassPreview} — değiştirmek için yaz`
                  : 'Boş bırakma'
              }
              autoComplete="new-password"
            />
            {settings.smtpPassSet && !smtpPass && (
              <p className="text-xs text-slate-500 mt-1">
                Değiştirmek istemiyorsan boş bırak
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Gönderici + admin kartı */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Send size={17} className="text-brand-600" />
          <h2 className="font-semibold text-slate-900">Gönderim Bilgileri</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Gönderen Adı</label>
            <input
              type="text"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              className="input"
              placeholder="TelegramTakip"
            />
          </div>
          <div>
            <label className="label">Gönderen Adres</label>
            <input
              type="email"
              value={fromAddress}
              onChange={(e) => setFromAddress(e.target.value)}
              className="input"
              placeholder="noreply@domainin.com"
            />
          </div>
        </div>

        <div>
          <label className="label">Admin Bildirim Adresi</label>
          <input
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            className="input"
            placeholder="admin@domainin.com"
          />
          <p className="text-xs text-slate-500 mt-1">
            Yeni tenant kaydı ve sistem bildirimleri bu adrese gider
          </p>
        </div>
      </div>

      {/* Trial kartı */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Send size={17} className="text-brand-600" />
          <h2 className="font-semibold text-slate-900">Ücretsiz Deneme</h2>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={trialEnabled}
            onChange={(e) => setTrialEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300"
          />
          <span>
            <strong>Yeni kayıtlara ücretsiz deneme ver</strong> — kullanıcı hemen bot ekleyebilir, süre bittiğinde ödeme yapmalı
          </span>
        </label>
        {trialEnabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Deneme Süresi (gün)</label>
              <input
                type="number"
                min={1}
                max={365}
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Denemede Uygulanacak Plan</label>
              <select
                value={trialDefaultPlan}
                onChange={(e) => setTrialDefaultPlan(e.target.value)}
                className="input"
              >
                {planOptions.map((p) => (
                  <option key={p.key} value={p.key}>{p.name} ({p.key})</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">Deneme kullanıcısı bu planın limitlerini görür</p>
            </div>
          </div>
        )}
      </div>

      {/* Aksiyon çubuğu */}
      <div className="sticky bottom-0 md:bottom-4 bg-white border border-slate-200 rounded-xl shadow-lg p-4 flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={testConnection}
            disabled={testing}
            className="btn-secondary"
          >
            <Wifi size={14} className={testing ? 'animate-pulse' : ''} />
            {testing ? 'Test ediliyor...' : 'Bağlantı Testi'}
          </button>
          <div className="relative flex items-center gap-2">
            <input
              type="email"
              value={testEmailAddr}
              onChange={(e) => setTestEmailAddr(e.target.value)}
              placeholder="test@örnek.com"
              className="input w-56"
            />
            <button
              onClick={sendTest}
              disabled={sendingTest || !testEmailAddr}
              className="btn-secondary shrink-0"
            >
              <RefreshCw size={14} className={sendingTest ? 'animate-spin' : ''} />
              Test E-postası
            </button>
          </div>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary">
          <Save size={16} />
          {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
        </button>
      </div>
    </div>
  );
}
