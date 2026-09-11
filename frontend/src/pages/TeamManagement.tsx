import React, { useEffect, useState, useCallback } from 'react';
import { Users, UserPlus, Search, Shield, Mail, Phone, Building2, Loader2, X, Check, Trash2, Key, AlertTriangle, Power, PowerOff, Edit2, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { usersApi } from '../services/api';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import LoadingSpinner from '../components/ui/LoadingSpinner';

interface TeamUser {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'artist' | 'finance' | 'marketing';
  department: string;
  phone: string;
  avatar: string;
  isActive: boolean;
  createdAt: string;
}

interface TeamStats {
  total: number;
  active: number;
  inactive: number;
  byRole: Record<string, number>;
  byDepartment: Array<{ _id: string; count: number }>;
}

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  admin: { label: 'Administrator', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  manager: { label: 'Manager', color: '#16A34A', bg: 'rgba(22,163,74,0.12)' },
  artist: { label: 'Artist', color: '#7C3AED', bg: 'rgba(124,58,237,0.12)' },
  finance: { label: 'Finance', color: '#D97706', bg: 'rgba(245,158,11,0.12)' },
  marketing: { label: 'Marketing', color: '#DB2777', bg: 'rgba(236,72,153,0.12)' },
};

const TeamManagement: React.FC = () => {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<TeamUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordUserId, setPasswordUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<TeamUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<string>('manager');
  const [formDepartment, setFormDepartment] = useState('');
  const [formPhone, setFormPhone] = useState('');

  const loadUsers = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (filterRole) params.role = filterRole;
      if (filterStatus) params.isActive = filterStatus;
      const res = await usersApi.getAll(params);
      setUsers(res.data.data);
    } catch {
      toast.error('Failed to load team members');
    }
  }, [search, filterRole, filterStatus]);

  const loadStats = useCallback(async () => {
    try {
      const res = await usersApi.getStats();
      setStats(res.data.data);
    } catch { /* stats load failed */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadUsers(), loadStats()]).finally(() => setLoading(false));
  }, [loadUsers, loadStats]);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('manager');
    setFormDepartment('');
    setFormPhone('');
    setShowModal(true);
  };

  const openEditModal = (user: TeamUser) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormPassword('');
    setFormRole(user.role);
    setFormDepartment(user.department || '');
    setFormPhone(user.phone || '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formEmail.trim()) {
      toast.error('Name and email are required');
      return;
    }
    if (!editingUser && !formPassword) {
      toast.error('Password is required for new accounts');
      return;
    }
    if (!editingUser && formPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    try {
      if (editingUser) {
        await usersApi.update(editingUser._id, { name: formName, email: formEmail, role: formRole, department: formDepartment, phone: formPhone });
        toast.success('Team member updated');
      } else {
        await usersApi.create({ name: formName, email: formEmail, password: formPassword, role: formRole, department: formDepartment, phone: formPhone });
        toast.success('Team member created');
      }
      setShowModal(false);
      loadUsers();
      loadStats();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save');
    }
    setSaving(false);
  };

  const handleToggleActive = async (user: TeamUser) => {
    try {
      const res = await usersApi.toggleActive(user._id);
      toast.success(res.data.message);
      loadUsers();
      loadStats();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await usersApi.delete(deleteTarget._id);
      toast.success('Team member deleted');
      setDeleteTarget(null);
      loadUsers();
      loadStats();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to delete');
    }
    setDeleting(false);
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      await usersApi.resetPassword(passwordUserId, { newPassword });
      toast.success('Password reset successfully');
      setShowPasswordModal(false);
      setNewPassword('');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to reset password');
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Team', value: stats.total, icon: <Users size={18} />, color: '#6366F1', bg: 'rgba(99,102,241,0.08)' },
            { label: 'Active', value: stats.active, icon: <Check size={18} />, color: '#16A34A', bg: 'rgba(22,163,74,0.08)' },
            { label: 'Inactive', value: stats.inactive, icon: <X size={18} />, color: '#DC2626', bg: 'rgba(220,38,38,0.08)' },
            { label: 'Departments', value: stats.byDepartment.length, icon: <Building2 size={18} />, color: '#D97706', bg: 'rgba(217,119,6,0.08)' },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Header + Filters */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 border-b border-gray-100">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Team Management</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage team members, roles, and permissions</p>
          </div>
          <button onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm">
            <UserPlus size={15} />
            Add Member
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-gray-100">
          <div className="flex-1 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search by name, email, or department..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10" />
          </div>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-500">
            <option value="">All Roles</option>
            {Object.entries(ROLE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-500">
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        {/* User List */}
        {loading ? (
          <div className="p-12"><LoadingSpinner /></div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-900">No team members found</p>
            <p className="text-xs text-gray-500 mt-1">Add your first team member to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-700">
            {users.map(u => {
              const rc = ROLE_CONFIG[u.role] || ROLE_CONFIG.manager;
              return (
                <div key={u._id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/60 transition-colors">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${rc.color}, ${rc.color}99)` }}>
                    {u.avatar ? <img src={u.avatar} alt={u.name} className="w-full h-full object-cover rounded-xl" /> : u.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 truncate">{u.name}</span>
                      {!u.isActive && <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-50 text-red-600 rounded-full">INACTIVE</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-xs text-gray-500"><Mail size={11} />{u.email}</span>
                      {u.department && <span className="flex items-center gap-1 text-xs text-gray-500"><Building2 size={11} />{u.department}</span>}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold flex-shrink-0" style={{ background: rc.bg, color: rc.color }}>
                    {rc.label}
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0 hidden md:block">Joined {formatDate(u.createdAt)}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openEditModal(u)} title="Edit" className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => { setPasswordUserId(u._id); setShowPasswordModal(true); setNewPassword(''); }} title="Reset Password" className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors">
                      <Key size={14} />
                    </button>
                    <button onClick={() => handleToggleActive(u)} title={u.isActive ? 'Deactivate' : 'Activate'} className={`p-1.5 rounded-lg transition-colors ${u.isActive ? 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10' : 'text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10'}`}>
                      {u.isActive ? <PowerOff size={14} /> : <Power size={14} />}
                    </button>
                    <button onClick={() => setDeleteTarget(u)} title="Delete" className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto dark:bg-gray-900 dark:border dark:border-gray-700">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{editingUser ? 'Edit Team Member' : 'Add Team Member'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-800"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">Full Name *</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="John Doe"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">Email Address *</label>
                <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="john@example.com"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">Password *</label>
                  <input type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="Min 6 characters"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">Role *</label>
                  <select value={formRole} onChange={e => setFormRole(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm outline-none focus:border-indigo-500">
                    {Object.entries(ROLE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">Department</label>
                  <input type="text" value={formDepartment} onChange={e => setFormDepartment(e.target.value)} placeholder="e.g. A&R"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">Phone</label>
                <input type="tel" value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="+1 (555) 000-0000"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors dark:text-gray-200 dark:hover:bg-gray-800">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Saving...' : editingUser ? 'Update Member' : 'Create Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowPasswordModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md dark:bg-gray-900 dark:border dark:border-gray-700">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Reset Password</h2>
              <button onClick={() => setShowPasswordModal(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-800"><X size={16} /></button>
            </div>
            <div className="p-5">
              <label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 characters" autoFocus
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setShowPasswordModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors dark:text-gray-200 dark:hover:bg-gray-800">Cancel</button>
              <button onClick={handleResetPassword} className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-all flex items-center gap-2">
                <Key size={14} />
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Team Member"
        message={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        variant="danger"
      />
    </div>
  );
};

export default TeamManagement;
