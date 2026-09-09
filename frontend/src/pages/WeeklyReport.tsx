import React, { useState, useEffect } from 'react';
import {
  Calendar, Plus, ChevronLeft, ChevronRight, Save, Trash2, RefreshCw, X,
  AlertTriangle, CheckCircle, Clock, HelpCircle, Zap,
} from 'lucide-react';
import { weeklyReportsApi } from '../services/api';
import type { WeeklyReport } from '../types';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const WEEKLY_QUESTIONS = [
  { key: 'completed', label: 'What was completed?', icon: <CheckCircle size={16} className="text-green-500" />, color: '#10B981', placeholder: 'List completed items...' },
  { key: 'stillOpen', label: 'What is still open?', icon: <Clock size={16} className="text-amber-500" />, color: '#F59E0B', placeholder: 'List open items...' },
  { key: 'blocked', label: 'What is blocked?', icon: <AlertTriangle size={16} className="text-red-500" />, color: '#EF4444', placeholder: 'List blocked items...' },
  { key: 'needsApproval', label: 'What needs approval?', icon: <HelpCircle size={16} className="text-purple-500" />, color: '#8B5CF6', placeholder: 'List items needing approval...' },
  { key: 'dueThisWeek', label: 'What is due this week?', icon: <Calendar size={16} className="text-cyan-500" />, color: '#06B6D4', placeholder: 'List items due this week...' },
  { key: 'biggestRisk', label: 'What is the biggest risk?', icon: <AlertTriangle size={16} className="text-orange-500" />, color: '#F59E0B', placeholder: 'Identify biggest risk...' },
  { key: 'nextActionOwner', label: 'Who owns next action?', icon: <Zap size={16} className="text-indigo-500" />, color: '#6366F1', placeholder: 'Name & action...' },
];

const WeeklyReport: React.FC = () => {
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [currentReport, setCurrentReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [form, setForm] = useState({
    completed: '', stillOpen: '', blocked: '', needsApproval: '',
    dueThisWeek: '', biggestRisk: '', nextActionOwner: '', notes: '',
  });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [currentRes, allRes] = await Promise.all([
          weeklyReportsApi.getCurrentWeek(), weeklyReportsApi.getAll(),
        ]);
        const current = currentRes.data.data;
        setCurrentReport(current);
        setReports(allRes.data.data);
        setForm({
          completed: current.completed || '', stillOpen: current.stillOpen || '',
          blocked: current.blocked || '', needsApproval: current.needsApproval || '',
          dueThisWeek: current.dueThisWeek || '', biggestRisk: current.biggestRisk || '',
          nextActionOwner: current.nextActionOwner || '', notes: current.notes || '',
        });
      } catch { toast.error('Failed to load reports'); }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (!currentReport) return;
    setSaving(true);
    try {
      await weeklyReportsApi.update(currentReport._id, form);
      toast.success('Report saved');
      const allRes = await weeklyReportsApi.getAll();
      setReports(allRes.data.data);
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await weeklyReportsApi.delete(id);
      toast.success('Report deleted');
      setReports(prev => prev.filter(r => r._id !== id));
    } catch { toast.error('Failed to delete'); }
  };

  const formatDateRange = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const isCurrentWeek = (report: WeeklyReport) => {
    if (!currentReport) return false;
    return report._id === currentReport._id;
  };

  const getFieldCompletion = () => {
    const fields = ['completed', 'stillOpen', 'blocked', 'needsApproval', 'dueThisWeek', 'biggestRisk', 'nextActionOwner'];
    const filled = fields.filter(f => form[f as keyof typeof form]?.trim()).length;
    return Math.round((filled / fields.length) * 100);
  };

  if (loading) return <div className="flex justify-center py-20"><RefreshCw size={24} className="text-indigo-500 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Calendar size={28} className="text-indigo-600" />
            Weekly Report
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track team progress with structured weekly check-ins</p>
        </div>
        {currentReport && (
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50">
            <Save size={15} /> {saving ? 'Saving...' : 'Save Report'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => setActiveTab('current')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'current' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}>
          This Week
        </button>
        <button onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}>
          History ({reports.length})
        </button>
      </div>

      {/* Current Week Tab */}
      {activeTab === 'current' && currentReport && (
        <div className="space-y-4">
          {/* Week Header */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-bold text-gray-900">Week of {formatDateRange(currentReport.weekStart, currentReport.weekEnd)}</h2>
                <p className="text-xs text-gray-500 mt-0.5">Fill in each section below. All fields recommended.</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${getFieldCompletion()}%` }} />
                </div>
                <span className="text-xs font-bold text-indigo-600">{getFieldCompletion()}%</span>
              </div>
            </div>
          </div>

          {/* Questions */}
          {WEEKLY_QUESTIONS.map(q => (
            <div key={q.key} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100">
                {q.icon}
                <h3 className="text-sm font-bold text-gray-900">{q.label}</h3>
                {form[q.key as keyof typeof form]?.trim() && <CheckCircle size={14} className="text-green-500 ml-auto" />}
              </div>
              <div className="p-4">
                <textarea
                  value={form[q.key as keyof typeof form]}
                  onChange={e => setForm(p => ({ ...p, [q.key]: e.target.value }))}
                  placeholder={q.placeholder}
                  rows={3}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 resize-none"
                />
              </div>
            </div>
          ))}

          {/* Notes */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Additional Notes</h3>
            </div>
            <div className="p-4">
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Any additional notes or context..." rows={2}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 resize-none" />
            </div>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {reports.map(r => {
            const completed = [r.completed, r.stillOpen, r.blocked, r.needsApproval, r.dueThisWeek, r.biggestRisk, r.nextActionOwner].filter(f => f?.trim()).length;
            const pct = Math.round((completed / 7) * 100);
            return (
              <div key={r._id} className={`bg-white border rounded-xl p-5 ${isCurrentWeek(r) ? 'border-indigo-300 ring-2 ring-indigo-500/10' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">
                      {formatDateRange(r.weekStart, r.weekEnd)}
                      {isCurrentWeek(r) && <span className="ml-2 text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold">CURRENT</span>}
                    </h3>
                    {r.createdBy && <p className="text-xs text-gray-500 mt-0.5">By {r.createdBy.name}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? '#10B981' : '#F59E0B' }} />
                      </div>
                      <span className="text-xs font-bold text-gray-600">{pct}%</span>
                    </div>
                    <button onClick={() => setDeleteTarget(r._id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {WEEKLY_QUESTIONS.map(q => (
                    <div key={q.key} className="text-xs">
                      <span className="font-semibold text-gray-500">{q.label.replace('?', '')}:</span>
                      <span className="text-gray-700 ml-1">{r[q.key as keyof WeeklyReport] ? '✓' : '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {reports.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <Calendar size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm">No weekly reports yet</p>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Report"
        message="Are you sure you want to delete this weekly report? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default WeeklyReport;
