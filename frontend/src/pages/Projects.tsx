import React, { useEffect, useState, useCallback } from 'react';
import { Layers, Plus, Search, TrendingUp, Clock, CheckCircle, Edit2, Trash2, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { projectsApi, artistsApi } from '../services/api';
import type { Project, Artist } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatCurrency, formatDate, daysUntil, getInitials, getAvatarColor } from '../utils/helpers';

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
        ].map((s, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15` }}>
              <span style={{ color: s.color }}>{s.icon}</span>
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(project => {
            const days = project.releaseDate ? daysUntil(project.releaseDate) : null;
            const typeColor = typeColors[project.type] || '#6B7280';
            const budgetPct = project.budget ? Math.min(((project.spent || 0) / project.budget) * 100, 100) : 0;

            return (
              <div key={project._id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-start gap-4 mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm"
                    style={{ background: getAvatarColor(project.artist?.name || 'P') }}
                  >
                    {getInitials(project.artist?.stageName || project.artist?.name || 'P')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-base font-bold text-gray-900 truncate">{project.name}</h3>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <StatusBadge status={project.status} />
                        <button onClick={() => openEdit(project)} className="p-1 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all" title="Edit">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => setDeleteId(project._id)} className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md capitalize" style={{ background: `${typeColor}15`, color: typeColor, border: `1px solid ${typeColor}30` }}>
                        {project.type}
                      </span>
                      <StatusBadge status={project.priority} type="priority" />
                    </div>
                    <p className="text-xs text-gray-500">{project.artist?.stageName || project.artist?.name}</p>
                  </div>
                </div>

                {/* Completion Progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-gray-500">Completion</span>
                    <span className="text-gray-900 font-semibold">{project.completionPercentage}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${project.completionPercentage}%`,
                        background: project.completionPercentage === 100 ? '#10B981'
                          : project.completionPercentage > 60 ? '#F5A623'
                          : '#8B5CF6'
                      }}
                    />
                  </div>
                </div>

                {/* Budget */}
                {project.budget ? (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-gray-500">Budget Used</span>
                      <span className="text-gray-900 font-semibold">{formatCurrency(project.spent || 0)} / {formatCurrency(project.budget)}</span>
                    </div>
                    <div className="h-1 rounded-full bg-gray-200 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${budgetPct}%`, background: budgetPct > 90 ? '#EF4444' : '#10B981' }} />
                    </div>
                  </div>
                ) : null}

                {/* Footer info */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                  <div>
                    <div className="text-xs text-gray-500 mb-0.5">Release Date</div>
                    <div className="text-sm text-gray-700">{project.releaseDate ? formatDate(project.releaseDate) : 'TBD'}</div>
                    {days !== null && days > 0 && (
                      <div className={`text-xs mt-0.5 font-medium ${days <= 30 ? 'text-amber-600' : 'text-gray-500'}`}>{days}d away</div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-0.5">Assigned To</div>
                    <div className="text-sm text-gray-700">{(project.assignedTo as any)?.name || 'Unassigned'}</div>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-2 text-center py-16">
              <Layers size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-900 mb-1">{search ? 'No projects match your search' : 'No projects yet'}</p>
              <p className="text-xs text-gray-500">{search ? 'Try adjusting your search terms' : 'Create a project to start tracking production workflows'}</p>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-gray-900">{editingId ? 'Edit Project' : 'New Project'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition"><X size={20} /></button>
            </div>
            <div className="px-6 py-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Project Name *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Summer EP 2026" className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Artist *</label>
                  <select value={form.artist} onChange={e => setForm(f => ({ ...f, artist: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10">
                    <option value="">Select artist</option>
                    {artists.map(a => (
                      <option key={a._id} value={a._id}>{a.stageName || a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Type</label>
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
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Status</label>
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
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Priority</label>
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
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Start Date</label>
                  <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Release Date</label>
                  <input type="date" value={form.releaseDate} onChange={e => setForm(f => ({ ...f, releaseDate: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Budget ($)</label>
                  <input type="number" min="0" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} placeholder="0.00" className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Completion (%)</label>
                  <input type="number" min="0" max="100" value={form.completionPercentage} onChange={e => setForm(f => ({ ...f, completionPercentage: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Project notes..." className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 resize-none" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 sticky bottom-0 bg-white">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition">Cancel</button>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Delete Project</h2>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to delete this project? This action cannot be undone.</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition">Cancel</button>
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
