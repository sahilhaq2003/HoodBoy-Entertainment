import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Plus, Search, Edit2, Trash2, Copy, Eye, ChevronDown, ChevronRight,
  Check, X, Tag, Clock, Hash,
} from 'lucide-react';
import { contractTemplatesApi } from '../services/api';
import type { ContractTemplate } from '../types';
import toast from 'react-hot-toast';
import { formatDate, formatStatus } from '../utils/helpers';

const CONTRACT_TYPES: Record<string, string> = {
  artist_agreement: 'Artist Agreement',
  producer_agreement: 'Producer Agreement',
  beat_license: 'Beat License',
  split_sheet: 'Split Sheet',
  featured_artist: 'Featured Artist',
  work_for_hire: 'Work for Hire',
  video_release: 'Video Release',
  photo_release: 'Photo Release',
  contractor: 'Contractor',
  nda: 'NDA',
  sync_license: 'Sync License',
  merchandise: 'Merchandise',
  recording: 'Recording',
  publishing: 'Publishing',
  distribution: 'Distribution',
  management: 'Management',
  licensing: 'Licensing',
  endorsement: 'Endorsement',
};

const TYPE_COLORS: Record<string, string> = {
  artist_agreement: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/40',
  producer_agreement: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/40',
  beat_license: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40',
  split_sheet: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/40',
  featured_artist: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800/40',
  work_for_hire: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800/40',
  video_release: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800/40',
  photo_release: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800/40',
  contractor: 'bg-gray-100 dark:bg-gray-700/40 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-700',
  nda: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/40',
  sync_license: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800/40',
  merchandise: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40',
  recording: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800/40',
  publishing: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/40',
  distribution: 'bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-400 border-lime-200 dark:border-lime-800/40',
  management: 'bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-200 dark:border-fuchsia-800/40',
  licensing: 'bg-slate-100 dark:bg-slate-700/40 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  endorsement: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/40',
};

const EMPTY_FORM: Omit<ContractTemplate, '_id' | 'createdAt' | 'usageCount'> = {
  name: '',
  type: 'artist_agreement',
  description: '',
  content: '',
  clauses: [],
  defaultTerms: {
    duration: 12,
    renewalTerm: 12,
    royaltyRate: 15,
    advanceAmount: 0,
    recoupmentType: 'none',
    notes: '',
  },
  isActive: true,
};

type TabKey = 'details' | 'content' | 'clauses' | 'terms';

const ContractTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState<TabKey>('details');
  const [viewTemplate, setViewTemplate] = useState<ContractTemplate | null>(null);
  const [expandedClauses, setExpandedClauses] = useState<Set<number>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<ContractTemplate | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (searchQuery) params.search = searchQuery;
      if (typeFilter) params.type = typeFilter;
      if (activeFilter !== 'all') params.isActive = activeFilter === 'active';
      const res = await contractTemplatesApi.getAll(params);
      setTemplates(res.data.data);
    } catch {
      toast.error('Failed to load contract templates');
    }
    setLoading(false);
  }, [searchQuery, typeFilter, activeFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const totalCount = templates.length;
  const activeCount = templates.filter(t => t.isActive).length;
  const totalUsage = templates.reduce((sum, t) => sum + (t.usageCount || 0), 0);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setModalMode('create');
    setActiveTab('details');
    setModalOpen(true);
  };

  const openEdit = (t: ContractTemplate) => {
    setForm({
      name: t.name,
      type: t.type,
      description: t.description,
      content: t.content,
      clauses: [...t.clauses],
      defaultTerms: { ...t.defaultTerms },
      isActive: t.isActive,
    });
    setEditingId(t._id);
    setModalMode('edit');
    setActiveTab('details');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Template name is required');
    try {
      if (modalMode === 'create') {
        await contractTemplatesApi.create(form);
        toast.success('Template created');
      } else {
        await contractTemplatesApi.update(editingId!, form);
        toast.success('Template updated');
      }
      setModalOpen(false);
      loadData();
    } catch {
      toast.error('Failed to save template');
    }
  };

  const handleDuplicate = async (t: ContractTemplate) => {
    try {
      await contractTemplatesApi.create({
        name: `${t.name} (Copy)`,
        type: t.type,
        description: t.description,
        content: t.content,
        clauses: t.clauses,
        defaultTerms: t.defaultTerms,
        isActive: false,
      });
      toast.success('Template duplicated');
      loadData();
    } catch {
      toast.error('Failed to duplicate template');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await contractTemplatesApi.delete(deleteTarget._id);
      toast.success('Template deleted');
      setDeleteTarget(null);
      loadData();
    } catch {
      toast.error('Failed to delete template');
    }
  };

  const addClause = () => {
    setForm(p => ({
      ...p,
      clauses: [...p.clauses, { title: '', body: '', category: 'general', order: p.clauses.length }],
    }));
  };

  const removeClause = (idx: number) => {
    setForm(p => ({ ...p, clauses: p.clauses.filter((_, i) => i !== idx) }));
  };

  const updateClause = (idx: number, field: string, value: string | number) => {
    setForm(p => ({
      ...p,
      clauses: p.clauses.map((c, i) => (i === idx ? { ...c, [field]: value } : c)),
    }));
  };

  const toggleClauseExpand = (idx: number) => {
    setExpandedClauses(p => {
      const next = new Set(p);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const filteredTemplates = templates;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <FileText size={28} className="text-indigo-600 dark:text-indigo-400" />
            Contract Templates
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage reusable contract templates for your label
          </p>
        </div>
        <button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5">
          <Plus size={16} />
          New Template
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Templates', value: totalCount, icon: <FileText size={18} className="text-indigo-600 dark:text-indigo-400" />, bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
          { label: 'Active Templates', value: activeCount, icon: <Check size={18} className="text-emerald-600 dark:text-emerald-400" />, bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Total Usage', value: totalUsage, icon: <Hash size={18} className="text-amber-600 dark:text-amber-400" />, bg: 'bg-amber-50 dark:bg-amber-900/20' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.bg}`}>
              {s.icon}
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{s.value}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadData()}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="">All Types</option>
          {Object.entries(CONTRACT_TYPES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
          {(['all', 'active', 'inactive'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setActiveFilter(opt)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeFilter === opt
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'grid'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            List
          </button>
        </div>
      </div>

      {filteredTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
          <FileText size={48} className="mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-lg font-medium">No templates found</p>
          <p className="text-sm mt-1">Create your first contract template to get started</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTemplates.map(t => (
            <div key={t._id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{t.name}</h3>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border mt-1.5 ${TYPE_COLORS[t.type] || TYPE_COLORS.contractor}`}>
                    {CONTRACT_TYPES[t.type] || t.type}
                  </span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1 ${
                  t.isActive
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                    : 'bg-gray-100 dark:bg-gray-700/40 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                }`}>
                  {t.isActive ? <Check size={10} /> : <X size={10} />}
                  {t.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              {t.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{t.description}</p>
              )}
              <div className="grid grid-cols-2 gap-2 mb-3 text-[11px]">
                <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg px-2.5 py-1.5">
                  <span className="text-gray-500 dark:text-gray-400">Duration</span>
                  <span className="ml-1 font-medium text-gray-700 dark:text-gray-300">{t.defaultTerms?.duration || 0}mo</span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg px-2.5 py-1.5">
                  <span className="text-gray-500 dark:text-gray-400">Royalty</span>
                  <span className="ml-1 font-medium text-gray-700 dark:text-gray-300">{t.defaultTerms?.royaltyRate || 0}%</span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg px-2.5 py-1.5">
                  <span className="text-gray-500 dark:text-gray-400">Advance</span>
                  <span className="ml-1 font-medium text-gray-700 dark:text-gray-300">${(t.defaultTerms?.advanceAmount || 0).toLocaleString()}</span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg px-2.5 py-1.5">
                  <span className="text-gray-500 dark:text-gray-400">Clauses</span>
                  <span className="ml-1 font-medium text-gray-700 dark:text-gray-300">{t.clauses?.length || 0}</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <Hash size={12} />
                  Used {t.usageCount || 0} times
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setViewTemplate(t)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                    <Eye size={14} />
                  </button>
                  <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDuplicate(t)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                    <Copy size={14} />
                  </button>
                  <button onClick={() => setDeleteTarget(t)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                {['Name', 'Type', 'Clauses', 'Duration', 'Royalty', 'Usage', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTemplates.map(t => (
                <tr key={t._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-50 dark:border-gray-700 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[200px]">{t.name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${TYPE_COLORS[t.type] || TYPE_COLORS.contractor}`}>
                      {CONTRACT_TYPES[t.type] || t.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{t.clauses?.length || 0}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{t.defaultTerms?.duration || 0}mo</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{t.defaultTerms?.royaltyRate || 0}%</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{t.usageCount || 0}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1 ${
                      t.isActive
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                        : 'bg-gray-100 dark:bg-gray-700/40 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                    }`}>
                      {t.isActive ? <Check size={10} /> : <X size={10} />}
                      {t.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setViewTemplate(t)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDuplicate(t)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400">
                        <Copy size={14} />
                      </button>
                      <button onClick={() => setDeleteTarget(t)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 dark:hover:text-red-400">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-3xl max-h-[85vh] shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {modalMode === 'create' ? 'New Contract Template' : 'Edit Template'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
                <X size={18} />
              </button>
            </div>

            <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
              {([
                { key: 'details' as TabKey, label: 'Details' },
                { key: 'content' as TabKey, label: 'Content' },
                { key: 'clauses' as TabKey, label: `Clauses (${form.clauses.length})` },
                { key: 'terms' as TabKey, label: 'Default Terms' },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'details' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template Name *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="e.g. Standard Artist Agreement"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                    <select
                      value={form.type}
                      onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      {Object.entries(CONTRACT_TYPES).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                    <textarea
                      value={form.description}
                      onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Brief description of this template..."
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Active</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Enable this template for use</p>
                    </div>
                    <button
                      onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
                      className={`relative w-11 h-6 rounded-full transition-colors ${form.isActive ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${form.isActive ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'content' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template Content / Boilerplate</label>
                    <textarea
                      value={form.content}
                      onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                      rows={20}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                      placeholder="Enter the full contract template text here..."
                    />
                  </div>
                </div>
              )}

              {activeTab === 'clauses' && (
                <div className="space-y-3">
                  {form.clauses.map((clause, idx) => (
                    <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <div
                        className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/40 cursor-pointer"
                        onClick={() => toggleClauseExpand(idx)}
                      >
                        <div className="flex items-center gap-2">
                          {expandedClauses.has(idx) ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{clause.title || `Clause ${idx + 1}`}</span>
                          {clause.category && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
                              <Tag size={8} />
                              {clause.category}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); removeClause(idx); }}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      {expandedClauses.has(idx) && (
                        <div className="p-4 space-y-3 border-t border-gray-200 dark:border-gray-700">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                              <input
                                type="text"
                                value={clause.title}
                                onChange={e => updateClause(idx, 'title', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="Clause title"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                              <input
                                type="text"
                                value={clause.category}
                                onChange={e => updateClause(idx, 'category', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="e.g. payment, termination"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Body</label>
                            <textarea
                              value={clause.body}
                              onChange={e => updateClause(idx, 'body', e.target.value)}
                              rows={4}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              placeholder="Clause body text..."
                            />
                          </div>
                          <div className="w-24">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Order</label>
                            <input
                              type="number"
                              value={clause.order}
                              onChange={e => updateClause(idx, 'order', +e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <button onClick={addClause} className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors inline-flex items-center justify-center gap-1.5">
                    <Plus size={14} />
                    Add Clause
                  </button>
                </div>
              )}

              {activeTab === 'terms' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration (months)</label>
                      <input
                        type="number"
                        value={form.defaultTerms.duration}
                        onChange={e => setForm(p => ({ ...p, defaultTerms: { ...p.defaultTerms, duration: +e.target.value } }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Renewal Term (months)</label>
                      <input
                        type="number"
                        value={form.defaultTerms.renewalTerm}
                        onChange={e => setForm(p => ({ ...p, defaultTerms: { ...p.defaultTerms, renewalTerm: +e.target.value } }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Royalty Rate (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={form.defaultTerms.royaltyRate}
                        onChange={e => setForm(p => ({ ...p, defaultTerms: { ...p.defaultTerms, royaltyRate: +e.target.value } }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Advance Amount ($)</label>
                      <input
                        type="number"
                        value={form.defaultTerms.advanceAmount}
                        onChange={e => setForm(p => ({ ...p, defaultTerms: { ...p.defaultTerms, advanceAmount: +e.target.value } }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recoupment Type</label>
                    <select
                      value={form.defaultTerms.recoupmentType}
                      onChange={e => setForm(p => ({ ...p, defaultTerms: { ...p.defaultTerms, recoupmentType: e.target.value } }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="none">None</option>
                      <option value="recoupable">Recoupable</option>
                      <option value="partially_recoupable">Partially Recoupable</option>
                      <option value="cross_collateralized">Cross Collateralized</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                    <textarea
                      value={form.defaultTerms.notes}
                      onChange={e => setForm(p => ({ ...p, defaultTerms: { ...p.defaultTerms, notes: e.target.value } }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Additional notes about default terms..."
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setModalOpen(false)} className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5">
                <Check size={15} />
                {modalMode === 'create' ? 'Create Template' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewTemplate && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewTemplate(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-3xl max-h-[85vh] shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{viewTemplate.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${TYPE_COLORS[viewTemplate.type] || TYPE_COLORS.contractor}`}>
                    {CONTRACT_TYPES[viewTemplate.type] || viewTemplate.type}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1 ${
                    viewTemplate.isActive
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                      : 'bg-gray-100 dark:bg-gray-700/40 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                  }`}>
                    {viewTemplate.isActive ? <Check size={10} /> : <X size={10} />}
                    {viewTemplate.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setViewTemplate(null); openEdit(viewTemplate); }} className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1">
                  <Edit2 size={12} /> Edit
                </button>
                <button onClick={() => setViewTemplate(null)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {viewTemplate.description && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Description</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{viewTemplate.description}</p>
                </div>
              )}

              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Default Terms</h4>
                <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-600">
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Field</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-100 dark:border-gray-600">
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">Duration</td>
                        <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{viewTemplate.defaultTerms?.duration || 0} months</td>
                      </tr>
                      <tr className="border-b border-gray-100 dark:border-gray-600">
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">Renewal Term</td>
                        <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{viewTemplate.defaultTerms?.renewalTerm || 0} months</td>
                      </tr>
                      <tr className="border-b border-gray-100 dark:border-gray-600">
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">Royalty Rate</td>
                        <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{viewTemplate.defaultTerms?.royaltyRate || 0}%</td>
                      </tr>
                      <tr className="border-b border-gray-100 dark:border-gray-600">
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">Advance Amount</td>
                        <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">${(viewTemplate.defaultTerms?.advanceAmount || 0).toLocaleString()}</td>
                      </tr>
                      <tr className="border-b border-gray-100 dark:border-gray-600">
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">Recoupment Type</td>
                        <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100 capitalize">{formatStatus(viewTemplate.defaultTerms?.recoupmentType || 'none')}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">Usage Count</td>
                        <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{viewTemplate.usageCount || 0}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {viewTemplate.content && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Template Content</h4>
                  <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
                    {viewTemplate.content}
                  </div>
                </div>
              )}

              {viewTemplate.clauses && viewTemplate.clauses.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Clauses ({viewTemplate.clauses.length})</h4>
                  <div className="space-y-2">
                    {viewTemplate.clauses
                      .sort((a, b) => a.order - b.order)
                      .map((clause, idx) => (
                      <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{clause.title}</span>
                            {clause.category && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
                                <Tag size={8} />
                                {clause.category}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">#{clause.order}</span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{clause.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {viewTemplate.defaultTerms?.notes && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Notes</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/40 rounded-lg p-4">{viewTemplate.defaultTerms.notes}</p>
                </div>
              )}

              <div className="text-xs text-gray-400 dark:text-gray-500">
                Created {formatDate(viewTemplate.createdAt)}
              </div>
            </div>

            <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setViewTemplate(null)} className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-sm shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <Trash2 size={18} className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Delete Template</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
              Are you sure you want to delete <span className="font-semibold text-gray-900 dark:text-gray-100">{deleteTarget.name}</span>?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete} className="bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractTemplates;
