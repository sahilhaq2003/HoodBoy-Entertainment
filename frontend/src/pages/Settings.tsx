import React, { useState, useRef, useEffect } from 'react';
import { User, Lock, Bell, Palette, Database, Shield, Save, Loader2, Camera, X, Users, ExternalLink, Copy } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { settingsApi, labelgridApi } from '../services/api';
import { authApi } from '../services/api';
import { applyAppearance, getAppearance, type AppearanceFontSize, type AppearanceTheme } from '../utils/appearance';

const sections = [
  { id: 'profile', label: 'Profile', icon: <User size={16} /> },
  { id: 'security', label: 'Security', icon: <Lock size={16} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette size={16} /> },
  { id: 'integrations', label: 'Integrations', icon: <Database size={16} /> },
  { id: 'permissions', label: 'Permissions', icon: <Shield size={16} /> },
];

interface NotificationPref {
  key: string;
  label: string;
  desc: string;
  enabled: boolean;
}

const Settings: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [activeSection, setActiveSection] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [fullName, setFullName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(Boolean(user?.twoFactorEnabled));
  const [twoFactorSetup, setTwoFactorSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [updatingTwoFactor, setUpdatingTwoFactor] = useState(false);

  const defaultNotifPrefs: NotificationPref[] = [
    { key: 'task_deadline', label: 'Task Deadline Alerts', desc: 'Get notified 24h before task deadlines', enabled: true },
    { key: 'release_reminders', label: 'Release Reminders', desc: 'Upcoming release notifications 7 days ahead', enabled: true },
    { key: 'contract_expiry', label: 'Contract Expiry Warnings', desc: 'Alert when contracts expire within 90 days', enabled: true },
    { key: 'approval_requests', label: 'New Approval Requests', desc: 'Get notified when items need your approval', enabled: true },
    { key: 'finance_reports', label: 'Finance Reports', desc: 'Monthly financial summary emails', enabled: false },
    { key: 'campaign_updates', label: 'Campaign Updates', desc: 'Daily marketing campaign performance', enabled: false },
  ];
  const [notifPrefs, setNotifPrefs] = useState<NotificationPref[]>(() => defaultNotifPrefs.map(pref => ({
    ...pref,
    enabled: user?.notificationPreferences?.find(saved => saved.key === pref.key)?.enabled ?? pref.enabled,
  })));
  const [savingNotifs, setSavingNotifs] = useState(false);

  const initialAppearance = user?.appearance || getAppearance();
  const [selectedTheme, setSelectedTheme] = useState<AppearanceTheme>(initialAppearance.theme);
  const [fontSize, setFontSize] = useState<AppearanceFontSize>(initialAppearance.fontSize);
  const [integrationLinks, setIntegrationLinks] = useState({ spotify: '', appleMusic: '', distributor: '', ...user?.integrationLinks });
  const [labelgrid, setLabelgrid] = useState<any>(null);
  const [labelgridBusy, setLabelgridBusy] = useState('');

  const loadLabelGrid = async () => {
    if (user?.role !== 'admin') return;
    try { setLabelgrid((await labelgridApi.getStatus()).data.data); }
    catch (e: any) { setLabelgrid({ status: 'connection_error', message: e.response?.data?.message || 'Unable to check LabelGrid' }); }
  };
  useEffect(() => { if (activeSection === 'integrations') loadLabelGrid(); }, [activeSection]);

  const runLabelGrid = async (action: 'test' | 'artists' | 'releases') => {
    setLabelgridBusy(action);
    try {
      if (action === 'artists') await labelgridApi.syncArtists();
      else if (action === 'releases') await labelgridApi.syncReleases();
      else await labelgridApi.testConnection();
      toast.success(action === 'test' ? 'LabelGrid connection checked' : `LabelGrid ${action} synchronized`);
      await loadLabelGrid();
    } catch (e: any) { toast.error(e.response?.data?.message || 'LabelGrid action failed'); }
    finally { setLabelgridBusy(''); }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error('Image must be under 3MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const maxDimension = 256;
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
        // A small profile thumbnail keeps login/session payloads fast even when
        // the original camera image was several megabytes.
        setAvatar(canvas.toDataURL('image/webp', 0.82));
      };
      image.onerror = () => toast.error('Could not process this image');
      image.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await settingsApi.updateProfile({ name: fullName, phone, department, avatar });
      updateUser(res.data.user);
      toast.success('Profile updated successfully');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update profile');
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error('Please fill in all password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setChangingPassword(true);
    try {
      await settingsApi.changePassword({ currentPassword, newPassword });
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to change password');
    }
    setChangingPassword(false);
  };

  const handleToggle2FA = async () => {
    if (twoFactorEnabled) return;
    setUpdatingTwoFactor(true);
    try {
      const res = await authApi.setupTwoFactor();
      setTwoFactorSetup(res.data.data);
      toast.success('Authenticator setup started');
    } catch (e: any) { toast.error(e.response?.data?.message || 'Could not start 2FA setup'); }
    finally { setUpdatingTwoFactor(false); }
  };

  const handleConfirm2FA = async () => {
    setUpdatingTwoFactor(true);
    try {
      await authApi.confirmTwoFactor(twoFactorCode);
      setTwoFactorEnabled(true); setTwoFactorSetup(null); setTwoFactorCode('');
      updateUser({ twoFactorEnabled: true });
      toast.success('Two-factor authentication enabled');
    } catch (e: any) { toast.error(e.response?.data?.message || 'Invalid authenticator code'); }
    finally { setUpdatingTwoFactor(false); }
  };

  const handleDisable2FA = async () => {
    if (!twoFactorPassword) return toast.error('Enter your current password to disable 2FA');
    setUpdatingTwoFactor(true);
    try {
      await authApi.disableTwoFactor(twoFactorPassword);
      setTwoFactorEnabled(false); setTwoFactorPassword(''); updateUser({ twoFactorEnabled: false });
      toast.success('Two-factor authentication disabled');
    } catch (e: any) { toast.error(e.response?.data?.message || 'Could not disable 2FA'); }
    finally { setUpdatingTwoFactor(false); }
  };

  const handleSaveAppearance = async () => {
    setSaving(true);
    try {
      const appearance = { theme: selectedTheme, fontSize };
      const res = await settingsApi.updateProfile({ appearance });
      applyAppearance(appearance); updateUser(res.data.user);
      toast.success('Appearance saved and applied');
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed to save appearance'); }
    finally { setSaving(false); }
  };

  const handleSaveIntegrations = async () => {
    setSaving(true);
    try {
      const res = await settingsApi.updateProfile({ integrationLinks });
      updateUser(res.data.user); toast.success('Platform links saved');
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed to save platform links'); }
    finally { setSaving(false); }
  };

  const handleSaveNotifications = async () => {
    setSavingNotifs(true);
    try {
      const res = await settingsApi.updateProfile({ notificationPreferences: notifPrefs.map(({ key, enabled }) => ({ key, enabled })) });
      updateUser(res.data.user);
      toast.success('Notification preferences saved');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save notification preferences');
    } finally { setSavingNotifs(false); }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 h-fit dark:bg-gray-800 dark:border-gray-700">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 dark:text-gray-400">Settings</h3>
          <nav className="space-y-0.5">
            {sections.filter(s => s.id !== 'permissions' || user?.role === 'admin').map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeSection === s.id ? 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-500/10 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700/50'
                }`}
              >
                <span style={{ color: activeSection === s.id ? '#4F46E5' : undefined }}>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="lg:col-span-3 bg-white border border-gray-200 rounded-2xl shadow-sm p-6 dark:bg-gray-800 dark:border-gray-700">
          {activeSection === 'profile' && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-5 dark:text-gray-100">Profile Settings</h2>
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
                <div className="relative">
                  {avatar ? (
                    <img src={avatar} alt="Profile" className="w-16 h-16 rounded-2xl object-cover shadow-lg shadow-indigo-500/20 border border-gray-200 dark:border-gray-600" />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white bg-gradient-to-br from-indigo-600 to-indigo-700 shadow-lg shadow-indigo-500/20">
                      {user?.name?.slice(0, 2).toUpperCase() || 'HB'}
                    </div>
                  )}
                  {avatar && (
                    <button
                      onClick={() => setAvatar('')}
                      title="Remove photo"
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-700 hover:bg-red-600 text-white flex items-center justify-center border border-white transition-colors"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
                <div>
                  <div className="text-base font-bold text-gray-900 dark:text-gray-100">{user?.name}</div>
                  <div className="text-sm text-gray-500 capitalize dark:text-gray-400">{user?.role}</div>
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 text-xs text-indigo-600 mt-1 hover:text-indigo-700 font-medium transition-colors dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    <Camera size={13} />
                    Change Photo
                  </button>
                  <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">Full Name</label>
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">Email Address</label>
                  <input type="email" value={user?.email || ''} disabled className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none opacity-60 cursor-not-allowed dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-300" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">Role</label>
                  <input type="text" value={user?.role || ''} disabled className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none opacity-60 cursor-not-allowed dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-300 capitalize" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">Phone Number</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">Department</label>
                  <input type="text" value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. A&R, Marketing" className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'security' && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-5 dark:text-gray-100">Security Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">Current Password</label>
                  <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Enter current password" className="w-full max-w-sm px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">New Password</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password" className="w-full max-w-sm px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">Confirm New Password</label>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className="w-full max-w-sm px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
                </div>
                <div className="pt-2">
                  <button onClick={handleChangePassword} disabled={changingPassword} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm transition-all disabled:opacity-50 flex items-center gap-2">
                    {changingPassword && <Loader2 size={14} className="animate-spin" />}
                    {changingPassword ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
                <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between py-3 rounded-lg px-3 bg-gray-50 border border-gray-200 dark:bg-gray-700/40 dark:border-gray-600">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Two-Factor Authentication</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Add an extra layer of security</div>
                    </div>
                    <button
                      onClick={handleToggle2FA}
                      disabled={updatingTwoFactor || twoFactorEnabled}
                      title={twoFactorEnabled ? 'Two-factor authentication is enabled' : 'Set up authenticator-based security'}
                      className={`w-10 h-6 rounded-full relative cursor-pointer transition-all ${twoFactorEnabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm ${twoFactorEnabled ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>
                  {twoFactorSetup && <div className="mt-3 p-4 rounded-xl border border-indigo-200 bg-indigo-50 dark:bg-indigo-500/10 dark:border-indigo-800 space-y-3"><p className="text-xs text-gray-700 dark:text-gray-200">Add an account in your authenticator app using this setup key, then enter its current code.</p><div className="flex items-center gap-2"><code className="text-xs font-bold tracking-wider break-all">{twoFactorSetup.secret}</code><button onClick={() => { navigator.clipboard.writeText(twoFactorSetup.secret); toast.success('Setup key copied'); }} title="Copy setup key"><Copy size={14} /></button></div><input value={twoFactorCode} onChange={e => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="6-digit code" className="w-44 px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600" /><div className="flex gap-2"><button onClick={handleConfirm2FA} disabled={updatingTwoFactor || twoFactorCode.length !== 6} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs disabled:opacity-50">Verify &amp; Enable</button><button onClick={() => { setTwoFactorSetup(null); setTwoFactorCode(''); }} className="px-3 py-2 border rounded-lg text-xs dark:border-gray-600">Cancel</button></div></div>}
                  {twoFactorEnabled && <div className="mt-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-800"><p className="text-xs text-emerald-700 dark:text-emerald-300 mb-3">Enabled. A current authenticator code is required after password sign-in.</p><div className="flex gap-2"><input type="password" value={twoFactorPassword} onChange={e => setTwoFactorPassword(e.target.value)} placeholder="Current password" className="px-3 py-2 border rounded-lg bg-white text-sm dark:bg-gray-800 dark:border-gray-600" /><button onClick={handleDisable2FA} disabled={updatingTwoFactor} className="px-3 py-2 bg-red-600 text-white rounded-lg text-xs disabled:opacity-50">Disable 2FA</button></div></div>}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-5 dark:text-gray-100">Notification Preferences</h2>
              <div className="space-y-3">
                {notifPrefs.map((pref, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200 dark:bg-gray-700/40 dark:border-gray-600">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{pref.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{pref.desc}</div>
                    </div>
                    <button
                      onClick={() => setNotifPrefs(prev => prev.map((p, j) => j === i ? { ...p, enabled: !p.enabled } : p))}
                      className={`w-10 h-6 rounded-full relative cursor-pointer transition-all ${pref.enabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm ${pref.enabled ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end dark:border-gray-700">
                <button onClick={handleSaveNotifications} disabled={savingNotifs} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm transition-all disabled:opacity-50 flex items-center gap-2">
                  {savingNotifs && <Loader2 size={14} className="animate-spin" />}
                  {savingNotifs ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </div>
          )}

          {activeSection === 'appearance' && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-5 dark:text-gray-100">Appearance</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-3">Theme</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { name: 'Light', value: 'light' as const, bg: '#FFFFFF', accent: '#4F46E5', border: '#E5E7EB' },
                      { name: 'Light Indigo', value: 'indigo' as const, bg: '#F5F3FF', accent: '#4F46E5', border: '#DDD6FE' },
                      { name: 'Light Warm', value: 'warm' as const, bg: '#FFFBEB', accent: '#D97706', border: '#FDE68A' },
                      { name: 'Dark', value: 'dark' as const, bg: '#111827', accent: '#8B5CF6', border: '#374151' },
                    ].map((theme) => (
                      <div
                        key={theme.name}
                        onClick={() => setSelectedTheme(theme.value)}
                        className={`p-3 rounded-xl cursor-pointer transition-all ${selectedTheme === theme.value ? 'ring-2 ring-indigo-500' : 'hover:ring-2 hover:ring-gray-200'}`}
                        style={{ background: theme.bg, border: `1px solid ${theme.border}` }}
                      >
                        <div className="w-full h-6 rounded-lg mb-2" style={{ background: theme.accent }} />
                        <div className={`text-xs text-center ${theme.value === 'dark' ? 'text-gray-200' : 'text-gray-500'}`}>{theme.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">Font Size</label>
                  <select value={fontSize} onChange={e => setFontSize(e.target.value as AppearanceFontSize)} className="w-48 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                    <option value="default">Default (14px)</option>
                    <option value="small">Small (12px)</option>
                    <option value="large">Large (16px)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'integrations' && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-5 dark:text-gray-100">Platform Integrations</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">Save the label’s platform and distributor dashboard links for one-click access. These links do not import private platform data.</p>
              <div className="space-y-4">{[
                { key: 'spotify' as const, label: 'Spotify for Artists / label profile' },
                { key: 'appleMusic' as const, label: 'Apple Music for Artists / label profile' },
                { key: 'distributor' as const, label: 'Distributor dashboard' },
              ].map(item => <div key={item.key}><label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">{item.label}</label><div className="flex gap-2"><input type="url" value={integrationLinks[item.key] || ''} onChange={e => setIntegrationLinks(prev => ({ ...prev, [item.key]: e.target.value }))} placeholder="https://..." className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />{/^https?:\/\//i.test(integrationLinks[item.key] || '') && <a href={integrationLinks[item.key]} target="_blank" rel="noreferrer" className="p-2 border rounded-lg text-indigo-600 dark:border-gray-600" title="Open link"><ExternalLink size={17} /></a>}</div></div>)}</div>
              {user?.role === 'admin' && <div className="mt-7 border-t border-gray-200 pt-6 dark:border-gray-700">
                <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold text-gray-900 dark:text-gray-100">LabelGrid</h3><p className="text-xs text-gray-500">Server-side distribution API connection</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${labelgrid?.status === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{String(labelgrid?.status || 'loading').replaceAll('_', ' ')}</span></div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4"><div><dt className="text-gray-500">API URL</dt><dd className="mt-1 break-all font-semibold dark:text-gray-200">{labelgrid?.baseUrl || '—'}</dd></div><div><dt className="text-gray-500">API token</dt><dd className="mt-1 font-semibold dark:text-gray-200">{labelgrid?.credentialHint || 'Not configured'}</dd></div><div><dt className="text-gray-500">Synced artists</dt><dd className="mt-1 font-semibold dark:text-gray-200">{labelgrid?.syncedArtists ?? '—'}</dd></div><div><dt className="text-gray-500">Synced releases / errors</dt><dd className="mt-1 font-semibold dark:text-gray-200">{labelgrid?.syncedReleases ?? '—'} / {labelgrid?.syncErrors ?? '—'}</dd></div><div><dt className="text-gray-500">Last successful sync</dt><dd className="mt-1 font-semibold dark:text-gray-200">{labelgrid?.lastSuccessfulSync ? new Date(labelgrid.lastSuccessfulSync).toLocaleString() : 'Never'}</dd></div><div><dt className="text-gray-500">Last failed sync</dt><dd className="mt-1 font-semibold dark:text-gray-200">{labelgrid?.lastFailedSync ? new Date(labelgrid.lastFailedSync).toLocaleString() : 'None'}</dd></div><div><dt className="text-gray-500">Webhook</dt><dd className="mt-1 font-semibold dark:text-gray-200">{labelgrid?.webhookStatus?.replaceAll('_', ' ') || '—'}</dd></div></dl>
                {labelgrid?.message && <p className="mt-3 text-xs text-gray-500">{labelgrid.message}</p>}
                <div className="mt-4 flex flex-wrap gap-2">{[['test','Test Connection'],['artists','Sync Artists'],['releases','Sync Releases']] .map(([key,label]) => <button key={key} type="button" disabled={Boolean(labelgridBusy)} onClick={() => runLabelGrid(key as 'test'|'artists'|'releases')} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold disabled:opacity-50 dark:border-gray-600 dark:text-gray-200">{labelgridBusy === key ? 'Working…' : label}</button>)}</div>
              </div>}
            </div>
          )}

          {activeSection === 'permissions' && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Role Permissions</h2>
                  <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">Overview of what each role can access across the platform</p>
                </div>
                <Link to="/team" className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm">
                  <Users size={14} />
                  Manage Team
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700">
                      <th className="text-left py-2 text-xs text-gray-500 font-semibold dark:text-gray-400">Permission</th>
                      {['Admin', 'Manager', 'Artist', 'Finance', 'Marketing'].map(r => (
                        <th key={r} className="text-center py-2 text-xs text-gray-500 font-semibold dark:text-gray-400">{r}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { perm: 'View Dashboard', roles: [true, true, true, true, true] },
                      { perm: 'Manage Artists', roles: [true, true, false, false, false] },
                      { perm: 'Manage Songs', roles: [true, true, false, false, false] },
                      { perm: 'Manage Releases', roles: [true, true, false, false, false] },
                      { perm: 'View Finances', roles: [true, false, false, true, false] },
                      { perm: 'Manage Contracts', roles: [true, false, false, true, false] },
                      { perm: 'Run Campaigns', roles: [true, false, false, false, true] },
                      { perm: 'Manage Tasks', roles: [true, true, false, false, false] },
                      { perm: 'System Settings', roles: [true, false, false, false, false] },
                      { perm: 'Manage Team', roles: [true, false, false, false, false] },
                      { perm: 'View Analytics', roles: [true, true, false, true, true] },
                      { perm: 'Manage Contacts', roles: [true, true, false, false, true] },
                    ].map((row, i) => (
                      <tr key={i} className="border-b border-gray-50 dark:border-gray-700/50">
                        <td className="py-2.5 text-gray-700 text-sm dark:text-gray-200">{row.perm}</td>
                        {row.roles.map((allowed, j) => (
                          <td key={j} className="text-center py-2.5">
                            <span className={`text-xs ${allowed ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>{allowed ? '\u2713' : '\u2717'}</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {['profile', 'appearance', 'integrations'].includes(activeSection) && <div className="mt-6 pt-5 flex justify-end border-t border-gray-100 dark:border-gray-700">
            <button onClick={activeSection === 'appearance' ? handleSaveAppearance : activeSection === 'integrations' ? handleSaveIntegrations : handleSaveProfile} disabled={saving} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>}
        </div>
      </div>
    </div>
  );
};

export default Settings;
