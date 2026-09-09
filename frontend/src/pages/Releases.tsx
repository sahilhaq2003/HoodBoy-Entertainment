import React, { useState, useEffect } from 'react';
import {
  Radio, Plus, Calendar, CheckCircle, Clock, AlertTriangle, ChevronRight,
  ChevronDown, X, Search, RefreshCw, Users, Music, ArrowRight, Target,
} from 'lucide-react';
import { releasesApi, artistsApi, songsApi } from '../services/api';
import type { Release, ReleaseDashboardData, Artist, Song } from '../types';
import toast from 'react-hot-toast';

const getApiError = (error: unknown, fallback: string) => {
  const response = (error as { response?: { data?: { message?: string; errors?: string[] } } })?.response?.data;
  return response?.errors?.[0] || response?.message || fallback;
};

const PHASES = ['preparation', 'distribution', 'marketing', 'post_release'] as const;
const PHASE_LABELS: Record<string, string> = { preparation: 'Preparation', distribution: 'Distribution', marketing: 'Marketing', post_release: 'Post-Release', completed: 'Completed' };
const PHASE_COLORS: Record<string, string> = { preparation: '#F59E0B', distribution: '#06B6D4', marketing: '#8B5CF6', post_release: '#10B981' };
const STATUS_COLORS: Record<string, string> = {
  scheduled: '#F59E0B', in_preparation: '#06B6D4', submitted: '#8B5CF6',
  approved: '#10B981', released: '#10B981', delayed: '#EF4444', cancelled: '#9CA3AF',
};
const TYPE_COLORS: Record<string, string> = { album: '#8B5CF6', ep: '#06B6D4', single: '#F59E0B', mixtape: '#EC4899', compilation: '#6366F1' };

