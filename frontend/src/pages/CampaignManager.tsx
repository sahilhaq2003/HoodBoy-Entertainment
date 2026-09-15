import React, { useEffect, useState, useCallback } from 'react';
import {
  Megaphone, Plus, Search, Calendar, BarChart3, Target, X,
  ChevronLeft, ChevronRight, Eye, Edit3, Trash2, FileText,
  TrendingUp, DollarSign, Users, Activity, AlertTriangle, Clock,
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { campaignsApi, artistsApi } from '../services/api';
import type { Campaign, Artist, ContentItem } from '../types';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const TYPE_COLORS: Record<string, string> = {
  social_media: '#8B5CF6', email: '#06B6D4', radio: '#F59E0B', pr: '#EC4899',
  influencer: '#10B981', paid_ads: '#EF4444', event: '#7C3AED', content: '#6366F1',
  sync: '#14B8A6', brand: '#A855F7', other: '#6B7280',
};
const STATUS_COLORS: Record<string, string> = {
  planned: '#F59E0B', active: '#10B981', paused: '#EF4444', completed: '#6366F1', cancelled: '#9CA3AF',
};
const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E1306C', tiktok: '#000000', youtube: '#FF0000', twitter: '#1DA1F2',
  facebook: '#1877F2', spotify: '#1DB954', email: '#F59E0B', radio: '#8B5CF6',
  blog: '#06B6D4', other: '#6B7280',
};
const PIE_COLORS = ['#8B5CF6', '#06B6D4', '#F59E0B', '#EC4899', '#10B981', '#EF4444', '#7C3AED', '#6366F1', '#14B8A6', '#A855F7'];

