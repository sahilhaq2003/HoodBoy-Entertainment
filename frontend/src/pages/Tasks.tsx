import React, { useEffect, useState, useCallback } from 'react';
import {
  CheckSquare, Plus, Search, Clock, AlertTriangle, Users, Calendar,
  ChevronRight, X, RefreshCw, ArrowRight, Target, Shield,
} from 'lucide-react';
import { tasksApi } from '../services/api';
import type { Task, KanbanColumns, TeamMemberPerformance, TaskStats } from '../types';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const COLUMNS: { key: keyof KanbanColumns; label: string; color: string }[] = [
  { key: 'not_started', label: 'Not Started', color: '#6B7280' },
  { key: 'in_progress', label: 'In Progress', color: '#06B6D4' },
  { key: 'waiting_approval', label: 'Waiting Approval', color: '#F59E0B' },
  { key: 'blocked', label: 'Blocked', color: '#EF4444' },
  { key: 'delayed', label: 'Delayed', color: '#F59E0B' },
  { key: 'completed', label: 'Completed', color: '#10B981' },
];

const PRIORITY_COLORS: Record<string, string> = { low: '#6B7280', medium: '#06B6D4', high: '#F59E0B', critical: '#EF4444' };

const Tasks: React.FC = () => {
  const [kanban, setKanban] = useState<KanbanColumns | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [team, setTeam] = useState<TeamMemberPerformance[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'board' | 'list' | 'team'>('board');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [viewTask, setViewTask] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '', description: '', assignedTo: '', deadline: '', priority: 'medium',
    category: 'general', deliverable: '', notes: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [kanbanRes, tasksRes, teamRes, statsRes] = await Promise.all([
        tasksApi.getKanban(), tasksApi.getAll({ limit: 100 }),
        tasksApi.getTeam(), tasksApi.getStats(),
      ]);
      setKanban(kanbanRes.data.data);
      setTasks(tasksRes.data.data);
      setTeam(teamRes.data.data);
      setStats(statsRes.data.data);
    } catch { toast.error('Failed to load tasks'); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async () => {
    if (!form.title || !form.deadline) return toast.error('Title and deadline required');
    if (!form.deliverable) return toast.error('Deliverable is required');
    try {
      await tasksApi.create(form);
      toast.success('Task created');
      setShowCreate(false);
      setForm({ title: '', description: '', assignedTo: '', deadline: '', priority: 'medium', category: 'general', deliverable: '', notes: '' });
      loadData();
    } catch { toast.error('Failed to create task'); }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await tasksApi.update(taskId, { status: newStatus });
      toast.success('Task updated');
      loadData();
    } catch { toast.error('Failed to update'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await tasksApi.delete(id);
      toast.success('Task deleted');
      setViewTask(null);
      loadData();
    } catch { toast.error('Failed to delete'); }
  };

  const daysUntil = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  const filteredTasks = tasks.filter(t => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
    const matchPriority = !priorityFilter || t.priority === priorityFilter;
    return matchSearch && matchPriority;
  });

  const getInitials = (name: string) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  const getAvatarColor = (name: string) => {
    const colors = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1', '#14B8A6'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  if (loading) return <div className="flex justify-center py-20"><RefreshCw size={24} className="text-indigo-500 animate-spin" /></div>;

  return (
    <div className="space-y-5">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: 'Total', value: stats.total, color: '#8B5CF6', icon: <CheckSquare size={16} /> },
            { label: 'Overdue', value: stats.overdue, color: '#EF4444', icon: <Clock size={16} /> },
            { label: 'Due This Week', value: stats.dueThisWeek, color: '#F59E0B', icon: <Calendar size={16} /> },
            { label: 'Blocked', value: stats.byStatus['blocked'] || 0, color: '#F59E0B', icon: <Shield size={16} /> },
            { label: 'Completed', value: stats.byStatus['completed'] || 0, color: '#10B981', icon: <CheckSquare size={16} /> },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 hover:shadow-md transition-all">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15` }}>
                <span style={{ color: s.color }}>{s.icon}</span>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs + Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['board', 'list', 'team'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium capitalize ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              {tab === 'team' ? 'Team' : tab}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm w-44 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </div>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm">
            <option value="">All Priority</option>
            {['critical', 'high', 'medium', 'low'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center gap-2">
            <Plus size={14} /> New Task
          </button>
        </div>
      </div>

      {/* Board View */}
      {activeTab === 'board' && kanban && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto">
          {COLUMNS.map(col => {
            const colTasks = (kanban[col.key] || []).filter(t => {
              const ms = !search || t.title.toLowerCase().includes(search.toLowerCase());
              const mp = !priorityFilter || t.priority === priorityFilter;
              return ms && mp;
            });
            return (
              <div key={col.key} className="min-w-44">
                <div className="flex items-center justify-between mb-2.5 px-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                    <span className="text-xs font-semibold text-gray-700">{col.label}</span>
                  </div>
                  <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">{colTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {colTasks.map(task => {
                    const days = daysUntil(task.deadline);
                    const isOverdue = days < 0 && task.status !== 'completed';
                    return (
                      <div key={task._id} onClick={() => setViewTask(task)}
                        className={`p-3 rounded-xl cursor-pointer bg-white border shadow-sm hover:shadow-md transition-all ${isOverdue ? 'border-red-200' : 'border-gray-100'}`}>
                        <div className="text-xs font-semibold text-gray-900 mb-1.5 leading-snug">{task.title}</div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${PRIORITY_COLORS[task.priority]}15`, color: PRIORITY_COLORS[task.priority] }}>
                            {task.priority}
                          </span>
                          <span className={`text-[10px] font-bold ${isOverdue ? 'text-red-600' : days <= 3 ? 'text-amber-600' : 'text-gray-500'}`}>
                            {task.status === 'completed' ? 'Done' : isOverdue ? `${Math.abs(days)}d late` : `${days}d`}
                          </span>
                        </div>
                        {task.deliverable && (
                          <div className="text-[10px] text-gray-400 truncate mb-1.5 flex items-center gap-1">
                            <Target size={9} /> {task.deliverable}
                          </div>
                        )}
                        {task.assignedTo && (
                          <div className="flex items-center gap-1.5 pt-1.5 border-t border-gray-100">
                            <div className="w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold text-white" style={{ background: getAvatarColor(task.assignedTo.name) }}>
                              {getInitials(task.assignedTo.name)}
                            </div>
                            <span className="text-[10px] text-gray-500 truncate">{task.assignedTo.name}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {colTasks.length === 0 && (
                    <div className="text-[10px] text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg">Empty</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {activeTab === 'list' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Task', 'Deliverable', 'Assignee', 'Deadline', 'Status', 'Priority'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map(t => {
                const days = daysUntil(t.deadline);
                const isOverdue = days < 0 && t.status !== 'completed';
                return (
                  <tr key={t._id} onClick={() => setViewTask(t)} className="hover:bg-gray-50 cursor-pointer border-b border-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{t.title}</div>
                      {t.description && <div className="text-xs text-gray-500 truncate max-w-xs">{t.description}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-600 flex items-center gap-1"><Target size={10} /> {t.deliverable || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      {t.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white" style={{ background: getAvatarColor(t.assignedTo.name) }}>{getInitials(t.assignedTo.name)}</div>
                          <span className="text-xs text-gray-600">{t.assignedTo.name}</span>
                        </div>
                      ) : <span className="text-xs text-gray-400">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-600">{new Date(t.deadline).toLocaleDateString()}</div>
                      <div className={`text-[10px] font-bold ${isOverdue ? 'text-red-600' : days <= 3 ? 'text-amber-600' : 'text-gray-500'}`}>
                        {isOverdue ? `${Math.abs(days)}d late` : `${days}d left`}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                        style={{ background: COLUMNS.find(c => c.key === t.status)?.color + '15', color: COLUMNS.find(c => c.key === t.status)?.color }}>
                        {t.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded capitalize"
                        style={{ background: `${PRIORITY_COLORS[t.priority]}15`, color: PRIORITY_COLORS[t.priority] }}>{t.priority}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredTasks.length === 0 && <div className="text-center py-12 text-gray-500 text-sm">No tasks found</div>}
        </div>
      )}

      {/* Team View */}
      {activeTab === 'team' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Member', 'Total', 'Completed', 'In Progress', 'Delayed', 'Critical', 'Completion %', 'On-Time %'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {team.map(m => (
                  <tr key={m._id} className="hover:bg-gray-50 border-b border-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: getAvatarColor(m.name) }}>{getInitials(m.name)}</div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{m.name}</div>
                          <div className="text-xs text-gray-500 capitalize">{m.role || 'team'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{m.total}</td>
                    <td className="px-4 py-3 text-sm text-green-600 font-semibold">{m.completed}</td>
                    <td className="px-4 py-3 text-sm text-cyan-600 font-semibold">{m.inProgress}</td>
                    <td className="px-4 py-3 text-sm text-red-600 font-semibold">{m.delayed}</td>
                    <td className="px-4 py-3 text-sm text-amber-600 font-semibold">{m.critical}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${m.completionRate}%`, background: m.completionRate >= 80 ? '#10B981' : m.completionRate >= 50 ? '#F59E0B' : '#EF4444' }} />
                        </div>
                        <span className="text-xs font-bold" style={{ color: m.completionRate >= 80 ? '#10B981' : m.completionRate >= 50 ? '#F59E0B' : '#EF4444' }}>{m.completionRate}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${m.onTimeRate}%` }} />
                        </div>
                        <span className="text-xs font-bold text-indigo-600">{m.onTimeRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {team.length === 0 && <div className="text-center py-12 text-gray-500 text-sm">No team data yet</div>}
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {viewTask && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setViewTask(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{viewTask.title}</h3>
                <p className="text-xs text-gray-500 capitalize">{viewTask.category} · {viewTask.priority} priority</p>
              </div>
              <button onClick={() => setViewTask(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-gray-400">Status</p>
                  <select value={viewTask.status} onChange={e => { handleStatusChange(viewTask._id, e.target.value); setViewTask({ ...viewTask, status: e.target.value as any }); }}
                    className="w-full mt-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm">
                    {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
                <div><p className="text-xs text-gray-400">Deadline</p><p className="text-sm font-medium text-gray-900 mt-1">{new Date(viewTask.deadline).toLocaleDateString()}</p></div>
                <div><p className="text-xs text-gray-400">Assignee</p><p className="text-sm font-medium text-gray-900 mt-1">{viewTask.assignedTo?.name || 'Unassigned'}</p></div>
                <div><p className="text-xs text-gray-400">Deliverable</p><p className="text-sm font-medium text-gray-900 mt-1 flex items-center gap-1"><Target size={12} /> {viewTask.deliverable || '—'}</p></div>
              </div>
              {viewTask.description && <div><p className="text-xs text-gray-400 mb-1">Description</p><p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{viewTask.description}</p></div>}
              {viewTask.notes && <div><p className="text-xs text-gray-400 mb-1">Notes</p><p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{viewTask.notes}</p></div>}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setDeleteTarget(viewTask._id)} className="px-3 py-2 bg-white border border-red-200 rounded-lg text-xs text-red-600 hover:bg-red-50">Delete</button>
              <button onClick={() => setViewTask(null)} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">New Task</h3>
              <button onClick={() => setShowCreate(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Title *</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Deliverable * <span className="text-gray-400 font-normal">(what will be delivered)</span></label>
                <input value={form.deliverable} onChange={e => setForm(p => ({ ...p, deliverable: e.target.value }))} placeholder="e.g. Final mix sent to distributor"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Deadline *</label>
                  <input type="date" value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Priority</label>
                  <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm">
                    {['low', 'medium', 'high', 'critical'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Category</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm">
                  {['general', 'production', 'marketing', 'finance', 'legal', 'distribution'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreate} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">Create Task</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Task"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default Tasks;
