import React, { useState, useEffect } from 'react';
import {
  Radio, Plus, Calendar, CheckCircle, Clock, AlertTriangle,
  ChevronDown, X, Search, RefreshCw, Users, Music, ArrowRight, Target,
  Pencil,
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
const PRIORITY_COLORS: Record<string, string> = { high: '#EF4444', medium: '#F59E0B', low: '#10B981' };

const Releases: React.FC = () => {
  const [releases, setReleases] = useState<Release[]>([]);
  const [dashboard, setDashboard] = useState<ReleaseDashboardData | null>(null);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
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

  const filteredReleases = releases.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return [
      r.title,
      r.artist?.stageName,
      r.artist?.name,
      r.genre,
      r.type,
      r.upc,
    ].some(v => v && v.toLowerCase().includes(q));
  });

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
    const artistId = typeof release.artist === 'string' ? release.artist : release.artist?._id;
    setEditingTarget(release);
    setForm({
      title: release.title, artist: artistId || '', type: release.type, releaseDate: release.releaseDate?.slice(0, 10) || '',
      marketingBudget: release.marketingBudget || 0, genre: release.genre || '', explicit: !!release.explicit, priority: release.priority, notes: release.notes || '',
      songs: release.songs?.map(song => typeof song === 'string' ? song : song._id).filter(Boolean) || [], language: release.language || 'English', upc: release.upc || '', preSaveLink: release.preSaveLink || '', pressReleaseUrl: release.pressReleaseUrl || '', coverArt: release.coverArt || '',
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <Radio size={28} className="text-indigo-600" />
            Releases
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage the full release lifecycle</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center gap-2">
          <Plus size={15} /> Schedule Release
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        <button onClick={() => setActiveTab('timeline')} className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'timeline' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}>Timeline</button>
        <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'dashboard' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}>Dashboard</button>
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
              <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
          {dashboard.byType.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">By Type</h3>
              <div className="flex gap-4">
                {dashboard.byType.map(t => (
                  <div key={t._id} className="text-center">
                    <div className="text-xl font-bold" style={{ color: TYPE_COLORS[t._id] || '#6B7280' }}>{t.count}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{t._id}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {dashboard.upcoming.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Upcoming Releases</h3>
              <div className="space-y-2">
                {dashboard.upcoming.map(r => (
                  <div key={r._id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/40">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{r.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{r.artist?.stageName || r.artist?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-indigo-600">{new Date(r.releaseDate).toLocaleDateString()}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{daysUntil(r.releaseDate)} days</p>
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
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search releases..."
                className="w-56 pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-lg text-sm">
              <option value="">All Status</option>
              {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
            <select value={phaseFilter} onChange={e => setPhaseFilter(e.target.value)} className="px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-lg text-sm">
              <option value="">All Phases</option>
              {PHASES.map(p => <option key={p} value={p}>{PHASE_LABELS[p]}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredReleases.map(r => {
              const days = daysUntil(r.releaseDate);
              const progress = getOverallProgress(r);
              const typeColor = TYPE_COLORS[r.type] || '#6B7280';
              const priorityColor = PRIORITY_COLORS[r.priority] || '#6B7280';
              const donePhases = PHASES.filter(p => r.phases?.[p]?.completed).length;
              const platforms = r.platforms || [];
              const livePlatforms = platforms.filter(p => p.status === 'live').length;
              const trackCount = r.songs?.length || 0;
              const genre = r.genre || '';
              return (
                <div key={r._id} className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-indigo-900/10 hover:-translate-y-0.5 hover:border-indigo-200 dark:hover:border-indigo-500/40 transition-all duration-300">
                  {/* Cover banner */}
                  <div className="relative h-20 w-full" style={{ background: `linear-gradient(135deg, ${typeColor}, ${typeColor} 45%, ${typeColor}88)` }}>
                    <div className="absolute -top-10 -right-6 w-32 h-32 rounded-full border border-white/20" />
                    <div className="absolute top-3 right-14 w-16 h-16 rounded-full border border-white/10" />
                    <div className="absolute -bottom-10 -left-4 w-28 h-28 rounded-full border border-white/10" />
                    <div className="absolute inset-0 flex items-start justify-between p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-white/20 backdrop-blur text-white">{r.type}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-black/30 backdrop-blur text-white/90">{r.status.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-white bg-black/25 backdrop-blur px-1.5 py-0.5 rounded-md">
                        <Calendar size={10} />
                        {new Date(r.releaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <div className="absolute -bottom-5 left-4 w-10 h-10 rounded-lg bg-white shadow-md ring-1 ring-black/5 flex items-center justify-center">
                      <span className="text-[9px] font-black uppercase tracking-wide" style={{ color: typeColor }}>{r.type === 'compilation' ? 'COMP' : r.type.toUpperCase().slice(0, 3)}</span>
                    </div>
                  </div>

                  <div className="pt-7 px-5 pb-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-snug truncate group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">{r.title}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
                          <Users size={11} className="text-gray-400 dark:text-gray-500 shrink-0" />
                          <span className="truncate">{r.artist?.stageName || r.artist?.name}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => openEdit(r)}
                          title="Edit release"
                          className="p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setViewDetail(r)}
                          title="View details"
                          className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-indigo-600 transition-colors"
                        >
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mb-3">
                      {genre && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{genre}</span>}
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize flex items-center gap-1" style={{ background: `${priorityColor}1a`, color: priorityColor }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: priorityColor }} />
                        {r.priority}
                      </span>
                      {platforms.length > 0 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          {livePlatforms > 0 ? `${livePlatforms}/${platforms.length} live` : `${platforms.length} platforms`}
                        </span>
                      )}
                    </div>

                    {/* Phase pipeline stepper */}
                    <div className="mb-4">
                      <div className="flex items-center">
                        {PHASES.map((p, i) => {
                          const pColor = PHASE_COLORS[p];
                          const isDone = r.phases?.[p]?.completed;
                          const isCurrent = r.currentPhase === p;
                          return [
                            <div key={p} className="flex flex-col items-center shrink-0">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${isDone ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/30' : isCurrent ? 'bg-white dark:bg-gray-700 text-gray-500' : 'bg-white dark:bg-gray-700 text-gray-300'}`} style={isCurrent ? { borderColor: pColor, color: pColor, boxShadow: `0 0 0 2px ${pColor}26` } : { borderColor: isDone ? undefined : '#E5E7EB' }}>
                                {isDone ? <CheckCircle size={11} strokeWidth={2.5} /> : isCurrent ? <Clock size={11} /> : i + 1}
                              </div>
                              <span className="text-[8px] font-bold uppercase tracking-wide mt-0.5 text-gray-400 dark:text-gray-500" style={isDone ? { color: '#059669' } : isCurrent ? { color: pColor } : {}}>{PHASE_LABELS[p].slice(0, 4)}</span>
                            </div>,
                            ...[i < PHASES.length - 1 ? (
                              <div key={`${p}-conn`} className={`h-0.5 flex-1 mx-1 mb-[17px] rounded-full transition-colors duration-300 ${isDone ? 'bg-emerald-400' : 'bg-gray-200 dark:bg-gray-600'}`} />
                            ) : []],
                          ];
                        })}
                      </div>
                    </div>

                    {/* Overall progress */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: `linear-gradient(90deg, #6366F1, ${typeColor})` }} />
                      </div>
                      <span className="text-xs font-bold" style={{ color: progress === 100 ? '#059669' : '#6366F1' }}>{progress}%</span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">{donePhases}/{PHASES.length}</span>
                    </div>

                    {/* Footer */}
                    <div className="mt-2.5 pt-2.5 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1"><Music size={11} className="text-gray-400 dark:text-gray-500" />{trackCount} {trackCount === 1 ? 'track' : 'tracks'}</span>
                        {livePlatforms > 0 && (
                          <span className="flex items-center gap-1"><Radio size={11} className="text-gray-400 dark:text-gray-500" />{livePlatforms} live</span>
                        )}
                      </div>
                      <div className={`text-xs font-bold ${r.status === 'released' ? 'text-emerald-600' : days <= 0 ? 'text-red-600' : days <= 30 ? 'text-amber-600' : 'text-gray-400'}`}>
                        {r.status === 'released' ? '● Live' : days <= 0 ? `● ${Math.abs(days)}d` : `● ${days}d`}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredReleases.length === 0 && (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                <Radio size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm">{searchQuery ? 'No releases match your search.' : 'No releases found'}</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Release Detail Modal */}
      {viewDetail && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setViewDetail(null)}>
          <div className="bg-white dark:bg-gray-900 dark:border dark:border-gray-700 rounded-2xl w-full max-w-3xl max-h-[85vh] shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: `${TYPE_COLORS[viewDetail.type]}15`, color: TYPE_COLORS[viewDetail.type] }}>{viewDetail.type}</span>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: `${STATUS_COLORS[viewDetail.status]}15`, color: STATUS_COLORS[viewDetail.status] }}>{viewDetail.status.replace(/_/g, ' ')}</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{viewDetail.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{viewDetail.artist?.stageName || viewDetail.artist?.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(viewDetail)} className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-700">Edit</button>
                {viewDetail.currentPhase !== 'completed' && <button onClick={() => handleAdvancePhase(viewDetail._id)} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1">Advance Phase <ArrowRight size={12} /></button>}
                <button onClick={() => setViewDetail(null)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500"><X size={18} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Phase Timeline */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">Release Phases</h4>
                <div className="flex gap-3">
                  {PHASES.map((p, idx) => {
                    const pColor = PHASE_COLORS[p];
                    const pCompletion = getPhaseCompletion(viewDetail, p);
                    const isCurrent = viewDetail.currentPhase === p;
                    const isDone = viewDetail.phases?.[p as keyof typeof viewDetail.phases]?.completed;
                    return (
                      <div key={p} className={`flex-1 rounded-xl p-3 border-2 transition-all ${isCurrent ? 'border-indigo-300 dark:border-indigo-500/40 bg-indigo-50/50 dark:bg-indigo-500/10' : isDone ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-500/10' : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: isDone ? '#10B981' : isCurrent ? pColor : '#D1D5DB' }}>
                            {isDone ? '✓' : idx + 1}
                          </div>
                          <span className="text-xs font-semibold" style={{ color: isCurrent ? pColor : '#6B7280' }}>{PHASE_LABELS[p]}</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${isDone ? 100 : pCompletion}%`, background: isDone ? '#10B981' : pColor }} />
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">{isDone ? 'Complete' : `${pCompletion}% done`}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Current Phase Checklist */}
              {viewDetail.phases?.[viewDetail.currentPhase as keyof typeof viewDetail.phases] && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
                    {PHASE_LABELS[viewDetail.currentPhase]} Checklist
                  </h4>
                  <div className="space-y-1.5">
                    {viewDetail.phases[viewDetail.currentPhase as keyof typeof viewDetail.phases].checklist.map(item => (
                      <div key={item._id} className={`grid grid-cols-[auto_1fr_120px] gap-3 px-4 py-3 rounded-lg border ${item.status === 'completed' ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-800' : item.status === 'blocked' ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-800' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                        <button
                          onClick={() => handleChecklistToggle(viewDetail._id, viewDetail.currentPhase, item._id, item.status)}
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${item.status === 'completed' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 dark:border-gray-500 hover:border-indigo-400'}`}
                        >
                          {item.status === 'completed' && <CheckCircle size={12} />}
                        </button>
                        <div className="min-w-0">
                          <span className={`text-sm ${item.status === 'completed' ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100'}`}>{item.item}</span>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <input type="date" defaultValue={item.dueDate?.slice(0, 10) || ''} onBlur={e => handleChecklistUpdate(viewDetail._id, viewDetail.currentPhase, item._id, { dueDate: e.target.value })} aria-label={`${item.item} due date`} className="rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-[10px] text-gray-900 dark:text-gray-100" />
                            <input defaultValue={item.notes || ''} onBlur={e => { if (e.target.value !== (item.notes || '')) handleChecklistUpdate(viewDetail._id, viewDetail.currentPhase, item._id, { notes: e.target.value }); }} placeholder="Notes or deliverable link" className="rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-[10px] text-gray-900 dark:text-gray-100 placeholder-gray-400" />
                          </div>
                        </div>
                        <select value={item.status} onChange={e => handleChecklistUpdate(viewDetail._id, viewDetail.currentPhase, item._id, { status: e.target.value })} className="self-start rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-[10px] font-semibold uppercase text-gray-900 dark:text-gray-100">
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
                  <div key={l}><p className="text-xs text-gray-400 dark:text-gray-500">{l}</p><p className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">{v}</p></div>
                ))}
              </div>

              {viewDetail.songs && viewDetail.songs.length > 0 && <div><h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Release Songs</h4><div className="flex flex-wrap gap-2">{viewDetail.songs.map(song => <span key={song._id} className="rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-200"><Music size={11} className="mr-1.5 inline" />{song.title}</span>)}</div></div>}

              {(viewDetail.preSaveLink || viewDetail.pressReleaseUrl || viewDetail.coverArt) && <div><h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Release Assets</h4><div className="flex flex-wrap gap-2">{viewDetail.preSaveLink && <a href={viewDetail.preSaveLink} target="_blank" rel="noreferrer" className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 dark:hover:bg-gray-800">Pre-save page</a>}{viewDetail.pressReleaseUrl && <a href={viewDetail.pressReleaseUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 dark:hover:bg-gray-800">Press materials</a>}{viewDetail.coverArt && <a href={viewDetail.coverArt} target="_blank" rel="noreferrer" className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 dark:hover:bg-gray-800">Cover artwork</a>}</div></div>}

              {/* Platforms */}
              {viewDetail.platforms && viewDetail.platforms.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Platforms</h4>
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
          <div className="bg-white dark:bg-gray-900 dark:border dark:border-gray-700 rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{editingTarget ? 'Edit Release' : 'Schedule New Release'}</h3>
              <button onClick={() => { setShowCreate(false); resetForm(); }} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">Title</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">Artist</label>
                  <select value={form.artist} onChange={e => setForm(p => ({ ...p, artist: e.target.value, songs: [] }))} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100">
                    <option value="">Select artist...</option>
                    {artists.map(a => <option key={a._id} value={a._id}>{a.stageName || a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">Type</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as any }))} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100">
                    {['single', 'ep', 'album', 'mixtape', 'compilation'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">Marketing Budget</label>
                  <input type="number" min="0" value={form.marketingBudget} onChange={e => setForm(p => ({ ...p, marketingBudget: +e.target.value }))} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">Genre</label>
                  <input value={form.genre} onChange={e => setForm(p => ({ ...p, genre: e.target.value }))} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">Language</label>
                  <input value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value }))} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300"><input type="checkbox" checked={form.explicit} onChange={e => setForm(p => ({ ...p, explicit: e.target.checked }))} className="h-4 w-4 rounded" />Explicit release</label>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">Songs</label>
                <div className="max-h-36 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                  {!form.artist ? <p className="p-2 text-xs text-gray-400 dark:text-gray-500">Select an artist first</p> : availableSongs.length === 0 ? <p className="p-2 text-xs text-gray-400 dark:text-gray-500">No songs found for this artist</p> : availableSongs.map(song => <label key={song._id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50"><input type="checkbox" checked={form.songs.includes(song._id)} onChange={e => setForm(p => ({ ...p, songs: e.target.checked ? [...p.songs, song._id] : p.songs.filter(id => id !== song._id) }))} className="h-4 w-4 rounded" /><span className="flex-1 text-gray-700 dark:text-gray-200">{song.title}</span><span className="text-[10px] uppercase text-gray-400 dark:text-gray-500">{song.status.replace(/_/g, ' ')}</span></label>)}
                </div>
                <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">At least one song is required before ownership can be confirmed.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">UPC</label><input value={form.upc} onChange={e => setForm(p => ({ ...p, upc: e.target.value }))} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100" /></div>
                <div><label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">Cover Artwork URL</label><input type="url" value={form.coverArt} onChange={e => setForm(p => ({ ...p, coverArt: e.target.value }))} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100" /></div>
                <div><label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">Pre-save Page</label><input type="url" value={form.preSaveLink} onChange={e => setForm(p => ({ ...p, preSaveLink: e.target.value }))} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100" /></div>
                <div><label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">Press Materials URL</label><input type="url" value={form.pressReleaseUrl} onChange={e => setForm(p => ({ ...p, pressReleaseUrl: e.target.value }))} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100" /></div>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="mb-3 flex items-center justify-between"><div><h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Distribution platforms</h4><p className="text-[10px] text-gray-500 dark:text-gray-400">Track delivery and live-store links.</p></div><button type="button" onClick={() => setForm(p => ({ ...p, platforms: [...p.platforms, { name: '', status: 'pending', link: '' }] }))} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">+ Add platform</button></div>
                {form.platforms.length === 0 ? <p className="py-2 text-center text-xs text-gray-400 dark:text-gray-500">No platforms added yet</p> : <div className="space-y-2">{form.platforms.map((platform, index) => <div key={index} className="grid grid-cols-[1fr_130px_1.4fr_auto] gap-2"><input placeholder="Platform" value={platform.name} onChange={e => setForm(p => ({ ...p, platforms: p.platforms.map((item, i) => i === index ? { ...item, name: e.target.value } : item) }))} className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100" /><select value={platform.status} onChange={e => setForm(p => ({ ...p, platforms: p.platforms.map((item, i) => i === index ? { ...item, status: e.target.value as any } : item) }))} className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"><option value="pending">Pending</option><option value="submitted">Submitted</option><option value="live">Live</option><option value="rejected">Rejected</option></select><input type="url" placeholder="Store link" value={platform.link} onChange={e => setForm(p => ({ ...p, platforms: p.platforms.map((item, i) => i === index ? { ...item, link: e.target.value } : item) }))} className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100" /><button type="button" onClick={() => setForm(p => ({ ...p, platforms: p.platforms.filter((_, i) => i !== index) }))} className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500"><X size={14} /></button></div>)}</div>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">Release Date</label>
                  <input type="date" value={form.releaseDate} onChange={e => setForm(p => ({ ...p, releaseDate: e.target.value }))} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">Priority</label>
                  <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as any }))} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100">
                    {['low', 'medium', 'high', 'critical'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => { setShowCreate(false); resetForm(); }} className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={handleSave} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">{editingTarget ? 'Save Changes' : 'Create Release'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Releases;
