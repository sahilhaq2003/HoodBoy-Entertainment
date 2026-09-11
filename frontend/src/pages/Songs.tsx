import React, { useEffect, useState } from 'react';
import { Music, Search, Plus, Disc, ChevronDown, ChevronRight, CheckCircle2, Circle, Clock, AlertTriangle, FileAudio, X, Upload, Edit2, Download, Trash2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { artistsApi, songsApi } from '../services/api';
import type { Artist, Song } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { formatNumber, formatCurrency, formatDate, getInitials, getAvatarColor } from '../utils/helpers';

const VERSION_LABELS: Record<string, string> = {
  explicit_master: 'Explicit Master', clean_master: 'Clean Master', instrumental: 'Instrumental',
  performance_version: 'Performance Version', acappella: 'A Cappella', radio_edit: 'Radio Edit',
  stems: 'Stems', wav_high_quality: 'High-Quality WAV', reference_mp3: 'Reference MP3',
};

const ALL_VERSIONS = Object.keys(VERSION_LABELS);

type CreditRole = NonNullable<Song['credits']>[number]['role'];

interface SongForm {
  title: string;
  artist: string;
  album: string;
  genre: string;
  status: Song['status'];
  priority: Song['priority'];
  producedBy: string;
  writtenBy: string;
  isrc: string;
  duration: string;
  releaseDate: string;
  notes: string;
  beatProducer: string;
  beatPurchaseDate: string;
  beatLicenseType: string;
  beatLicenseFile: string;
  beatOwnershipVerified: boolean;
  credits: Array<{ name: string; role: CreditRole; percentage: number; notes: string }>;
}

const emptySongForm = (): SongForm => ({
  title: '', artist: '', album: '', genre: '', status: 'demo', priority: 'medium',
  producedBy: '', writtenBy: '', isrc: '', duration: '', releaseDate: '', notes: '',
  beatProducer: '', beatPurchaseDate: '', beatLicenseType: '', beatLicenseFile: '',
  beatOwnershipVerified: false,
  credits: [{ name: '', role: 'songwriter', percentage: 0, notes: '' }],
});

const CREDIT_ROLES: CreditRole[] = [
  'songwriter', 'composer', 'producer', 'engineer', 'mixer', 'masterer',
  'featured_artist', 'vocalist', 'musician', 'other',
];

const Songs: React.FC = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expandedSong, setExpandedSong] = useState<string | null>(null);
  const [songDetail, setSongDetail] = useState<Song | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [showSongForm, setShowSongForm] = useState(false);
  const [songForm, setSongForm] = useState<SongForm>(emptySongForm());
  const [savingSong, setSavingSong] = useState(false);
  const [uploadingVersion, setUploadingVersion] = useState<string | null>(null);
  const [songDeleteTarget, setSongDeleteTarget] = useState<Song | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadSongs = async () => {
    setLoading(true);
    try {
      const res = await songsApi.getAll({ status: statusFilter || undefined, search: search || undefined });
      setSongs(res.data.data);
    } catch (e) { console.error(e); toast.error('Failed to load songs'); }
    setLoading(false);
  };

  useEffect(() => {
    loadSongs();
  }, [statusFilter, search]);

  const loadDetail = async (songId: string) => {
    if (expandedSong === songId) { setExpandedSong(null); setSongDetail(null); return; }
    setExpandedSong(songId);
    setDetailLoading(true);
    try {
      const res = await songsApi.getById(songId);
      setSongDetail(res.data.data);
      setSongs(previous => previous.map(song => song._id === songId ? res.data.data : song));
    } catch (e) { console.error(e); toast.error('Failed to load song details'); }
    setDetailLoading(false);
  };

  const refreshSongDetail = async (songId: string) => {
    const res = await songsApi.getById(songId);
    setSongDetail(res.data.data);
    setSongs(prev => prev.map(song => song._id === songId ? res.data.data : song));
  };

  const updateWorkflowStep = async (stepId: string, data: { status?: string; notes?: string }) => {
    if (!songDetail) return;
    try {
      await songsApi.updateWorkflowStep(songDetail._id, stepId, data);
      await refreshSongDetail(songDetail._id);
    } catch (e: any) { console.error(e); toast.error(e.response?.data?.message || 'Failed to update workflow step'); }
  };

  const ensureArtistsLoaded = async () => {
    if (artists.length > 0) return;
    try {
      const res = await artistsApi.getAll({ limit: 100 });
      setArtists(res.data.data);
    } catch { toast.error('Failed to load artists'); }
  };

  const openCreateSong = async () => {
    await ensureArtistsLoaded();
    setEditingSong(null);
    setSongForm(emptySongForm());
    setShowSongForm(true);
  };

  const openEditSong = async (song: Song) => {
    await ensureArtistsLoaded();
    setEditingSong(song);
    setSongForm({
      title: song.title,
      artist: song.artist?._id || '',
      album: song.album || '',
      genre: song.genre || '',
      status: song.status,
      priority: song.priority,
      producedBy: song.producedBy || '',
      writtenBy: song.writtenBy || '',
      isrc: song.isrc || '',
      duration: song.duration ? String(song.duration) : '',
      releaseDate: song.releaseDate ? song.releaseDate.split('T')[0] : '',
      notes: song.notes || '',
      beatProducer: song.beatInfo?.producer || '',
      beatPurchaseDate: song.beatInfo?.beatPurchaseDate?.split('T')[0] || '',
      beatLicenseType: song.beatInfo?.licenseType || '',
      beatLicenseFile: song.beatInfo?.licenseFile || '',
      beatOwnershipVerified: Boolean(song.beatInfo?.ownershipVerified),
      credits: song.credits?.length ? song.credits.map(credit => ({ ...credit, notes: credit.notes || '' })) : [{ name: '', role: 'songwriter', percentage: 0, notes: '' }],
    });
    setShowSongForm(true);
  };

  const saveSong = async () => {
    if (!songForm.title.trim() || !songForm.artist) { toast.error('Song title and artist are required'); return; }
    setSavingSong(true);
    const payload = {
      title: songForm.title.trim(), artist: songForm.artist, album: songForm.album.trim(),
      genre: songForm.genre.trim(), status: songForm.status, priority: songForm.priority,
      producedBy: songForm.producedBy.trim(), writtenBy: songForm.writtenBy.trim(),
      isrc: songForm.isrc.trim(), duration: songForm.duration ? Number(songForm.duration) : undefined,
      releaseDate: songForm.releaseDate || undefined,
      notes: songForm.notes.trim(),
      beatInfo: {
        producer: songForm.beatProducer.trim(), beatPurchaseDate: songForm.beatPurchaseDate || undefined,
        licenseType: songForm.beatLicenseType, licenseFile: songForm.beatLicenseFile.trim(),
        ownershipVerified: songForm.beatOwnershipVerified,
      },
      credits: songForm.credits.filter(credit => credit.name.trim()).map(credit => ({ ...credit, name: credit.name.trim() })),
    };
    try {
      const res = editingSong ? await songsApi.update(editingSong._id, payload) : await songsApi.create(payload);
      toast.success(editingSong ? 'Song updated' : 'Song created with the 12-step workflow');
      setShowSongForm(false);
      setEditingSong(null);
      await loadSongs();
      if (expandedSong === res.data.data._id) await refreshSongDetail(res.data.data._id);
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed to save song'); }
    setSavingSong(false);
  };

  const uploadSongVersion = async (versionType: string, file: File) => {
    if (!songDetail) return;
    const data = new FormData();
    data.append('type', versionType);
    data.append('file', file);
    setUploadingVersion(versionType);
    try {
      await songsApi.addVersion(songDetail._id, data);
      await refreshSongDetail(songDetail._id);
      toast.success(`${VERSION_LABELS[versionType]} uploaded`);
    } catch (e: any) { toast.error(e.response?.data?.message || 'Upload failed'); }
    setUploadingVersion(null);
  };

  const deleteSongVersion = async (versionId: string) => {
    if (!songDetail) return;
    try {
      await songsApi.deleteVersion(songDetail._id, versionId);
      await refreshSongDetail(songDetail._id);
      toast.success('Song version removed');
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed to remove song version'); }
  };

  const [versionDeleteTarget, setVersionDeleteTarget] = useState<string | null>(null);

  const deleteSong = async () => {
    if (!songDeleteTarget) return;
    setDeleting(true);
    try {
      await songsApi.delete(songDeleteTarget._id);
      toast.success('Song deleted');
      if (expandedSong === songDeleteTarget._id) { setExpandedSong(null); setSongDetail(null); }
      setSongDeleteTarget(null);
      await loadSongs();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed to delete song'); }
    setDeleting(false);
  };

  const updateCredit = (index: number, changes: Partial<SongForm['credits'][number]>) => {
    setSongForm(current => ({
      ...current,
      credits: current.credits.map((credit, i) => i === index ? { ...credit, ...changes } : credit),
    }));
  };

  const workflowStats = (song: Song) => {
    const wf = song.productionWorkflow || [];
    const total = wf.length;
    const completed = wf.filter(s => s.status === 'completed').length;
    return { total, completed, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
  };

  const versionsPresent = (song: Song) => (song.versions || []).map(v => v.type);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Total Songs', value: songs.length, color: '#8B5CF6' },
          { label: 'In Production', value: songs.filter(s => ['in_production','mixing','mastering'].includes(s.status)).length, color: '#06B6D4' },
          { label: 'Awaiting Approval', value: songs.filter(s => s.status === 'awaiting_approval').length, color: '#F5A623' },
          { label: 'Released', value: songs.filter(s => s.status === 'released').length, color: '#10B981' },
          { label: 'Shelved', value: songs.filter(s => s.status === 'shelved').length, color: '#EF4444' },
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 p-4">
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{s.value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.label}</div>
            <div className="h-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mt-2"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${(s.value / Math.max(songs.length, 1)) * 100}%`, background: s.color }} /></div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <Search size={14} className="text-gray-400 dark:text-gray-500" />
          <input type="text" placeholder="Search songs..." value={search} onChange={e => setSearch(e.target.value)} className="bg-transparent text-sm text-gray-700 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none flex-1" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10">
          <option value="">All Statuses</option>
          <option value="demo">Demo</option>
          <option value="in_production">In Production</option>
          <option value="mixing">Mixing</option>
          <option value="mastering">Mastering</option>
          <option value="awaiting_approval">Awaiting Approval</option>
          <option value="approved">Approved</option>
          <option value="released">Released</option>
          <option value="shelved">Shelved</option>
        </select>
        <button onClick={openCreateSong} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition-all shadow-sm flex items-center gap-2">
          <Plus size={15} /> New Song
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size={28} /></div>
      ) : (
        <div className="space-y-2">
          {songs.map(song => {
            const wf = workflowStats(song);
            const vers = versionsPresent(song);
            const isExpanded = expandedSong === song._id;
            return (
              <div key={song._id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
                {/* Song row */}
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors" onClick={() => loadDetail(song._id)}>
                  <div className="flex-shrink-0">
                    {isExpanded ? <ChevronDown size={16} className="text-gray-400 dark:text-gray-500" /> : <ChevronRight size={16} className="text-gray-400 dark:text-gray-500" />}
                  </div>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-800">
                    <Music size={14} className="text-purple-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{song.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{song.artist?.stageName || song.artist?.name} {song.album ? `· ${song.album}` : ''}</div>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400 dark:text-gray-500">Workflow:</span>
                      <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${wf.pct}%` }} />
                      </div>
                      <span className="font-medium">{wf.completed}/{wf.total}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400 dark:text-gray-500">Versions:</span>
                      <span className="font-medium">{vers.length}/9</span>
                    </div>
                  </div>
                  <StatusBadge status={song.status} />
                  <StatusBadge status={song.priority} type="priority" />
                  <div className="hidden md:block text-xs text-gray-500 dark:text-gray-400 w-20 text-right">{formatNumber(song.streams || 0)} streams</div>
                  <div className="hidden md:block text-xs font-medium text-emerald-600 dark:text-emerald-400 w-20 text-right">{song.revenue ? formatCurrency(song.revenue) : '—'}</div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 px-4 py-4">
                    {detailLoading ? (
                      <div className="flex justify-center py-6"><LoadingSpinner size={20} /></div>
                    ) : songDetail ? (
                      <div className="space-y-5">
                        {/* Production Workflow - 12 Steps */}
                        <div>
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Production Workflow (12 Steps)</h4>
                            <button onClick={() => openEditSong(songDetail)} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 flex items-center gap-1.5"><Edit2 size={12} /> Edit Song Details</button>
                            <button onClick={() => setSongDeleteTarget(song)} className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 bg-white dark:bg-gray-800 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-300 flex items-center gap-1.5"><Trash2 size={12} /> Delete</button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {(songDetail.productionWorkflow || []).map(step => (
                              <div
                                key={step._id}
                                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                                  step.status === 'completed'
                                    ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                                    : step.status === 'in_progress'
                                    ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400'
                                    : step.status === 'blocked'
                                    ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {step.status === 'completed' ? <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" /> :
                                   step.status === 'in_progress' ? <Clock size={14} className="text-blue-500 flex-shrink-0" /> :
                                   step.status === 'blocked' ? <AlertTriangle size={14} className="text-red-500 flex-shrink-0" /> :
                                   <Circle size={14} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />}
                                  <span className="truncate flex-1">{step.order}. {step.label}</span>
                                  <select value={step.status} onChange={event => updateWorkflowStep(step._id, { status: event.target.value })} className="bg-white/80 dark:bg-gray-900/70 border border-current/20 rounded px-1.5 py-1 text-[10px] text-gray-700 dark:text-gray-200 outline-none">
                                    <option value="pending">Pending</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="blocked">Blocked</option>
                                    <option value="completed">Completed</option>
                                  </select>
                                </div>
                                <input key={`${step._id}-${step.notes}`} defaultValue={step.notes || ''} onBlur={event => {
                                  if (event.target.value !== (step.notes || '')) updateWorkflowStep(step._id, { notes: event.target.value });
                                }} placeholder="Notes or blocker reason" className="w-full mt-2 px-2 py-1.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-[10px] text-gray-600 dark:text-gray-300 outline-none focus:border-indigo-300 dark:focus:border-indigo-500" />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Song Versions - 9 Required */}
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Song Versions</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {ALL_VERSIONS.map(vType => {
                              const exists = (songDetail.versions || []).find(v => v.type === vType);
                              return (
                                <div key={vType} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${
                                  exists ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500'
                                }`}>
                                  {exists ? <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" /> : <FileAudio size={14} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />}
                                  <div className="min-w-0 flex-1">
                                    <div className={exists ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}>{VERSION_LABELS[vType]}</div>
                                    {exists && <div className="text-[9px] text-green-600 truncate">{exists.fileName} · {(exists.fileSize / 1024 / 1024).toFixed(1)} MB</div>}
                                  </div>
                                  {exists ? (
                                    <div className="flex items-center gap-1">
                                      <a href={exists.fileUrl} download target="_blank" rel="noreferrer" className="p-1 text-green-600 hover:text-green-800" title="Download"><Download size={12} /></a>
                                      <button onClick={() => setVersionDeleteTarget(exists._id)} className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500" title="Remove"><Trash2 size={12} /></button>
                                    </div>
                                  ) : (
                                    <label className="px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 cursor-pointer flex items-center gap-1">
                                      <Upload size={11} /> {uploadingVersion === vType ? 'Uploading' : 'Upload'}
                                      <input type="file" accept=".wav,.mp3,.flac,.aif,.aiff,.m4a,.aac,.ogg,.zip" disabled={Boolean(uploadingVersion)} className="hidden" onChange={event => {
                                        const file = event.target.files?.[0];
                                        if (file) uploadSongVersion(vType, file);
                                        event.target.value = '';
                                      }} />
                                    </label>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Credits */}
                        {songDetail.credits && songDetail.credits.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Credits</h4>
                            <div className="flex flex-wrap gap-2">
                              {songDetail.credits.map((c, i) => (
                                <span key={i} className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-800 text-xs font-medium text-indigo-700 dark:text-indigo-400">
                                  {c.name} — {c.role} {c.percentage > 0 ? `(${c.percentage}%)` : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Beat Info */}
                        {songDetail.beatInfo && songDetail.beatInfo.producer && (
                          <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-300">
                            <span><strong>Producer:</strong> {songDetail.beatInfo.producer}</span>
                            <span><strong>License:</strong> {songDetail.beatInfo.licenseType || 'N/A'}</span>
                            <span><strong>Ownership Verified:</strong> {songDetail.beatInfo.ownershipVerified ? 'Yes' : 'No'}</span>
                          </div>
                        )}

                        {/* Meta */}
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
                          {songDetail.producedBy && <span>Produced by {songDetail.producedBy}</span>}
                          {songDetail.writtenBy && <span>Written by {songDetail.writtenBy}</span>}
                          {songDetail.isrc && <span>ISRC: {songDetail.isrc}</span>}
                          {songDetail.genre && <span>Genre: {songDetail.genre}</span>}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
          {songs.length === 0 && (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">
              <Music size={40} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">No songs found</p>
            </div>
          )}
        </div>
      )}

      {showSongForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowSongForm(false)} />
          <div className="relative z-10 w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl">
            <div className="sticky top-0 z-10 px-6 py-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{editingSong ? 'Edit Song' : 'Create Song'}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Song details, beat ownership, and production credits</p>
              </div>
              <button onClick={() => setShowSongForm(false)} className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"><X size={19} /></button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Song Title <span className="text-red-500">*</span></label>
                  <input value={songForm.title} onChange={event => setSongForm({ ...songForm, title: event.target.value })} placeholder="Song title" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Artist <span className="text-red-500">*</span></label>
                  <select value={songForm.artist} onChange={event => setSongForm({ ...songForm, artist: event.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500">
                    <option value="">Select artist...</option>
                    {artists.map(artist => <option key={artist._id} value={artist._id}>{artist.artistName || artist.stageName || artist.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Project / Album</label>
                  <input value={songForm.album} onChange={event => setSongForm({ ...songForm, album: event.target.value })} placeholder="Album, EP, or single project" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Genre</label>
                  <input value={songForm.genre} onChange={event => setSongForm({ ...songForm, genre: event.target.value })} placeholder="Genre" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Status</label>
                  <select value={songForm.status} onChange={event => setSongForm({ ...songForm, status: event.target.value as Song['status'] })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500">
                    <option value="demo">Demo</option><option value="in_production">In Production</option><option value="mixing">Mixing</option><option value="mastering">Mastering</option><option value="awaiting_approval">Awaiting Approval</option><option value="approved">Approved</option><option value="released">Released</option><option value="shelved">Shelved</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Priority</label>
                  <select value={songForm.priority} onChange={event => setSongForm({ ...songForm, priority: event.target.value as Song['priority'] })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500">
                    <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Produced By</label>
                  <input value={songForm.producedBy} onChange={event => setSongForm({ ...songForm, producedBy: event.target.value })} placeholder="Producer credit display" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Written By</label>
                  <input value={songForm.writtenBy} onChange={event => setSongForm({ ...songForm, writtenBy: event.target.value })} placeholder="Writer credit display" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">ISRC Code</label>
                  <input value={songForm.isrc} onChange={event => setSongForm({ ...songForm, isrc: event.target.value })} placeholder="e.g. US-S1Z-23-00001" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 uppercase" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Duration (seconds)</label>
                  <input type="number" min="0" value={songForm.duration} onChange={event => setSongForm({ ...songForm, duration: event.target.value })} placeholder="e.g. 240" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Release Date</label>
                  <input type="date" value={songForm.releaseDate} onChange={event => setSongForm({ ...songForm, releaseDate: event.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500" />
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-500/10 p-4">
                <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide mb-3">Beat Ownership</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input value={songForm.beatProducer} onChange={event => setSongForm({ ...songForm, beatProducer: event.target.value })} placeholder="Beat producer" className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-amber-500" />
                  <select value={songForm.beatLicenseType} onChange={event => setSongForm({ ...songForm, beatLicenseType: event.target.value })} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-amber-500">
                    <option value="">Select license...</option><option value="exclusive">Exclusive</option><option value="non_exclusive">Non-exclusive</option><option value="lease">Lease</option><option value="work_for_hire">Work for hire</option><option value="custom">Custom</option>
                  </select>
                  <div><label className="block text-[10px] text-amber-700 dark:text-amber-300 mb-1">Purchase date</label><input type="date" value={songForm.beatPurchaseDate} onChange={event => setSongForm({ ...songForm, beatPurchaseDate: event.target.value })} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-amber-500" /></div>
                  <input value={songForm.beatLicenseFile} onChange={event => setSongForm({ ...songForm, beatLicenseFile: event.target.value })} placeholder="License file location or URL" className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm outline-none focus:border-amber-500 self-end" />
                </div>
                <label className="mt-3 flex items-center gap-2 text-xs font-medium text-amber-900 dark:text-amber-200 cursor-pointer">
                  <input type="checkbox" checked={songForm.beatOwnershipVerified} onChange={event => setSongForm({ ...songForm, beatOwnershipVerified: event.target.checked })} className="w-4 h-4 rounded text-amber-600" /> Beat ownership and license terms verified
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Credits</h4>
                  <button type="button" onClick={() => setSongForm(current => ({ ...current, credits: [...current.credits, { name: '', role: 'songwriter', percentage: 0, notes: '' }] }))} className="text-xs font-semibold text-indigo-600 flex items-center gap-1"><Plus size={12} /> Add Credit</button>
                </div>
                <div className="space-y-2">
                  {songForm.credits.map((credit, index) => (
                    <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_150px_90px_1fr_auto] gap-2 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <input value={credit.name} onChange={event => updateCredit(index, { name: event.target.value })} placeholder="Name" className="px-2 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-400" />
                      <select value={credit.role} onChange={event => updateCredit(index, { role: event.target.value as CreditRole })} className="px-2 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-400">
                        {CREDIT_ROLES.map(role => <option key={role} value={role}>{role.replace(/_/g, ' ')}</option>)}
                      </select>
                      <div className="relative"><input type="number" min="0" max="100" value={credit.percentage} onChange={event => updateCredit(index, { percentage: Number(event.target.value) })} className="w-full px-2 py-1.5 pr-5 bg-white border border-gray-200 rounded text-xs outline-none focus:border-indigo-400" /><span className="absolute right-1.5 top-1.5 text-[10px] text-gray-400">%</span></div>
                      <input value={credit.notes} onChange={event => updateCredit(index, { notes: event.target.value })} placeholder="Notes" className="px-2 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-400" />
                      <button type="button" disabled={songForm.credits.length === 1} onClick={() => setSongForm(current => ({ ...current, credits: current.credits.filter((_, i) => i !== index) }))} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 disabled:opacity-30"><X size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Production Notes</label>
                <textarea value={songForm.notes} onChange={event => setSongForm({ ...songForm, notes: event.target.value })} rows={3} placeholder="Concept, references, recording instructions, or other notes" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500 resize-none" />
              </div>
            </div>

            <div className="sticky bottom-0 px-6 py-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button onClick={() => setShowSongForm(false)} className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
              <button onClick={saveSong} disabled={savingSong || !songForm.title.trim() || !songForm.artist} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-2"><Save size={14} /> {savingSong ? 'Saving...' : editingSong ? 'Save Changes' : 'Create Song'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Version Confirmation */}
      <ConfirmDialog
        isOpen={!!versionDeleteTarget}
        title="Remove Song Version"
        message="Are you sure you want to remove this song version? This action cannot be undone."
        confirmLabel="Remove"
        onConfirm={() => { if (versionDeleteTarget) deleteSongVersion(versionDeleteTarget); setVersionDeleteTarget(null); }}
        onCancel={() => setVersionDeleteTarget(null)}
      />

      {/* Delete Song Confirmation */}
      <ConfirmDialog
        isOpen={!!songDeleteTarget}
        title="Delete Song"
        message={`Are you sure you want to delete "${songDeleteTarget?.title}"? All versions and workflow data will be lost. This action cannot be undone.`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete Song'}
        variant="danger"
        onConfirm={deleteSong}
        onCancel={() => setSongDeleteTarget(null)}
      />
    </div>
  );
};

export default Songs;
