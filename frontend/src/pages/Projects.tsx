import React, { useEffect, useState, useCallback } from 'react';
import { Layers, Plus, Search, TrendingUp, Clock, CheckCircle, Edit2, Trash2, X, Loader2, Music, Calendar, User, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { projectsApi, artistsApi } from '../services/api';
import type { Project, Artist } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatCurrency, formatDate, daysUntil, getInitials } from '../utils/helpers';

const emptyForm = {
  name: '',
  type: 'single' as Project['type'],
  artist: '',
  status: 'not_started' as Project['status'],
  priority: 'medium' as Project['priority'],
  releaseDate: '',
  startDate: '',
  budget: '',
  description: '',
  completionPercentage: 0,
};

const Projects: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [artists, setArtists] = useState<Artist[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      const res = await projectsApi.getAll(params);
      setProjects(res.data.data);
    } catch (e) { console.error(e); toast.error('Failed to load projects'); }
    setLoading(false);
  }, [statusFilter]);

  const loadArtists = async () => {
    try {
      const res = await artistsApi.getAll({ limit: 500 });
      setArtists(res.data.data || []);
    } catch { /* dropdown stays empty */ }
  };

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => { loadArtists(); }, []);

  const filtered = projects.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  const typeColors: Record<string, string> = {
    album: '#8B5CF6', ep: '#06B6D4', single: '#F5A623', mixtape: '#EC4899', compilation: '#10B981'
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (project: Project) => {
    setEditingId(project._id);
    setForm({
      name: project.name,
      type: project.type,
      artist: (project.artist as any)?._id || '',
      status: project.status,
      priority: project.priority,
      releaseDate: project.releaseDate ? project.releaseDate.split('T')[0] : '',
      startDate: (project as any).startDate ? (project as any).startDate.split('T')[0] : '',
      budget: project.budget ? String(project.budget) : '',
      description: (project as any).description || '',
      completionPercentage: project.completionPercentage || 0,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Project name is required'); return; }
    if (!form.artist) { toast.error('Please select an artist'); return; }
    setSaving(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        type: form.type,
        artist: form.artist,
        status: form.status,
        priority: form.priority,
        completionPercentage: form.completionPercentage,
        description: form.description.trim(),
      };
      if (form.releaseDate) payload.releaseDate = form.releaseDate;
      if (form.startDate) payload.startDate = form.startDate;
      if (form.budget) payload.budget = parseFloat(form.budget);

      if (editingId) {
        await projectsApi.update(editingId, payload);
        toast.success('Project updated');
      } else {
        await projectsApi.create(payload);
        toast.success('Project created');
      }
      setShowModal(false);
      loadProjects();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save project');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await projectsApi.delete(deleteId);
      toast.success('Project deleted');
      setDeleteId(null);
      loadProjects();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to delete project');
    }
    setDeleting(false);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Projects', value: projects.length, color: '#8B5CF6', icon: <Layers size={16} /> },
          { label: 'In Progress', value: projects.filter(p => p.status === 'in_progress').length, color: '#06B6D4', icon: <TrendingUp size={16} /> },
          { label: 'Pending Approval', value: projects.filter(p => p.status === 'waiting_approval').length, color: '#F5A623', icon: <Clock size={16} /> },
          { label: 'Completed', value: projects.filter(p => p.status === 'completed').length, color: '#10B981', icon: <CheckCircle size={16} /> },
        ].map((s) => (
          <div key={s.label} className="metric-card hbe-card hbe-card-hover p-4 flex items-center gap-3 overflow-hidden relative group">
            <div
              className="absolute -top-10 -right-10 h-24 w-24 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
              style={{ background: `${s.color}1f` }}
            />
            <div className="hbe-icon-tile h-11 w-11 relative" style={{ background: `${s.color}14`, color: s.color, border: `1px solid ${s.color}22` }}>
              {s.icon}
            </div>
            <div className="relative">
              <div className="text-2xl font-extrabold tracking-tight text-[var(--hbe-text)] leading-none">{s.value}</div>
              <div className="text-xs font-medium text-[var(--hbe-muted)] mt-1.5">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-48 bg-white border border-gray-200">
          <Search size={14} className="text-gray-400" />
          <input type="text" placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none flex-1" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 sm:w-auto">
          <option value="">All Statuses</option>
          <option value="not_started">Not Started</option>
          <option value="in_progress">In Progress</option>
          <option value="waiting_approval">Waiting Approval</option>
          <option value="completed">Completed</option>
          <option value="delayed">Delayed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button onClick={openCreate} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2"><Plus size={14} />New Project</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size={28} /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filtered.map((project, idx) => {
            const days = project.releaseDate ? daysUntil(project.releaseDate) : null;
            const typeColor = typeColors[project.type] || '#6B7280';
            const budgetPct = project.budget ? Math.min(((project.spent || 0) / project.budget) * 100, 100) : 0;
            const projectName = project.artist?.stageName || project.artist?.name || 'Artist';
            const statusDot = ({ not_started: '#6B7280', in_progress: '#0EA5E9', waiting_approval: '#F59E0B', completed: '#10B981', delayed: '#EF4444', cancelled: '#EF4444' } as Record<string, string>)[project.status] || '#8B5CF6';
            const daysClass = days === null || days <= 0
              ? 'bg-gray-500/10 text-[var(--hbe-muted)]'
              : days <= 7
                ? 'bg-red-500/10 text-red-500'
                : days <= 30
                  ? 'bg-amber-500/10 text-amber-500'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';

            return (
              <div
                key={project._id}
                className="hbe-card group relative overflow-hidden rounded-2xl hover:-translate-y-1 transition-all duration-300 animate-step-enter"
                style={{ animationDelay: `${Math.min(idx * 40, 200)}ms` }}
              >
                {/* Type accent banner */}
                <div
                  className="relative h-14 flex items-start justify-between p-2.5"
                  style={{ background: `linear-gradient(135deg, ${typeColor} 0%, ${typeColor}88 55%, ${typeColor}33 100%)` }}
                >
                  <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-[var(--hbe-panel)] via-[var(--hbe-panel)]/8 to-transparent dark:via-black/20 dark:to-black/15" />
                  <div className="absolute right-10 -top-6 h-16 w-16 rounded-full bg-white/10" />
                  <div className="absolute right-24 top-1 h-5 w-5 rounded-full bg-white/10" />
                  <div className="absolute left-1/3 top-2 h-2 w-2 rounded-full bg-white/15" />
                  <span className="relative z-10 inline-flex items-center gap-1 rounded-md bg-black/30 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm ring-1 ring-white/25 dark:bg-black/45 dark:ring-white/20">
                    <Music size={10} />{project.type}
                  </span>
                  <div className="relative z-10 flex items-center gap-1.5">
                    <button onClick={() => openEdit(project)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-gray-700 shadow-sm ring-1 ring-white/40 transition-all hover:bg-white hover:text-[var(--hbe-accent)] hover:shadow-md hover:scale-105 dark:bg-slate-900/85 dark:text-slate-200 dark:ring-white/15 dark:hover:bg-slate-800 dark:hover:text-[#A78BFA]" title="Edit">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => setDeleteId(project._id)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-gray-700 shadow-sm ring-1 ring-white/40 transition-all hover:bg-red-500 hover:text-white hover:shadow-md hover:scale-105 dark:bg-slate-900/85 dark:text-slate-200 dark:ring-white/15 dark:hover:bg-red-500/90 dark:hover:text-white" title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div className="relative px-5 pb-5">
                  {/* Header */}
                  <div className="-mt-7 mb-3 flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-2xl text-sm font-bold text-white ring-4 ring-[var(--hbe-panel)] transition-transform duration-300 group-hover:scale-105"
                        style={{ background: `linear-gradient(135deg, ${typeColor}, ${typeColor}aa)`, boxShadow: `0 8px 20px ${typeColor}40` }}
                      >
                        {getInitials(projectName)}
                      </div>
                      <span
                        className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-[var(--hbe-panel)]"
                        style={{ background: statusDot }}
                        title={project.status.replace(/_/g, ' ')}
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-bold text-[var(--hbe-text)] leading-tight transition-colors group-hover:text-[var(--hbe-accent)]">
                        {project.name}
                      </h3>
                      <p className="mt-1 flex items-center gap-1 truncate text-xs text-[var(--hbe-muted)]">
                        <User size={11} className="flex-shrink-0" />{projectName}
                      </p>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="mb-4 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={project.status} />
                    <StatusBadge status={project.priority} type="priority" />
                  </div>

                  {/* Completion */}
                  <div className="mb-4">
                    <div className="mb-1.5 flex items-center justify-between text-[11px]">
                      <span className="font-medium text-[var(--hbe-muted)]">Completion</span>
                      <span className="font-bold text-[var(--hbe-text)]">{project.completionPercentage}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--hbe-fill)]">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${project.completionPercentage}%`,
                          background: project.completionPercentage >= 100
                            ? 'linear-gradient(90deg,#10B981,#34D399)'
                            : project.completionPercentage >= 60
                              ? 'linear-gradient(90deg,#8B5CF6,#A78BFA)'
                              : 'linear-gradient(90deg,#F59E0B,#FBBF24)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Budget */}
                  {project.budget ? (
                    <div className="mb-4">
                      <div className="mb-1.5 flex items-center justify-between text-[11px]">
                        <span className="font-medium text-[var(--hbe-muted)] flex items-center gap-1"><Wallet size={11} />Budget</span>
                        <span className="font-bold text-[var(--hbe-text)]">
                          {formatCurrency(project.spent || 0)}
                          <span className="font-medium text-[var(--hbe-muted)]"> / {formatCurrency(project.budget)}</span>
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--hbe-fill)]">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${budgetPct}%`,
                            background: budgetPct > 90 ? 'linear-gradient(90deg,#EF4444,#F87171)' : 'linear-gradient(90deg,#10B981,#34D399)',
                          }}
                        />
                      </div>
                      {budgetPct > 90 && <div className="mt-1 text-[10px] font-semibold text-red-500">Over 90% of budget used</div>}
                    </div>
                  ) : (
                    <div className="mb-4 flex items-center gap-1.5 text-[11px] text-[var(--hbe-muted)]"><Wallet size={11} />No budget set</div>
                  )}

                  {/* Footer */}
                  <div className="grid grid-cols-2 gap-3 border-t border-[var(--hbe-line-soft)] pt-3.5">
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--hbe-muted)]">
                        <Calendar size={11} />Release
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-semibold text-[var(--hbe-text)]">{project.releaseDate ? formatDate(project.releaseDate) : 'TBD'}</span>
                        {days !== null && days > 0 && (
                          <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold ${daysClass}`}>{days}d left</span>
                        )}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--hbe-muted)]">
                        <User size={11} />Assigned
                      </div>
                      <div className="truncate text-xs font-semibold text-[var(--hbe-text)]">{(project.assignedTo as any)?.name || 'Unassigned'}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="hbe-card col-span-2 text-center py-16">
              <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--hbe-fill)] text-[var(--hbe-muted)]">
                <Layers size={40} />
              </div>
              <p className="mb-1 text-sm font-semibold text-[var(--hbe-text)]">{search ? 'No projects match your search' : 'No projects yet'}</p>
              <p className="text-xs text-[var(--hbe-muted)]">{search ? 'Try adjusting your search terms' : 'Create a project to start tracking production workflows'}</p>
              <button onClick={openCreate} className="mx-auto mt-4 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg px-5 py-2 text-sm transition-all duration-200 shadow-sm hover:shadow-md">
                <Plus size={14} />Create Project
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto dark:bg-gray-900 dark:border dark:border-gray-700">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10 dark:bg-gray-900 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{editingId ? 'Edit Project' : 'New Project'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition dark:text-gray-500 dark:hover:bg-gray-800"><X size={20} /></button>
            </div>
            <div className="px-6 py-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">Project Name *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Summer EP 2026" className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">Artist *</label>
                  <select value={form.artist} onChange={e => setForm(f => ({ ...f, artist: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10">
                    <option value="">Select artist</option>
                    {artists.map(a => (
                      <option key={a._id} value={a._id}>{a.stageName || a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as Project['type'] }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10">
                    <option value="single">Single</option>
                    <option value="ep">EP</option>
                    <option value="album">Album</option>
                    <option value="mixtape">Mixtape</option>
                    <option value="compilation">Compilation</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Project['status'] }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10">
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="waiting_approval">Waiting Approval</option>
                    <option value="completed">Completed</option>
                    <option value="delayed">Delayed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Project['priority'] }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">Start Date</label>
                  <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">Release Date</label>
                  <input type="date" value={form.releaseDate} onChange={e => setForm(f => ({ ...f, releaseDate: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">Budget ($)</label>
                  <input type="number" min="0" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} placeholder="0.00" className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">Completion (%)</label>
                  <input type="number" min="0" max="100" value={form.completionPercentage} onChange={e => setForm(f => ({ ...f, completionPercentage: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Project notes..." className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 resize-none" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 sticky bottom-0 bg-white dark:bg-gray-900 dark:border-gray-700">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition dark:text-gray-300 dark:hover:text-gray-100">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Saving...' : editingId ? 'Update Project' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 dark:bg-gray-900 dark:border dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Delete Project</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Are you sure you want to delete this project? This action cannot be undone.</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition dark:text-gray-300 dark:hover:text-gray-100">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="inline-flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition">
                {deleting && <Loader2 size={14} className="animate-spin" />}
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
