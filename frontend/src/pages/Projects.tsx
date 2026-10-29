import React, { useEffect, useState, useCallback } from 'react';
import { Layers, Plus, Search, TrendingUp, Clock, CheckCircle, Edit2, Trash2, X, Loader2, Music, Calendar, User, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { projectsApi, artistsApi } from '../services/api';
import type { Project, Artist } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatCurrency, formatDate, daysUntil } from '../utils/helpers';

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
              <article
                key={project._id}
                className="hbe-card group relative overflow-hidden rounded-2xl border border-[var(--hbe-line-soft)] bg-[var(--hbe-panel)] shadow-[0_4px_18px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--hbe-accent)_25%,var(--hbe-line-soft))] hover:shadow-[0_16px_38px_rgba(15,23,42,0.10)] animate-step-enter"
                style={{ animationDelay: `${Math.min(idx * 40, 200)}ms` }}
              >
                <div
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ background: `linear-gradient(90deg, ${typeColor}, ${typeColor}66 70%, transparent)` }}
                />

                <div className="relative p-5 pt-6">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3.5">
                      <div
                        className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-[1.04]"
                        style={{ background: `${typeColor}12`, color: typeColor, borderColor: `${typeColor}24` }}
                      >
                        <Music size={20} strokeWidth={1.8} />
                        <span
                          className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-[var(--hbe-panel)]"
                          style={{ background: statusDot }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: typeColor }}>{project.type}</span>
                          <span className="h-1 w-1 rounded-full bg-[var(--hbe-line)]" />
                          <span className="truncate text-[11px] font-medium text-[var(--hbe-muted)]">{projectName}</span>
                        </div>
                        <h3 className="truncate text-base font-bold leading-tight text-[var(--hbe-text)] transition-colors group-hover:text-[var(--hbe-accent)]">
                          {project.name}
                        </h3>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button onClick={() => openEdit(project)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-[var(--hbe-muted)] transition hover:border-[var(--hbe-line-soft)] hover:bg-[var(--hbe-fill)] hover:text-[var(--hbe-accent)]" title="Edit project" aria-label={`Edit ${project.name}`}>
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => setDeleteId(project._id)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-[var(--hbe-muted)] transition hover:border-red-500/15 hover:bg-red-500/8 hover:text-red-500" title="Delete project" aria-label={`Delete ${project.name}`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <StatusBadge status={project.status} />
                    <StatusBadge status={project.priority} type="priority" />
                  </div>

                  <div className="mb-4 rounded-xl border border-[var(--hbe-line-soft)] bg-[var(--hbe-fill)]/55 p-3.5">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[var(--hbe-muted)]">Project completion</span>
                      <span className="text-xs font-bold tabular-nums text-[var(--hbe-text)]">{project.completionPercentage}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--hbe-line-soft)]">
                      <div
                        className="h-full rounded-full shadow-sm transition-all duration-700"
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

                  {project.budget ? (
                    <div className="mb-4">
                      <div className="mb-2 flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1.5 font-semibold text-[var(--hbe-muted)]"><Wallet size={12} />Budget usage</span>
                        <span className="font-bold tabular-nums text-[var(--hbe-text)]">
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
                    <div className="mb-4 flex items-center gap-1.5 text-[11px] font-medium text-[var(--hbe-muted)]"><Wallet size={12} />No budget set</div>
                  )}

                  <div className="grid grid-cols-2 divide-x divide-[var(--hbe-line-soft)] border-t border-[var(--hbe-line-soft)] pt-4">
                    <div className="min-w-0 pr-4">
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
                    <div className="min-w-0 pl-4">
                      <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--hbe-muted)]">
                        <User size={11} />Assigned
                      </div>
                      <div className="truncate text-xs font-semibold text-[var(--hbe-text)]">{(project.assignedTo as any)?.name || 'Unassigned'}</div>
                    </div>
                  </div>
                </div>
              </article>
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