const CampaignManager: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'campaigns' | 'calendar' | 'performance'>('campaigns');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [viewCampaign, setViewCampaign] = useState<Campaign | null>(null);
  const [showContentModal, setShowContentModal] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<ContentItem | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarItems, setCalendarItems] = useState<any[]>([]);
  const [perfData, setPerfData] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'campaign' | 'content'; campaignId: string; contentId?: string } | null>(null);

  const [form, setForm] = useState({
    name: '', type: 'social_media', artist: '', status: 'planned',
    startDate: '', endDate: '', budget: 0, targetAudience: '',
    releaseDate: '', spent: 0, attributedRevenue: 0, objective: '', mainStory: '', contentThemes: '', callsToAction: '',
    platforms: [] as string[], contentCategories: [] as string[], contentTarget: 20, goals: '', notes: '',
    advertisingTests: [] as Array<{ name: string; platform: string; audience: string; creative: string; callToAction: string; budget: number; spent: number; impressions: number; clicks: number; conversions: number; status: string; result: string }>,
  });
  const [contentForm, setContentForm] = useState({
    title: '', platform: 'instagram', contentType: 'post',
    category: 'promotional', scheduledDate: '', caption: '', mediaUrl: '', link: '', status: 'draft',
    impressions: 0, clicks: 0, likes: 0, shares: 0, comments: 0, conversions: 0,
  });

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 15 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      const res = await campaignsApi.getAll(params);
      setCampaigns(res.data.data);
      setTotalPages(res.data.pages || 1);
    } catch { toast.error('Failed to load campaigns'); }
    setLoading(false);
  }, [page, search, statusFilter, typeFilter]);

  const loadStats = async () => {
    try {
      const res = await campaignsApi.getStats();
      setStats(res.data.data);
    } catch { toast.error('Failed to load campaign stats'); }
  };

  const loadArtists = async () => {
    try {
      const res = await artistsApi.getAll();
      setArtists(res.data.data);
    } catch { toast.error('Failed to load artists'); }
  };

  const loadCalendar = async () => {
    try {
      const res = await campaignsApi.getCalendar({ month: calendarMonth, year: calendarYear });
      setCalendarItems(res.data.data);
    } catch { toast.error('Failed to load calendar'); }
  };

  const loadPerformance = async (id: string) => {
    try {
      const res = await campaignsApi.getPerformance(id);
      setPerfData(res.data.data);
    } catch { toast.error('Failed to load performance data'); }
  };

  useEffect(() => { loadCampaigns(); loadStats(); loadArtists(); }, [loadCampaigns]);
  useEffect(() => { if (activeTab === 'calendar') loadCalendar(); }, [activeTab, calendarMonth, calendarYear]);
  useEffect(() => { if (activeTab === 'performance' && viewCampaign) loadPerformance(viewCampaign._id); }, [activeTab, viewCampaign]);

  const resetForm = () => setForm({
    name: '', type: 'social_media', artist: '', status: 'planned',
    startDate: '', endDate: '', budget: 0, targetAudience: '',
    releaseDate: '', spent: 0, attributedRevenue: 0, objective: '', mainStory: '', contentThemes: '', callsToAction: '',
    platforms: [], contentCategories: [], contentTarget: 20, goals: '', notes: '', advertisingTests: [],
  });

  const resetContentForm = () => setContentForm({
    title: '', platform: 'instagram', contentType: 'post',
    category: 'promotional', scheduledDate: '', caption: '', mediaUrl: '', link: '', status: 'draft', impressions: 0, clicks: 0, likes: 0, shares: 0, comments: 0, conversions: 0,
  });

  const handleCreate = async () => {
    if (!form.name || !form.startDate || !form.endDate) return toast.error('Name and dates required');
    if (new Date(form.endDate) < new Date(form.startDate)) return toast.error('End date must be after the start date');
    if (!form.objective.trim() || !form.targetAudience.trim()) return toast.error('Campaign objective and target audience are required');
    try {
      const data: any = { ...form, goals: form.goals ? form.goals.split('\n').filter(Boolean) : [], contentThemes: form.contentThemes.split('\n').filter(Boolean), callsToAction: form.callsToAction.split('\n').filter(Boolean) };
      if (!data.artist) delete data.artist;
      await campaignsApi.create(data);
      toast.success('Campaign created');
      setShowCreateModal(false);
      resetForm();
      loadCampaigns();
      loadStats();
    } catch { toast.error('Failed to create campaign'); }
  };

  const handleUpdate = async () => {
    if (!editingCampaign) return;
    if (new Date(form.endDate) < new Date(form.startDate)) return toast.error('End date must be after the start date');
    if (!form.objective.trim() || !form.targetAudience.trim()) return toast.error('Campaign objective and target audience are required');
    try {
      const data: any = { ...form, goals: form.goals ? form.goals.split('\n').filter(Boolean) : [], contentThemes: form.contentThemes.split('\n').filter(Boolean), callsToAction: form.callsToAction.split('\n').filter(Boolean) };
      if (!data.artist) delete data.artist;
      await campaignsApi.update(editingCampaign._id, data);
      toast.success('Campaign updated');
      setEditingCampaign(null);
      resetForm();
      loadCampaigns();
      loadStats();
    } catch { toast.error('Failed to update campaign'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await campaignsApi.delete(id);
      toast.success('Campaign deleted');
      loadCampaigns();
      loadStats();
    } catch { toast.error('Failed to delete campaign'); }
  };

  const handleAddContent = async () => {
    if (!showContentModal || !contentForm.title) return toast.error('Title required');
    try {
      await campaignsApi.addContentItem(showContentModal, contentForm);
      toast.success('Content item added');
      setShowContentModal(null);
      resetContentForm();
      loadCampaigns();
    } catch { toast.error('Failed to add content'); }
  };

  const handleUpdateContent = async () => {
    if (!viewCampaign || !editingContent) return;
    try {
      await campaignsApi.updateContentItem(viewCampaign._id, editingContent._id, contentForm);
      toast.success('Content updated');
      setEditingContent(null);
      setShowContentModal(null);
      resetContentForm();
      const res = await campaignsApi.getById(viewCampaign._id);
      setViewCampaign(res.data.data);
      loadCampaigns();
    } catch { toast.error('Failed to update content'); }
  };

  const handleDeleteContent = async (campaignId: string, contentId: string) => {
    if (!window.confirm('Delete this content item? This cannot be undone.')) return;
    try {
      await campaignsApi.deleteContentItem(campaignId, contentId);
      toast.success('Content deleted');
      if (viewCampaign?._id === campaignId) {
        const res = await campaignsApi.getById(campaignId);
        setViewCampaign(res.data.data);
      }
      loadCampaigns();
    } catch { toast.error('Failed to delete content'); }
  };

  const openEditCampaign = (c: Campaign) => {
    setForm({
      name: c.name, type: c.type, artist: c.artist?._id || '', status: c.status,
      startDate: c.startDate?.split('T')[0] || '', endDate: c.endDate?.split('T')[0] || '',
      budget: c.budget, targetAudience: c.targetAudience || '',
      releaseDate: c.releaseDate?.split('T')[0] || '', spent: c.spent || 0, attributedRevenue: c.attributedRevenue || 0, objective: c.objective || '', mainStory: c.mainStory || '', contentThemes: (c.contentThemes || []).join('\n'), callsToAction: (c.callsToAction || []).join('\n'),
      platforms: c.platforms || [], contentCategories: c.contentCategories || [], contentTarget: c.contentTarget || 20, goals: (c.goals || []).join('\n'), notes: c.notes || '', advertisingTests: c.advertisingTests || [],
    });
    setEditingCampaign(c);
  };

  const openAddContent = (campaignId: string) => {
    resetContentForm();
    setEditingContent(null);
    setShowContentModal(campaignId);
  };

  const openEditContent = (ci: ContentItem) => {
    setContentForm({
      title: ci.title, platform: ci.platform, contentType: ci.contentType,
      category: ci.category || 'promotional', scheduledDate: ci.scheduledDate?.split('T')[0] || '', caption: ci.caption || '',
      mediaUrl: ci.mediaUrl || '', link: ci.link || '', status: ci.status, impressions: ci.impressions || 0, clicks: ci.clicks || 0, likes: ci.likes || 0, shares: ci.shares || 0, comments: ci.comments || 0, conversions: ci.conversions || 0,
    });
    setEditingContent(ci);
    setShowContentModal(viewCampaign?._id || null);
  };

  const togglePlatform = (p: string) => {
    setForm(prev => ({
      ...prev,
      platforms: prev.platforms.includes(p)
        ? prev.platforms.filter(x => x !== p)
        : [...prev.platforms, p],
    }));
  };

  const getDaysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m - 1, 1).getDay();

  const getCalendarDays = () => {
    const days = getDaysInMonth(calendarYear, calendarMonth);
    const firstDay = getFirstDayOfMonth(calendarYear, calendarMonth);
    const cells: { day: number | null; items: any[] }[] = [];
    for (let i = 0; i < firstDay; i++) cells.push({ day: null, items: [] });
    for (let d = 1; d <= days; d++) {
      const dateStr = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayItems = calendarItems.filter((ci: any) => {
        const sd = new Date(ci.scheduledDate).toISOString().split('T')[0];
        return sd === dateStr;
      });
      cells.push({ day: d, items: dayItems });
    }
    return cells;
  };

  const platformChartData = perfData?.byPlatform
    ? Object.entries(perfData.byPlatform).map(([name, data]: [string, any]) => ({
        name, value: data.count, impressions: data.impressions, clicks: data.clicks,
      }))
    : [];

  const typeChartData = stats?.byType
    ? stats.byType.map((t: any) => ({ name: t._id?.replace(/_/g, ' ') || 'unknown', value: t.count }))
    : [];

  const formatCurrency = (n: number) => `$${(n || 0).toLocaleString()}`;

  if (loading && campaigns.length === 0) {
    return <div className="flex justify-center py-20"><LoadingSpinner size={28} /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Megaphone size={28} className="text-indigo-600" />
            Campaign Manager
          </h1>
          <p className="text-sm text-gray-500 mt-1">Plan, track, and measure marketing campaigns</p>
        </div>
        <button onClick={() => { resetForm(); setShowCreateModal(true); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center gap-2">
          <Plus size={15} />New Campaign
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(['campaigns', 'calendar', 'performance'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Campaigns Tab */}
      {activeTab === 'campaigns' && (
        <>
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Total', value: stats.total, color: '#6366F1', icon: <Megaphone size={16} /> },
                { label: 'Active', value: stats.active, color: '#10B981', icon: <Activity size={16} /> },
                { label: 'Planned', value: stats.planned, color: '#F59E0B', icon: <Target size={16} /> },
                { label: 'Completed', value: stats.completed, color: '#8B5CF6', icon: <BarChart3 size={16} /> },
                { label: 'Total Budget', value: formatCurrency(stats.totalBudget), color: '#06B6D4', icon: <DollarSign size={16} /> },
                { label: 'Total Spent', value: formatCurrency(stats.totalSpent), color: '#EF4444', icon: <DollarSign size={16} /> },
              ].map((s, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${s.color}15` }}>
                      <span style={{ color: s.color }}>{s.icon}</span>
                    </div>
                  </div>
                  <div className="text-xl font-bold text-gray-900">{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-48 bg-white border border-gray-200">
              <Search size={14} className="text-gray-400" />
              <input type="text" placeholder="Search campaigns..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none flex-1" />
            </div>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none">
              <option value="">All Status</option>
              {['planned', 'active', 'paused', 'completed', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none">
              <option value="">All Types</option>
              {Object.keys(TYPE_COLORS).map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>

          {/* Budget Alerts Banner */}
          {campaigns.filter(c => c.budget > 0 && c.spent / c.budget > 0.85).length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
                <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300">Budget Alerts</h4>
              </div>
              <div className="space-y-2">
                {campaigns.filter(c => c.budget > 0 && c.spent / c.budget > 0.85).map(c => {
                  const pct = Math.round((c.spent / c.budget) * 100);
                  return (
                    <div key={c._id} className="flex items-center justify-between text-xs">
                      <span className="text-amber-700 dark:text-amber-300 font-medium">{c.name}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-amber-200 dark:bg-amber-800/40 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-amber-500" style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className={`font-bold ${pct >= 100 ? 'text-red-600' : 'text-amber-600 dark:text-amber-400'}`}>{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Campaign</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Artist</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Dates</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Budget</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Progress</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map(c => {
                    const tc = TYPE_COLORS[c.type] || '#6B7280';
                    const sc = STATUS_COLORS[c.status] || '#6B7280';
                    return (
                      <tr key={c._id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <button onClick={() => setViewCampaign(c)} className="text-sm font-semibold text-gray-900 hover:text-indigo-600 text-left">{c.name}</button>
                          {c.contentItems?.length > 0 && <p className="text-xs text-gray-400 mt-0.5">{c.contentItems.length} content items</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md" style={{ background: `${tc}15`, color: tc, border: `1px solid ${tc}30` }}>
                            {c.type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{c.artist?.stageName || c.artist?.name || '-'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {new Date(c.startDate).toLocaleDateString()} - {new Date(c.endDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <span className="font-medium">{formatCurrency(c.budget)}</span>
                          <span className="text-gray-400 mx-1">/</span>
                          <span className="text-gray-500">{formatCurrency(c.spent)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${c.progress || 0}%` }} />
                            </div>
                            <span className="text-xs text-gray-500">{c.progress || 0}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: `${sc}15`, color: sc }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc }} />
                            {c.status}
                          </span>
                          {c.contentItems && c.contentItems.filter((ci: any) => ci.status === 'draft').length > 0 && (
                            <div className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-1">
                              <Clock size={10} />
                              {c.contentItems.filter((ci: any) => ci.status === 'draft').length} pending approval
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setViewCampaign(c)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-indigo-600"><Eye size={14} /></button>
                            <button onClick={() => openEditCampaign(c)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-amber-600"><Edit3 size={14} /></button>
                            <button onClick={() => setDeleteTarget({ type: 'campaign', campaignId: c._id })} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {campaigns.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-12 text-gray-500">
                      <Megaphone size={36} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm">No campaigns found</p>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">Previous</button>
                <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">Next</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Calendar Tab */}
      {activeTab === 'calendar' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">
              {new Date(calendarYear, calendarMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={() => { if (calendarMonth === 1) { setCalendarMonth(12); setCalendarYear(y => y - 1); } else setCalendarMonth(m => m - 1); }}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><ChevronLeft size={16} /></button>
              <button onClick={() => { if (calendarMonth === 12) { setCalendarMonth(1); setCalendarYear(y => y + 1); } else setCalendarMonth(m => m + 1); }}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><ChevronRight size={16} /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="bg-gray-50 px-2 py-2 text-xs font-semibold text-gray-500 text-center">{d}</div>
            ))}
            {getCalendarDays().map((cell, idx) => {
              const today = new Date();
              const isToday = cell.day && today.getDate() === cell.day && today.getMonth() + 1 === calendarMonth && today.getFullYear() === calendarYear;
              return (
                <div key={idx} className={`bg-white p-1.5 min-h-[80px] ${isToday ? 'ring-2 ring-indigo-500 ring-inset' : ''}`}>
                  {cell.day && (
                    <>
                      <div className={`text-xs font-medium mb-1 ${isToday ? 'text-indigo-600 font-bold' : 'text-gray-500'}`}>{cell.day}</div>
                      <div className="space-y-0.5">
                        {cell.items.slice(0, 3).map((ci: any) => (
                          <div key={ci._id} className="text-[10px] font-medium px-1 py-0.5 rounded truncate" style={{ background: `${PLATFORM_COLORS[ci.platform] || '#6B7280'}20`, color: PLATFORM_COLORS[ci.platform] || '#6B7280' }}>
                            {ci.title}
                          </div>
                        ))}
                        {cell.items.length > 3 && <div className="text-[9px] text-gray-400 text-center">+{cell.items.length - 3} more</div>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Performance Tab */}
      {activeTab === 'performance' && (
        <div className="space-y-5">
          {!viewCampaign ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Select a campaign to view performance metrics.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {campaigns.filter(c => c.status === 'active' || c.status === 'completed').map(c => (
                  <button key={c._id} onClick={() => setViewCampaign(c)} className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-indigo-300 transition-all">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${TYPE_COLORS[c.type]}15` }}>
                        <Megaphone size={16} style={{ color: TYPE_COLORS[c.type] }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-500">{c.artist?.stageName || c.artist?.name || 'No artist'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[c.status] }} />
                        {c.status}
                      </span>
                      <span>{c.contentItems?.length || 0} items</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => { setViewCampaign(null); setPerfData(null); }} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><ChevronLeft size={16} /></button>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{viewCampaign.name} — Performance</h3>
                    <p className="text-xs text-gray-500">{viewCampaign.artist?.stageName || viewCampaign.artist?.name}</p>
                  </div>
                </div>
              </div>
              {perfData && (
                <div className="space-y-5">
                  {/* Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                    {[
                      { label: 'Impressions', value: perfData.totalImpressions.toLocaleString(), color: '#6366F1' },
                      { label: 'Clicks', value: perfData.totalClicks.toLocaleString(), color: '#06B6D4' },
                      { label: 'Conversions', value: perfData.totalConversions.toLocaleString(), color: '#10B981' },
                      { label: 'Cost/Click', value: formatCurrency(perfData.costPerClick), color: '#F59E0B' },
                      { label: 'Cost/Conv', value: formatCurrency(perfData.costPerConversion), color: '#EC4899' },
                      { label: 'ROI', value: `${perfData.roi}%`, color: perfData.roi >= 0 ? '#10B981' : '#EF4444' },
                      { label: 'Revenue', value: formatCurrency(perfData.attributedRevenue), color: '#10B981' },
                      { label: 'Profit / Loss', value: formatCurrency(perfData.profit), color: perfData.profit >= 0 ? '#10B981' : '#EF4444' },
                    ].map((s, i) => (
                      <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
                        <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
                        <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {platformChartData.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-xl p-5">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Content by Platform</h4>
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie data={platformChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                              {platformChartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    {platformChartData.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-xl p-5">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Impressions by Platform</h4>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={platformChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Bar dataKey="impressions" fill="#6366F1" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {/* Content Items Table */}
                  {perfData.contentItems?.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <h4 className="text-sm font-semibold text-gray-700">Content Items</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-100 bg-gray-50">
                              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Title</th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Platform</th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Status</th>
                              <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Impressions</th>
                              <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Clicks</th>
                              <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Likes</th>
                              <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Conversions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {perfData.contentItems.sort((a: ContentItem, b: ContentItem) => b.impressions - a.impressions).slice(0, 10).map((ci: ContentItem) => (
                              <tr key={ci._id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="px-4 py-2 text-sm font-medium text-gray-900">{ci.title}</td>
                                <td className="px-4 py-2">
                                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: `${PLATFORM_COLORS[ci.platform] || '#6B7280'}20`, color: PLATFORM_COLORS[ci.platform] || '#6B7280' }}>
                                    {ci.platform}
                                  </span>
                                </td>
                                <td className="px-4 py-2">
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${ci.status === 'published' ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400' : ci.status === 'scheduled' ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' : ci.status === 'draft' ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'}`}>
                                    {ci.status}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-700 text-right">{ci.impressions.toLocaleString()}</td>
                                <td className="px-4 py-2 text-sm text-gray-700 text-right">{ci.clicks.toLocaleString()}</td>
                                <td className="px-4 py-2 text-sm text-gray-700 text-right">{ci.likes.toLocaleString()}</td>
                                <td className="px-4 py-2 text-sm text-gray-700 text-right">{ci.conversions.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Overall Stats */}
          {stats && !viewCampaign && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {typeChartData.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Campaigns by Type</h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={typeChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                        {typeChartData.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Budget Overview</h4>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Total Spent</span>
                      <span>{formatCurrency(stats.totalSpent)} / {formatCurrency(stats.totalBudget)}</span>
                    </div>
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${stats.totalBudget > 0 ? Math.min((stats.totalSpent / stats.totalBudget) * 100, 100) : 0}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-lg font-bold text-gray-900">{stats.avgRoi}%</div>
                      <div className="text-xs text-gray-500">Avg ROI</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-lg font-bold text-gray-900">{stats.completed}/{stats.total}</div>
                      <div className="text-xs text-gray-500">Completed</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Campaign Detail Modal */}
      {viewCampaign && activeTab === 'campaigns' && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setViewCampaign(null)}>
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] shadow-2xl overflow-hidden flex flex-col dark:bg-gray-900 dark:border dark:border-gray-700" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: `${TYPE_COLORS[viewCampaign.type]}15`, color: TYPE_COLORS[viewCampaign.type] }}>{viewCampaign.type.replace(/_/g, ' ')}</span>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: `${STATUS_COLORS[viewCampaign.status]}15`, color: STATUS_COLORS[viewCampaign.status] }}>{viewCampaign.status}</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{viewCampaign.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{viewCampaign.artist?.stageName || viewCampaign.artist?.name || 'No artist'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openAddContent(viewCampaign._id)} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1">
                  <Plus size={12} />Add Content
                </button>
                <button onClick={() => setViewCampaign(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 dark:text-gray-500 dark:hover:bg-gray-800"><X size={18} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div><p className="text-xs text-gray-400 dark:text-gray-500">Budget</p><p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(viewCampaign.budget)}</p></div>
                <div><p className="text-xs text-gray-400 dark:text-gray-500">Spent</p><p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(viewCampaign.spent)}</p></div>
                <div><p className="text-xs text-gray-400 dark:text-gray-500">Start Date</p><p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{new Date(viewCampaign.startDate).toLocaleDateString()}</p></div>
                <div><p className="text-xs text-gray-400 dark:text-gray-500">End Date</p><p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{new Date(viewCampaign.endDate).toLocaleDateString()}</p></div>
              </div>
              {viewCampaign.targetAudience && (
                <div><p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Target Audience</p><p className="text-sm text-gray-700 dark:text-gray-200">{viewCampaign.targetAudience}</p></div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {viewCampaign.objective && <div><p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Campaign Objective</p><p className="text-sm text-gray-700 dark:text-gray-200">{viewCampaign.objective}</p></div>}
                {viewCampaign.mainStory && <div><p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Main Story</p><p className="text-sm text-gray-700 dark:text-gray-200">{viewCampaign.mainStory}</p></div>}
              </div>
              {(viewCampaign.contentThemes?.length > 0 || viewCampaign.callsToAction?.length > 0) && <div className="grid grid-cols-2 gap-4"><div><p className="text-xs text-gray-400 mb-2">Content Themes</p><div className="flex flex-wrap gap-1">{viewCampaign.contentThemes?.map(theme => <span key={theme} className="rounded-full bg-purple-50 px-2 py-1 text-[10px] text-purple-700">{theme}</span>)}</div></div><div><p className="text-xs text-gray-400 mb-2">Calls to Action</p><div className="flex flex-wrap gap-1">{viewCampaign.callsToAction?.map(action => <span key={action} className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700">{action}</span>)}</div></div></div>}
              {viewCampaign.platforms?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Platforms</p>
                  <div className="flex gap-2 flex-wrap">
                    {viewCampaign.platforms.map(p => (
                      <span key={p} className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: `${PLATFORM_COLORS[p] || '#6B7280'}20`, color: PLATFORM_COLORS[p] || '#6B7280' }}>{p}</span>
                    ))}
                  </div>
                </div>
              )}
              {viewCampaign.goals?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Goals</p>
                  <ul className="space-y-1">
                    {viewCampaign.goals.map((g, i) => <li key={i} className="text-sm text-gray-700 flex items-start gap-2"><Target size={12} className="text-indigo-500 mt-0.5 flex-shrink-0" />{g}</li>)}
                  </ul>
                </div>
              )}

              {/* Progress */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Published content progress</span><span>{viewCampaign.contentItems?.filter(item => item.status === 'published').length || 0} / {viewCampaign.contentTarget || 20} · {viewCampaign.progress || 0}%</span></div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${viewCampaign.progress || 0}%` }} />
                </div>
              </div>

              {/* Content Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Content Items ({viewCampaign.contentItems?.length || 0})</h4>
                  <button onClick={() => openAddContent(viewCampaign._id)} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"><Plus size={12} />Add</button>
                </div>
                {viewCampaign.contentItems?.length > 0 ? (
                  <div className="space-y-2">
                    {viewCampaign.contentItems.map(ci => (
                      <div key={ci._id} className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg border border-gray-100 dark:bg-gray-800/40 dark:border-gray-700">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: PLATFORM_COLORS[ci.platform] || '#6B7280' }}>
                          {ci.platform?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{ci.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {ci.platform} · {ci.contentType} · {ci.category?.replace(/_/g, ' ')}
                            {ci.scheduledDate && <> · {new Date(ci.scheduledDate).toLocaleDateString()}</>}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${ci.status === 'published' ? 'bg-green-50 text-green-700' : ci.status === 'scheduled' ? 'bg-blue-50 text-blue-700' : ci.status === 'draft' ? 'bg-gray-100 text-gray-600' : 'bg-red-50 text-red-700'}`}>
                          {ci.status}
                        </span>
                        <div className="text-xs text-gray-500 dark:text-gray-400 text-right w-24">
                          <div>{ci.impressions.toLocaleString()} imp</div>
                          <div>{ci.clicks.toLocaleString()} clicks</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditContent(ci)} className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-amber-600 dark:text-gray-500 dark:hover:bg-gray-700"><Edit3 size={12} /></button>
                          <button onClick={() => setDeleteTarget({ type: 'content', campaignId: viewCampaign._id, contentId: ci._id })} className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:bg-gray-700"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">No content items yet</p>
                )}
              </div>

              {viewCampaign.advertisingTests?.length > 0 && <div><h4 className="mb-3 text-sm font-semibold text-gray-700">Advertising Tests ({viewCampaign.advertisingTests.length})</h4><div className="space-y-2">{viewCampaign.advertisingTests.map((test, index) => <div key={test._id || index} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"><div><p className="text-xs font-semibold text-gray-900">{test.name}</p><p className="mt-1 text-[10px] text-gray-500">{test.platform} · {test.audience} · {test.creative}</p>{test.result && <p className="mt-1 text-[10px] text-gray-600">Learning: {test.result}</p>}</div><div className="text-right text-[10px] text-gray-500"><p>{test.clicks.toLocaleString()} clicks</p><p>{test.conversions.toLocaleString()} conversions</p></div><span className="rounded-full bg-white px-2 py-1 text-[9px] font-semibold uppercase text-gray-600">{test.status}</span></div>)}</div></div>}

              {viewCampaign.notes && (
                <div><p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Notes</p><p className="text-sm text-gray-700 dark:text-gray-200">{viewCampaign.notes}</p></div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Campaign Modal */}
      {(showCreateModal || editingCampaign) && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl p-6 max-h-[88vh] overflow-y-auto dark:bg-gray-900 dark:border dark:border-gray-700">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{editingCampaign ? 'Edit Campaign' : 'New Campaign'}</h3>
              <button onClick={() => { setShowCreateModal(false); setEditingCampaign(null); resetForm(); }} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 dark:text-gray-500 dark:hover:bg-gray-800"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Campaign Name</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Type</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                    {Object.keys(TYPE_COLORS).map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Artist</label>
                  <select value={form.artist} onChange={e => setForm(p => ({ ...p, artist: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                    <option value="">None</option>
                    {artists.map(a => <option key={a._id} value={a._id}>{a.stageName || a.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Status</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                    {['planned', 'active', 'paused', 'completed', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Budget ($)</label>
                  <input type="number" value={form.budget} onChange={e => setForm(p => ({ ...p, budget: Number(e.target.value) }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Start Date</label>
                  <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">End Date</label>
                  <input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Target Audience</label>
                <input value={form.targetAudience} onChange={e => setForm(p => ({ ...p, targetAudience: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" placeholder="e.g. 18-24 hip-hop fans" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Campaign Objective</label>
                <textarea value={form.objective} onChange={e => setForm(p => ({ ...p, objective: e.target.value }))} rows={2} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" placeholder="The specific outcome this campaign should achieve" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Main Story</label>
                <textarea value={form.mainStory} onChange={e => setForm(p => ({ ...p, mainStory: e.target.value }))} rows={2} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" placeholder="The central narrative fans should remember" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Content Themes (one per line)</label><textarea value={form.contentThemes} onChange={e => setForm(p => ({ ...p, contentThemes: e.target.value }))} rows={3} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /></div>
                <div><label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Calls to Action (one per line)</label><textarea value={form.callsToAction} onChange={e => setForm(p => ({ ...p, callsToAction: e.target.value }))} rows={3} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Release Date</label><input type="date" value={form.releaseDate} onChange={e => setForm(p => ({ ...p, releaseDate: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /></div>
                <div><label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Content Target</label><input type="number" min="20" max="100" value={form.contentTarget} onChange={e => setForm(p => ({ ...p, contentTarget: Number(e.target.value) }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /><p className="mt-1 text-[10px] text-gray-400">Priority releases should target 20–30 pieces.</p></div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-2 block">Content Categories</label>
                <div className="flex flex-wrap gap-2">{['performance','lifestyle','behind_the_scenes','storytelling','educational','fan_interaction','promotional','personal_connection'].map(category => <button key={category} type="button" onClick={() => setForm(previous => ({ ...previous, contentCategories: previous.contentCategories.includes(category) ? previous.contentCategories.filter(item => item !== category) : [...previous.contentCategories, category] }))} className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${form.contentCategories.includes(category) ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-gray-200 text-gray-600 dark:border-gray-600 dark:text-gray-300'}`}>{category.replace(/_/g, ' ')}</button>)}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-2 block">Platforms</label>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(PLATFORM_COLORS).map(p => (
                    <button key={p} type="button" onClick={() => togglePlatform(p)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-all ${form.platforms.includes(p) ? 'text-white' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:border-gray-500'}`}
                      style={form.platforms.includes(p) ? { background: PLATFORM_COLORS[p], borderColor: PLATFORM_COLORS[p] } : {}}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Goals (one per line)</label>
                <textarea value={form.goals} onChange={e => setForm(p => ({ ...p, goals: e.target.value }))} rows={3} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" placeholder="Reach 10k followers&#10;Generate 500 leads&#10;Get 100k impressions" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Amount Spent ($)</label><input type="number" min="0" value={form.spent} onChange={e => setForm(p => ({ ...p, spent: Number(e.target.value) }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /></div>
                <div><label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Attributed Revenue ($)</label><input type="number" min="0" value={form.attributedRevenue} onChange={e => setForm(p => ({ ...p, attributedRevenue: Number(e.target.value) }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /></div>
              </div>
              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <div className="mb-3 flex items-center justify-between"><div><h4 className="text-sm font-semibold text-gray-900">Advertising Tests</h4><p className="text-[10px] text-gray-500">Compare audiences, creatives, spend, and results.</p></div><button type="button" onClick={() => setForm(p => ({ ...p, advertisingTests: [...p.advertisingTests, { name: '', platform: '', audience: '', creative: '', callToAction: '', budget: 0, spent: 0, impressions: 0, clicks: 0, conversions: 0, status: 'planned', result: '' }] }))} className="text-xs font-semibold text-indigo-600">+ Add test</button></div>
                <div className="space-y-3">{form.advertisingTests.map((test, index) => <div key={index} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/40"><div className="grid grid-cols-3 gap-2"><input placeholder="Test name" value={test.name} onChange={e => setForm(p => ({ ...p, advertisingTests: p.advertisingTests.map((item, i) => i === index ? { ...item, name: e.target.value } : item) }))} className="px-2 py-1.5 border border-gray-300 rounded-md text-xs dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /><input placeholder="Platform" value={test.platform} onChange={e => setForm(p => ({ ...p, advertisingTests: p.advertisingTests.map((item, i) => i === index ? { ...item, platform: e.target.value } : item) }))} className="px-2 py-1.5 border border-gray-300 rounded-md text-xs dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /><input placeholder="Audience" value={test.audience} onChange={e => setForm(p => ({ ...p, advertisingTests: p.advertisingTests.map((item, i) => i === index ? { ...item, audience: e.target.value } : item) }))} className="px-2 py-1.5 border border-gray-300 rounded-md text-xs dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /><input placeholder="Creative variation" value={test.creative} onChange={e => setForm(p => ({ ...p, advertisingTests: p.advertisingTests.map((item, i) => i === index ? { ...item, creative: e.target.value } : item) }))} className="px-2 py-1.5 border border-gray-300 rounded-md text-xs dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /><input type="number" min="0" placeholder="Budget" value={test.budget} onChange={e => setForm(p => ({ ...p, advertisingTests: p.advertisingTests.map((item, i) => i === index ? { ...item, budget: Number(e.target.value) } : item) }))} className="px-2 py-1.5 border border-gray-300 rounded-md text-xs dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /><div className="flex gap-1"><select value={test.status} onChange={e => setForm(p => ({ ...p, advertisingTests: p.advertisingTests.map((item, i) => i === index ? { ...item, status: e.target.value } : item) }))} className="min-w-0 flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-xs"><option value="planned">Planned</option><option value="running">Running</option><option value="completed">Completed</option><option value="stopped">Stopped</option></select><button type="button" onClick={() => setForm(p => ({ ...p, advertisingTests: p.advertisingTests.filter((_, i) => i !== index) }))} className="px-2 text-red-500"><Trash2 size={13}/></button></div></div></div>)}</div>
              </div>
              {form.advertisingTests.length > 0 && <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700"><h4 className="mb-3 text-sm font-semibold text-gray-900">Advertising Test Results</h4><div className="space-y-3">{form.advertisingTests.map((test, index) => <div key={index} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/40"><p className="mb-2 text-xs font-semibold text-gray-700">{test.name || `Test ${index + 1}`}</p><div className="grid grid-cols-3 gap-2"><input placeholder="Call to action" value={test.callToAction} onChange={e => setForm(p => ({ ...p, advertisingTests: p.advertisingTests.map((item, i) => i === index ? { ...item, callToAction: e.target.value } : item) }))} className="rounded-md border border-gray-300 px-2 py-1.5 text-xs dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /><input type="number" min="0" placeholder="Spent" value={test.spent} onChange={e => setForm(p => ({ ...p, advertisingTests: p.advertisingTests.map((item, i) => i === index ? { ...item, spent: Number(e.target.value) } : item) }))} className="rounded-md border border-gray-300 px-2 py-1.5 text-xs dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /><input placeholder="Result / learning" value={test.result} onChange={e => setForm(p => ({ ...p, advertisingTests: p.advertisingTests.map((item, i) => i === index ? { ...item, result: e.target.value } : item) }))} className="rounded-md border border-gray-300 px-2 py-1.5 text-xs dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /><input type="number" min="0" placeholder="Impressions" value={test.impressions} onChange={e => setForm(p => ({ ...p, advertisingTests: p.advertisingTests.map((item, i) => i === index ? { ...item, impressions: Number(e.target.value) } : item) }))} className="rounded-md border border-gray-300 px-2 py-1.5 text-xs dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /><input type="number" min="0" placeholder="Clicks" value={test.clicks} onChange={e => setForm(p => ({ ...p, advertisingTests: p.advertisingTests.map((item, i) => i === index ? { ...item, clicks: Number(e.target.value) } : item) }))} className="rounded-md border border-gray-300 px-2 py-1.5 text-xs dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /><input type="number" min="0" placeholder="Conversions" value={test.conversions} onChange={e => setForm(p => ({ ...p, advertisingTests: p.advertisingTests.map((item, i) => i === index ? { ...item, conversions: Number(e.target.value) } : item) }))} className="rounded-md border border-gray-300 px-2 py-1.5 text-xs dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /></div></div>)}</div></div>}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => { setShowCreateModal(false); setEditingCampaign(null); resetForm(); }} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={editingCampaign ? handleUpdate : handleCreate} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">
                {editingCampaign ? 'Update Campaign' : 'Create Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Content Item Modal */}
      {showContentModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 dark:bg-gray-900 dark:border dark:border-gray-700">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{editingContent ? 'Edit Content' : 'Add Content Item'}</h3>
              <button onClick={() => { setShowContentModal(null); setEditingContent(null); resetContentForm(); }} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 dark:text-gray-500 dark:hover:bg-gray-800"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Title</label>
                <input value={contentForm.title} onChange={e => setContentForm(p => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Platform</label>
                  <select value={contentForm.platform} onChange={e => setContentForm(p => ({ ...p, platform: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                    {Object.keys(PLATFORM_COLORS).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Content Type</label>
                  <select value={contentForm.contentType} onChange={e => setContentForm(p => ({ ...p, contentType: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                    {['post', 'story', 'reel', 'video', 'email', 'ad', 'article', 'interview', 'playlist', 'other'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Content Category</label>
                <select value={contentForm.category} onChange={e => setContentForm(p => ({ ...p, category: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                  {['performance','lifestyle','behind_the_scenes','storytelling','educational','fan_interaction','promotional','personal_connection'].map(category => <option key={category} value={category}>{category.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Scheduled Date</label>
                  <input type="date" value={contentForm.scheduledDate} onChange={e => setContentForm(p => ({ ...p, scheduledDate: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Status</label>
                  <select value={contentForm.status} onChange={e => setContentForm(p => ({ ...p, status: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                    {['draft', 'scheduled', 'published', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Caption</label>
                <textarea value={contentForm.caption} onChange={e => setContentForm(p => ({ ...p, caption: e.target.value }))} rows={2} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Media URL</label>
                <input value={contentForm.mediaUrl} onChange={e => setContentForm(p => ({ ...p, mediaUrl: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" placeholder="https://..." />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Link</label>
                <input value={contentForm.link} onChange={e => setContentForm(p => ({ ...p, link: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" placeholder="https://..." />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-2 block">Published Results</label>
                <div className="grid grid-cols-3 gap-2">{(['impressions','clicks','likes','shares','comments','conversions'] as const).map(metric => <div key={metric}><label className="mb-1 block text-[9px] uppercase text-gray-400">{metric}</label><input type="number" min="0" value={contentForm[metric]} onChange={e => setContentForm(p => ({ ...p, [metric]: Number(e.target.value) }))} className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /></div>)}</div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => { setShowContentModal(null); setEditingContent(null); resetContentForm(); }} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={editingContent ? handleUpdateContent : handleAddContent} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">
                {editingContent ? 'Update Content' : 'Add Content'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={deleteTarget?.type === 'content' ? 'Delete Content Item' : 'Delete Campaign'}
        message={deleteTarget?.type === 'content'
          ? 'Are you sure you want to delete this content item? This action cannot be undone.'
          : 'Are you sure you want to delete this campaign? This action cannot be undone.'}
        confirmLabel="Delete"
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.type === 'content') {
            handleDeleteContent(deleteTarget.campaignId, deleteTarget.contentId!);
          } else {
            handleDelete(deleteTarget.campaignId);
          }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default CampaignManager;
