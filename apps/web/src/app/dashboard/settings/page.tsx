'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Lock,
  Mail,
  Bell,
  AlertTriangle,
  Save,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { api, ApiError, setToken } from '@/lib/api';
import { toast } from '@/lib/toast';

interface Me {
  email: string;
  fullName: string | null;
  notifyOnNewReceipt: boolean;
  notifyOnSubExpiry: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  const [fullName, setFullName] = useState('');
  const [notifyReceipt, setNotifyReceipt] = useState(true);
  const [notifyExpiry, setNotifyExpiry] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const r = await api.get<{ tenant: Me }>('/auth/me');
    setMe(r.tenant);
    setFullName(r.tenant.fullName ?? '');
    setNotifyReceipt(r.tenant.notifyOnNewReceipt);
    setNotifyExpiry(r.tenant.notifyOnSubExpiry);
  }
  useEffect(() => { load(); }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.patch('/profile', {
        fullName: fullName || null,
        notifyOnNewReceipt: notifyReceipt,
        notifyOnSubExpiry: notifyExpiry,
      });
      toast.success('Profil güncellendi');
      await load();
    } catch (err) {
      toast.error('Kaydedilemedi', err instanceof ApiError ? err.message : 'Sunucu hatası');
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Şifreler eşleşmiyor');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Şifre en az 8 karakter olmalı');
      return;
    }
    setSavingPassword(true);
    try {
      await api.post('/profile/change-password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Şifre değiştirildi');
    } catch (err) {
      toast.error(
        'Değiştirilemedi',
        err instanceof ApiError ? err.message : 'Sunucu hatası',
      );
    } finally {
      setSavingPassword(false);
    }
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm(`E-postanı ${newEmail} olarak değiştirmek istediğine emin misin? Yeni adresine doğrulama linki gönderilecek ve çıkış yapılacak.`)) return;
    setSavingEmail(true);
    try {
      await api.post('/profile/change-email', { newEmail, currentPassword: emailCurrentPassword });
      toast.success(
        'E-posta güncellendi',
        `${newEmail} adresine doğrulama linki gönderildi. Doğruladıktan sonra tekrar giriş yap.`,
      );
      setToken(null);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err) {
      toast.error(
        'Değiştirilemedi',
        err instanceof ApiError ? err.message : 'Sunucu hatası',
      );
    } finally {
      setSavingEmail(false);
    }
  }

  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault();
    if (deleteConfirm !== 'SIL') {
      toast.error('Onay için "SIL" yaz');
      return;
    }
    if (!confirm('Hesabını kalıcı olarak silmek istediğine emin misin? Bu işlem geri alınamaz — tüm botların, kanalların, ödemelerin silinir.')) return;
    setDeleting(true);
    try {
      await api.post('/profile/delete-account', {
        password: deletePassword,
        confirmation: deleteConfirm,
      });
      toast.success('Hesabın silindi');
      setToken(null);
      setTimeout(() => router.push('/'), 1500);
    } catch (err) {
      toast.error(
        'Silinemedi',
        err instanceof ApiError ? err.message : 'Sunucu hatası',
      );
    } finally {
      setDeleting(false);
    }
  }

  if (!me) {
    return <div className="space-y-4"><div className="skeleton h-6 w-64" /><div className="skeleton h-40" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Ayarlar</h1>
        <p className="text-sm text-slate-500 mt-1">Profil, şifre, bildirimler ve hesap yönetimi</p>
      </div>

      {/* Profil */}
      <form onSubmit={saveProfile} className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <User size={17} className="text-brand-600" />
          <h2 className="font-semibold text-slate-900">Profil</h2>
        </div>
        <div>
          <label className="label">Ad Soyad</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">E-posta (değiştirmek için aşağıdaki bölümü kullan)</label>
          <input value={me.email} disabled className="input opacity-60" />
        </div>

        <div className="border-t border-slate-200 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={15} className="text-slate-500" />
            <h3 className="font-medium text-sm">Bildirim Tercihleri</h3>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={notifyReceipt} onChange={(e) => setNotifyReceipt(e.target.checked)} className="w-4 h-4 rounded" />
            Yeni dekont geldiğinde e-posta al
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer mt-2">
            <input type="checkbox" checked={notifyExpiry} onChange={(e) => setNotifyExpiry(e.target.checked)} className="w-4 h-4 rounded" />
            Aboneliğim yaklaşırken e-posta hatırlatması al
          </label>
        </div>

        <button type="submit" disabled={savingProfile} className="btn-primary">
          <Save size={16} /> {savingProfile ? 'Kaydediliyor...' : 'Profili Kaydet'}
        </button>
      </form>

      {/* Şifre değiştir */}
      <form onSubmit={changePassword} className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Lock size={17} className="text-brand-600" />
          <h2 className="font-semibold text-slate-900">Şifre Değiştir</h2>
        </div>
        <div>
          <label className="label">Mevcut Şifre</label>
          <input type="password" required autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="input" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Yeni Şifre (min 8 karakter)</label>
            <input type="password" required minLength={8} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Yeni Şifre (Tekrar)</label>
            <input type="password" required autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input" />
          </div>
        </div>
        <button type="submit" disabled={savingPassword} className="btn-primary">
          <Save size={16} /> {savingPassword ? 'Kaydediliyor...' : 'Şifreyi Değiştir'}
        </button>
      </form>

      {/* E-posta değiştir */}
      <form onSubmit={changeEmail} className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Mail size={17} className="text-brand-600" />
          <h2 className="font-semibold text-slate-900">E-posta Adresini Değiştir</h2>
        </div>
        <p className="text-xs text-slate-500">
          Yeni adrese doğrulama linki gönderilir. Doğruladıktan sonra tekrar giriş yapman gerekir.
        </p>
        <div>
          <label className="label">Yeni E-posta</label>
          <input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">Şu anki Şifren</label>
          <input type="password" required autoComplete="current-password" value={emailCurrentPassword} onChange={(e) => setEmailCurrentPassword(e.target.value)} className="input" />
        </div>
        <button type="submit" disabled={savingEmail || !newEmail} className="btn-primary">
          <Save size={16} /> {savingEmail ? 'Gönderiliyor...' : 'E-postayı Değiştir'}
        </button>
      </form>

      {/* Hesap silme */}
      <form onSubmit={deleteAccount} className="card p-6 space-y-4 border-red-200 bg-red-50/30">
        <div className="flex items-center gap-2">
          <AlertTriangle size={17} className="text-red-600" />
          <h2 className="font-semibold text-red-900">Tehlikeli Alan — Hesabı Sil</h2>
        </div>
        <div className="p-3 bg-white border border-red-200 rounded-lg text-sm text-red-800 flex gap-2 items-start">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Bu işlem geri alınamaz.</p>
            <p className="text-xs mt-1">Tüm botların, kanalların, dekontların, üyeliklerin, abonelik geçmişin kalıcı olarak silinir.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Şifren</label>
            <input type="password" required autoComplete="current-password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Onaylamak için &quot;SIL&quot; yaz</label>
            <input type="text" required value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} className="input font-mono" placeholder="SIL" />
          </div>
        </div>
        <button type="submit" disabled={deleting || deleteConfirm !== 'SIL'} className="btn-danger">
          <Trash2 size={16} /> {deleting ? 'Siliniyor...' : 'Hesabımı Kalıcı Olarak Sil'}
        </button>
      </form>
    </div>
  );
}