const Releases: React.FC = () => {
  const [releases, setReleases] = useState<Release[]>([]);
  const [dashboard, setDashboard] = useState<ReleaseDashboardData | null>(null);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('');
  const [viewDetail, setViewDetail] = useState<Release | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingTarget, setEditingTarget] = useState<Release | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'dashboard'>('timeline');

  const [form, setForm] = useState({
    title: '', artist: '', type: 'single', releaseDate: '',
    marketingBudget: 0, genre: '', explicit: false, priority: 'medium' as Release['priority'], notes: '',
    songs: [] as string[],
    language: 'English', upc: '', preSaveLink: '', pressReleaseUrl: '', coverArt: '',
    platforms: [] as Array<{ name: string; status: 'pending' | 'submitted' | 'live' | 'rejected'; link: string }>,
  });

  const daysUntil = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (phaseFilter) params.phase = phaseFilter;
      const [relRes, dashRes, artRes, songRes] = await Promise.all([
        releasesApi.getAll(params), releasesApi.getDashboard(), artistsApi.getAll(), songsApi.getAll(),
      ]);
      setReleases(relRes.data.data);
      setDashboard(dashRes.data.data);
      setArtists(artRes.data.data);
      setSongs(songRes.data.data);
    } catch { toast.error('Failed to load releases'); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [statusFilter, phaseFilter]);

  const resetForm = () => {
    setForm({ title: '', artist: '', type: 'single', releaseDate: '', marketingBudget: 0, genre: '', explicit: false, priority: 'medium', notes: '', songs: [], language: 'English', upc: '', preSaveLink: '', pressReleaseUrl: '', coverArt: '', platforms: [] });
    setEditingTarget(null);
  };

  const handleSave = async () => {
    if (!form.title || !form.artist || !form.releaseDate) return toast.error('Title, artist and date required');
    if (form.songs.length === 0) return toast.error('Select at least one song for the release');
    try {
      if (editingTarget) await releasesApi.update(editingTarget._id, form);
      else await releasesApi.create(form);
      toast.success(editingTarget ? 'Release updated' : 'Release created');
      setShowCreate(false);
      resetForm();
      loadData();
    } catch (error) { toast.error(getApiError(error, 'Failed to save release')); }
  };

  const openCreate = () => { resetForm(); setShowCreate(true); };
  const openEdit = (release: Release) => {
    setEditingTarget(release);
    setForm({
      title: release.title, artist: release.artist._id, type: release.type, releaseDate: release.releaseDate.slice(0, 10),
      marketingBudget: release.marketingBudget || 0, genre: release.genre || '', explicit: !!release.explicit, priority: release.priority, notes: release.notes || '',
      songs: release.songs?.map(song => song._id) || [], language: release.language || 'English', upc: release.upc || '', preSaveLink: release.preSaveLink || '', pressReleaseUrl: release.pressReleaseUrl || '', coverArt: release.coverArt || '',
      platforms: (release.platforms || []).map(platform => ({ name: platform.name, status: platform.status as 'pending' | 'submitted' | 'live' | 'rejected', link: platform.link || '' })),
    });
    setViewDetail(null);
    setShowCreate(true);
  };

  const handleAdvancePhase = async (id: string) => {
    try {
      await releasesApi.advancePhase(id);
      toast.success('Phase advanced');
      loadData();
      if (viewDetail?._id === id) { const res = await releasesApi.getById(id); setViewDetail(res.data.data); }
    } catch (error) { toast.error(getApiError(error, 'Cannot advance — complete current phase checklist first')); }
  };

  const handleChecklistToggle = async (releaseId: string, phase: string, itemId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      await releasesApi.updateChecklistItem(releaseId, phase, itemId, { status: newStatus });
      if (viewDetail?._id === releaseId) { const res = await releasesApi.getById(releaseId); setViewDetail(res.data.data); }
      loadData();
    } catch (error) { toast.error(getApiError(error, 'Failed to update')); }
  };

  const handleChecklistUpdate = async (releaseId: string, phase: string, itemId: string, updates: object) => {
    try {
      await releasesApi.updateChecklistItem(releaseId, phase, itemId, updates);
      const res = await releasesApi.getById(releaseId);
      setViewDetail(res.data.data);
      loadData();
    } catch (error) { toast.error(getApiError(error, 'Failed to update checklist item')); }
  };

  const availableSongs = songs.filter(song => !form.artist || song.artist?._id === form.artist);

  const getPhaseCompletion = (release: Release, phase: string) => {
    const p = release.phases?.[phase as keyof typeof release.phases];
    if (!p || !p.checklist || p.checklist.length === 0) return 0;
    return Math.round((p.checklist.filter(i => i.status === 'completed').length / p.checklist.length) * 100);
  };

  const getOverallProgress = (release: Release) => {
    const phases = PHASES;
    const completedPhases = phases.filter(p => release.phases?.[p as keyof typeof release.phases]?.completed).length;
    const currentPhaseIdx = phases.indexOf(release.currentPhase as typeof PHASES[number]);
    const currentProgress = getPhaseCompletion(release, release.currentPhase) / 100;
    return Math.round(((completedPhases + currentProgress) / phases.length) * 100);
  };

  if (loading) return <div className="flex justify-center py-20"><RefreshCw size={24} className="text-indigo-500 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Radio size={28} className="text-indigo-600" />
            Releases
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage the full release lifecycle</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center gap-2">
          <Plus size={15} /> Schedule Release
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => setActiveTab('timeline')} className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'timeline' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}>Timeline</button>
        <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'dashboard' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}>Dashboard</button>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && dashboard && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Releases', value: dashboard.total, color: '#8B5CF6' },
              { label: 'In Preparation', value: dashboard.byPhase['preparation'] || 0, color: '#F59E0B' },
              { label: 'Distributing', value: dashboard.byPhase['distribution'] || 0, color: '#06B6D4' },
              { label: 'Marketing', value: dashboard.byPhase['marketing'] || 0, color: '#8B5CF6' },
            ].map((s, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
          {dashboard.byType.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">By Type</h3>
              <div className="flex gap-4">
                {dashboard.byType.map(t => (
                  <div key={t._id} className="text-center">
                    <div className="text-xl font-bold" style={{ color: TYPE_COLORS[t._id] || '#6B7280' }}>{t.count}</div>
                    <div className="text-xs text-gray-500 capitalize">{t._id}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {dashboard.upcoming.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Upcoming Releases</h3>
              <div className="space-y-2">
                {dashboard.upcoming.map(r => (
                  <div key={r._id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.title}</p>
                      <p className="text-xs text-gray-500">{r.artist?.stageName || r.artist?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-indigo-600">{new Date(r.releaseDate).toLocaleDateString()}</p>
                      <p className="text-xs text-gray-400">{daysUntil(r.releaseDate)} days</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timeline Tab */}
      {activeTab === 'timeline' && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm">
              <option value="">All Status</option>
              {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
            <select value={phaseFilter} onChange={e => setPhaseFilter(e.target.value)} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm">
              <option value="">All Phases</option>
              {PHASES.map(p => <option key={p} value={p}>{PHASE_LABELS[p]}</option>)}
            </select>
          </div>

          <div className="space-y-4">
            {releases.map(r => {
              const days = daysUntil(r.releaseDate);
              const progress = getOverallProgress(r);
              const typeColor = TYPE_COLORS[r.type] || '#6B7280';
              return (
                <div key={r._id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-all">
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ background: `linear-gradient(135deg, ${typeColor}, ${typeColor}99)` }}>
                          {r.type === 'single' ? '🎵' : r.type === 'album' ? '💿' : r.type === 'ep' ? '📀' : '🎶'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: `${typeColor}15`, color: typeColor }}>{r.type}</span>
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: `${STATUS_COLORS[r.status]}15`, color: STATUS_COLORS[r.status] }}>{r.status.replace(/_/g, ' ')}</span>
                          </div>
                          <h3 className="text-sm font-bold text-gray-900 mt-0.5">{r.title}</h3>
                          <p className="text-xs text-gray-500">{r.artist?.stageName || r.artist?.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-xs text-gray-500"><Calendar size={11} />{new Date(r.releaseDate).toLocaleDateString()}</div>
                        <div className={`text-sm font-bold mt-0.5 ${days <= 7 ? 'text-red-600' : days <= 30 ? 'text-amber-600' : 'text-gray-500'}`}>
                          {r.status === 'released' ? 'Live' : days <= 0 ? 'Overdue' : `${days}d`}
                        </div>
                      </div>
                    </div>

                    {/* Phase Progress Bar */}
                    <div className="flex gap-1 mb-3">
                      {PHASES.map(p => {
                        const pColor = PHASE_COLORS[p];
                        const pCompletion = getPhaseCompletion(r, p);
                        const isCurrent = r.currentPhase === p;
                        const isDone = r.phases?.[p as keyof typeof r.phases]?.completed;
                        return (
                          <div key={p} className="flex-1 group" title={`${PHASE_LABELS[p]}: ${pCompletion}%`}>
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: `${pColor}20` }}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${isDone ? 100 : isCurrent ? pCompletion : isDone ? 100 : 0}%`, background: pColor }} />
                            </div>
                            <p className="text-[10px] text-center mt-1" style={{ color: isCurrent ? pColor : '#9CA3AF' }}>{PHASE_LABELS[p].slice(0, 4)}</p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">Overall: <span className="font-bold" style={{ color: progress === 100 ? '#10B981' : '#6366F1' }}>{progress}%</span></div>
                      <button onClick={() => setViewDetail(r)} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                        View Details <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {releases.length === 0 && (
              <div className="text-center py-16 text-gray-500">
                <Radio size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm">No releases found</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Release Detail Modal */}
      {viewDetail && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setViewDetail(null)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: `${TYPE_COLORS[viewDetail.type]}15`, color: TYPE_COLORS[viewDetail.type] }}>{viewDetail.type}</span>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: `${STATUS_COLORS[viewDetail.status]}15`, color: STATUS_COLORS[viewDetail.status] }}>{viewDetail.status.replace(/_/g, ' ')}</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mt-1">{viewDetail.title}</h3>
                <p className="text-sm text-gray-500">{viewDetail.artist?.stageName || viewDetail.artist?.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(viewDetail)} className="px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50">Edit</button>
                {viewDetail.currentPhase !== 'completed' && <button onClick={() => handleAdvancePhase(viewDetail._id)} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1">Advance Phase <ArrowRight size={12} /></button>}
                <button onClick={() => setViewDetail(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Phase Timeline */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Release Phases</h4>
                <div className="flex gap-3">
                  {PHASES.map((p, idx) => {
                    const pColor = PHASE_COLORS[p];
                    const pCompletion = getPhaseCompletion(viewDetail, p);
                    const isCurrent = viewDetail.currentPhase === p;
                    const isDone = viewDetail.phases?.[p as keyof typeof viewDetail.phases]?.completed;
                    return (
                      <div key={p} className={`flex-1 rounded-xl p-3 border-2 transition-all ${isCurrent ? 'border-indigo-300 bg-indigo-50/50' : isDone ? 'border-green-200 bg-green-50/50' : 'border-gray-100 bg-gray-50'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: isDone ? '#10B981' : isCurrent ? pColor : '#D1D5DB' }}>
                            {isDone ? '✓' : idx + 1}
                          </div>
                          <span className="text-xs font-semibold" style={{ color: isCurrent ? pColor : '#6B7280' }}>{PHASE_LABELS[p]}</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${isDone ? 100 : pCompletion}%`, background: isDone ? '#10B981' : pColor }} />
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1">{isDone ? 'Complete' : `${pCompletion}% done`}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Current Phase Checklist */}
              {viewDetail.phases?.[viewDetail.currentPhase as keyof typeof viewDetail.phases] && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">
                    {PHASE_LABELS[viewDetail.currentPhase]} Checklist
                  </h4>
                  <div className="space-y-1.5">
                    {viewDetail.phases[viewDetail.currentPhase as keyof typeof viewDetail.phases].checklist.map(item => (
                      <div key={item._id} className={`grid grid-cols-[auto_1fr_120px] gap-3 px-4 py-3 rounded-lg border ${item.status === 'completed' ? 'bg-green-50 border-green-200' : item.status === 'blocked' ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100 hover:bg-gray-50'}`}>
                        <button
                          onClick={() => handleChecklistToggle(viewDetail._id, viewDetail.currentPhase, item._id, item.status)}
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${item.status === 'completed' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-indigo-400'}`}
                        >
                          {item.status === 'completed' && <CheckCircle size={12} />}
                        </button>
                        <div className="min-w-0">
                          <span className={`text-sm ${item.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{item.item}</span>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <input type="date" defaultValue={item.dueDate?.slice(0, 10) || ''} onBlur={e => handleChecklistUpdate(viewDetail._id, viewDetail.currentPhase, item._id, { dueDate: e.target.value })} aria-label={`${item.item} due date`} className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px]" />
                            <input defaultValue={item.notes || ''} onBlur={e => { if (e.target.value !== (item.notes || '')) handleChecklistUpdate(viewDetail._id, viewDetail.currentPhase, item._id, { notes: e.target.value }); }} placeholder="Notes or deliverable link" className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px]" />
                          </div>
                        </div>
                        <select value={item.status} onChange={e => handleChecklistUpdate(viewDetail._id, viewDetail.currentPhase, item._id, { status: e.target.value })} className="self-start rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[10px] font-semibold uppercase">
                          <option value="pending">Pending</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="completed">Completed</option><option value="skipped">Skipped</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  ['Release Date', new Date(viewDetail.releaseDate).toLocaleDateString()],
                  ['Current Phase', PHASE_LABELS[viewDetail.currentPhase] || viewDetail.currentPhase],
                  ['Priority', viewDetail.priority],
                  ['Marketing Budget', `$${(viewDetail.marketingBudget || 0).toLocaleString()}`],
                  ['Genre', viewDetail.genre || '—'],
                  ['UPC', viewDetail.upc || '—'],
                ].map(([l, v]) => (
                  <div key={l}><p className="text-xs text-gray-400">{l}</p><p className="text-sm font-medium text-gray-900 capitalize">{v}</p></div>
                ))}
              </div>

              {viewDetail.songs && viewDetail.songs.length > 0 && <div><h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Release Songs</h4><div className="flex flex-wrap gap-2">{viewDetail.songs.map(song => <span key={song._id} className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700"><Music size={11} className="mr-1.5 inline" />{song.title}</span>)}</div></div>}

              {(viewDetail.preSaveLink || viewDetail.pressReleaseUrl || viewDetail.coverArt) && <div><h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Release Assets</h4><div className="flex flex-wrap gap-2">{viewDetail.preSaveLink && <a href={viewDetail.preSaveLink} target="_blank" rel="noreferrer" className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-indigo-600">Pre-save page</a>}{viewDetail.pressReleaseUrl && <a href={viewDetail.pressReleaseUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-indigo-600">Press materials</a>}{viewDetail.coverArt && <a href={viewDetail.coverArt} target="_blank" rel="noreferrer" className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-indigo-600">Cover artwork</a>}</div></div>}

              {/* Platforms */}
              {viewDetail.platforms && viewDetail.platforms.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Platforms</h4>
                  <div className="flex gap-2 flex-wrap">
                    {viewDetail.platforms.map((p, i) => (
                      <a key={i} href={p.link || undefined} target={p.link ? '_blank' : undefined} rel="noreferrer" className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{ background: p.status === 'live' ? '#ECFDF5' : '#F9FAFB', color: p.status === 'live' ? '#059669' : '#6B7280', border: `1px solid ${p.status === 'live' ? '#A7F3D0' : '#E5E7EB'}` }}>
                        {p.status === 'live' ? <CheckCircle size={10} /> : <Clock size={10} />}
                        {p.name} · {p.status}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">{editingTarget ? 'Edit Release' : 'Schedule New Release'}</h3>
              <button onClick={() => { setShowCreate(false); resetForm(); }} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Title</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Artist</label>
                  <select value={form.artist} onChange={e => setForm(p => ({ ...p, artist: e.target.value, songs: [] }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm">
                    <option value="">Select artist...</option>
                    {artists.map(a => <option key={a._id} value={a._id}>{a.stageName || a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Type</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as any }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm">
                    {['single', 'ep', 'album', 'mixtape', 'compilation'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Marketing Budget</label>
                  <input type="number" min="0" value={form.marketingBudget} onChange={e => setForm(p => ({ ...p, marketingBudget: +e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Genre</label>
                  <input value={form.genre} onChange={e => setForm(p => ({ ...p, genre: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Language</label>
                  <input value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-600"><input type="checkbox" checked={form.explicit} onChange={e => setForm(p => ({ ...p, explicit: e.target.checked }))} className="h-4 w-4 rounded" />Explicit release</label>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Songs</label>
                <div className="max-h-36 overflow-y-auto rounded-lg border border-gray-200 p-2">
                  {!form.artist ? <p className="p-2 text-xs text-gray-400">Select an artist first</p> : availableSongs.length === 0 ? <p className="p-2 text-xs text-gray-400">No songs found for this artist</p> : availableSongs.map(song => <label key={song._id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50"><input type="checkbox" checked={form.songs.includes(song._id)} onChange={e => setForm(p => ({ ...p, songs: e.target.checked ? [...p.songs, song._id] : p.songs.filter(id => id !== song._id) }))} className="h-4 w-4 rounded" /><span className="flex-1 text-gray-700">{song.title}</span><span className="text-[10px] uppercase text-gray-400">{song.status.replace(/_/g, ' ')}</span></label>)}
                </div>
                <p className="mt-1 text-[10px] text-gray-400">At least one song is required before ownership can be confirmed.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-600 mb-1 block">UPC</label><input value={form.upc} onChange={e => setForm(p => ({ ...p, upc: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" /></div>
                <div><label className="text-xs font-semibold text-gray-600 mb-1 block">Cover Artwork URL</label><input type="url" value={form.coverArt} onChange={e => setForm(p => ({ ...p, coverArt: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" /></div>
                <div><label className="text-xs font-semibold text-gray-600 mb-1 block">Pre-save Page</label><input type="url" value={form.preSaveLink} onChange={e => setForm(p => ({ ...p, preSaveLink: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" /></div>
                <div><label className="text-xs font-semibold text-gray-600 mb-1 block">Press Materials URL</label><input type="url" value={form.pressReleaseUrl} onChange={e => setForm(p => ({ ...p, pressReleaseUrl: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" /></div>
              </div>
              <div className="rounded-xl border border-gray-200 p-4">
                <div className="mb-3 flex items-center justify-between"><div><h4 className="text-sm font-semibold text-gray-900">Distribution platforms</h4><p className="text-[10px] text-gray-500">Track delivery and live-store links.</p></div><button type="button" onClick={() => setForm(p => ({ ...p, platforms: [...p.platforms, { name: '', status: 'pending', link: '' }] }))} className="text-xs font-semibold text-indigo-600">+ Add platform</button></div>
                {form.platforms.length === 0 ? <p className="py-2 text-center text-xs text-gray-400">No platforms added yet</p> : <div className="space-y-2">{form.platforms.map((platform, index) => <div key={index} className="grid grid-cols-[1fr_130px_1.4fr_auto] gap-2"><input placeholder="Platform" value={platform.name} onChange={e => setForm(p => ({ ...p, platforms: p.platforms.map((item, i) => i === index ? { ...item, name: e.target.value } : item) }))} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" /><select value={platform.status} onChange={e => setForm(p => ({ ...p, platforms: p.platforms.map((item, i) => i === index ? { ...item, status: e.target.value as any } : item) }))} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"><option value="pending">Pending</option><option value="submitted">Submitted</option><option value="live">Live</option><option value="rejected">Rejected</option></select><input type="url" placeholder="Store link" value={platform.link} onChange={e => setForm(p => ({ ...p, platforms: p.platforms.map((item, i) => i === index ? { ...item, link: e.target.value } : item) }))} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" /><button type="button" onClick={() => setForm(p => ({ ...p, platforms: p.platforms.filter((_, i) => i !== index) }))} className="p-2 text-gray-400 hover:text-red-500"><X size={14} /></button></div>)}</div>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Release Date</label>
                  <input type="date" value={form.releaseDate} onChange={e => setForm(p => ({ ...p, releaseDate: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Priority</label>
                  <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as any }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm">
                    {['low', 'medium', 'high', 'critical'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
              <button onClick={() => { setShowCreate(false); resetForm(); }} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">{editingTarget ? 'Save Changes' : 'Create Release'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Releases;
