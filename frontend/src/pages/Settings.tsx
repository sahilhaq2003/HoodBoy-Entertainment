import React, { useState, useRef } from 'react';
import { Settings as SettingsIcon, User, Lock, Bell, Palette, Database, Shield, Save, Loader2, Camera, X, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { settingsApi } from '../services/api';

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
  const [twoFactorEnabled] = useState(false);

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

  const [selectedTheme, setSelectedTheme] = useState('Light');
  const [fontSize, setFontSize] = useState('Default (14px)');

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
    reader.onload = () => setAvatar(reader.result as string);
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

  const handleToggle2FA = () => toast.error('Two-factor authentication requires an authenticator-provider setup and is not enabled in this deployment.');

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
            {sections.map(s => (
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
                      title="Authenticator-based two-factor authentication is not configured"
                      className={`w-10 h-6 rounded-full relative cursor-pointer transition-all ${twoFactorEnabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm ${twoFactorEnabled ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>
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
                      { name: 'Light', bg: '#FFFFFF', accent: '#4F46E5', border: '#E5E7EB' },
                      { name: 'Light Indigo', bg: '#F9FAFB', accent: '#4F46E5', border: '#E5E7EB' },
                      { name: 'Light Warm', bg: '#FFFBEB', accent: '#D97706', border: '#FDE68A' },
                    ].map((theme) => (
                      <div
                        key={theme.name}
                        onClick={() => setSelectedTheme(theme.name)}
                        className={`p-3 rounded-xl cursor-pointer transition-all ${selectedTheme === theme.name ? 'ring-2 ring-indigo-500' : 'hover:ring-2 hover:ring-gray-200'}`}
                        style={{ background: theme.bg, border: `1px solid ${theme.border}` }}
                      >
                        <div className="w-full h-6 rounded-lg mb-2" style={{ background: theme.accent }} />
                        <div className="text-xs text-gray-500 text-center">{theme.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">Font Size</label>
                  <select value={fontSize} onChange={e => setFontSize(e.target.value)} className="w-48 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                    <option>Default (14px)</option>
                    <option>Small (12px)</option>
                    <option>Large (16px)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'integrations' && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-5 dark:text-gray-100">Platform Integrations</h2>
              <div className="text-center py-12">
                <Database size={40} className="mx-auto text-gray-300 mb-3 dark:text-gray-600" />
                <p className="text-sm font-medium text-gray-900 mb-1 dark:text-gray-100">No integrations configured</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Connect your streaming platforms and distribution services here.</p>
              </div>
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

          <div className="mt-6 pt-5 flex justify-end border-t border-gray-100 dark:border-gray-700">
            <button onClick={handleSaveProfile} disabled={saving} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
