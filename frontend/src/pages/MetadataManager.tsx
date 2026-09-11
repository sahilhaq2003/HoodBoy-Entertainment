import React, { useEffect, useState, useCallback } from 'react';
import {
  Search, Plus, Download, Shield, CheckCircle, AlertTriangle, X, RefreshCw,
  Filter, Edit2, Trash2, FileText, Music, Globe, Disc,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import ConfirmDialog from '../components/ui/ConfirmDialog';

interface Artist {
  _id: string;
  name?: string;
  artistName?: string;
  stageName?: string;
}

interface SongRef {
  _id: string;
  title: string;
  status: string;
}

interface MetadataEntry {
  _id: string;
  songId: SongRef;
  artist: Artist;
  title: string;
  version: string;
  album: string;
  genre: string;
  subgenre: string;
  mood: string;
  bpm: number;
  key: string;
  language: string;
  label: string;
  releaseDate: string;
  lyrics: string;
  contactInformation: { name: string; email: string; phone: string };
  isrc: string;
  upc: string;
  copyright: string;
  copyrightOwner: string;
  copyrightYear: number;
  publisher: string;
  proAffiliation: string;
  writerSplit: string;
  credits: Array<{ name: string; role: string; percentage: number }>;
  publishers: Array<{ name: string; percentage: number; proAffiliation: string; ipi: string }>;
  distributionDate: string;
  distributionPlatform: string;
  preSaveDate: string;
  audioFormat: string;
  sampleRate: string;
  bitDepth: string;
  isExplicit: boolean;
  validationStatus: string;
  validationErrors: string[];
  lastValidatedAt: string;
  notes: string;
  createdAt: string;
}

interface Stats {
  total: number;
  valid: number;
  incomplete: number;
  needsReview: number;
  unvalidated: number;
  byGenre: { _id: string; count: number }[];
  byLanguage: { _id: string; count: number }[];
}

interface Song {
  _id: string;
  title: string;
  artist?: Artist;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  valid: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  incomplete: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  needs_review: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  unvalidated: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
};

const INPUT_CLASS = 'w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500';
const PRIMARY_BTN = 'px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2';

const emptyForm = {
  songId: '', title: '', version: 'Original', artist: '', album: '', genre: '', subgenre: '', mood: '',
  bpm: '', key: '', language: 'English', isrc: '', upc: '', copyright: '',
  copyrightOwner: '', copyrightYear: '', publisher: '', proAffiliation: '', writerSplit: '', label: 'HoodBoy Entertainment', releaseDate: '', lyrics: '',
  contactInformation: { name: '', email: '', phone: '' },
  credits: [] as Array<{ name: string; role: string; percentage: number }>,
  publishers: [] as Array<{ name: string; percentage: number; proAffiliation: string; ipi: string }>,
  distributionDate: '', distributionPlatform: '', preSaveDate: '',
  audioFormat: '', sampleRate: '', bitDepth: '', isExplicit: false, notes: '',
};

const MetadataManager: React.FC = () => {
  const [metadata, setMetadata] = useState<MetadataEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const loadMetadata = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (search) params.search = search;
      if (statusFilter) params.validationStatus = statusFilter;
      if (genreFilter) params.genre = genreFilter;
      const res = await api.get('/metadata', { params });
      setMetadata(res.data.data);
      setTotalPages(res.data.pagination.pages);
    } catch { toast.error('Failed to load metadata'); }
    setLoading(false);
  }, [page, search, statusFilter, genreFilter]);

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get('/metadata/stats');
      setStats(res.data.data);
    } catch { toast.error('Failed to load metadata stats'); }
  }, []);

  useEffect(() => { loadMetadata(); loadStats(); }, [loadMetadata, loadStats]);

  useEffect(() => {
    const loadArtists = async () => {
      try {
        const res = await api.get('/artists', { params: { limit: 500 } });
        setArtists(res.data.data || res.data);
      } catch { toast.error('Failed to load artists'); }
    };
    const loadSongs = async () => {
      try {
        const res = await api.get('/songs', { params: { limit: 500 } });
        setSongs(res.data.data || res.data);
      } catch { toast.error('Failed to load songs'); }
    };
    loadArtists();
    loadSongs();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (entry: MetadataEntry) => {
    setEditingId(entry._id);
    setForm({
      songId: entry.songId?._id || '',
      title: entry.title || '',
      version: entry.version || 'Original',
      artist: entry.artist?._id || '',
      album: entry.album || '',
      genre: entry.genre || '',
      subgenre: entry.subgenre || '',
      mood: entry.mood || '',
      bpm: entry.bpm ? String(entry.bpm) : '',
      key: entry.key || '',
      language: entry.language || 'English',
      label: entry.label || 'HoodBoy Entertainment',
      releaseDate: entry.releaseDate ? entry.releaseDate.split('T')[0] : '',
      lyrics: entry.lyrics || '',
      contactInformation: entry.contactInformation || { name: '', email: '', phone: '' },
      isrc: entry.isrc || '',
      upc: entry.upc || '',
      copyright: entry.copyright || '',
      copyrightOwner: entry.copyrightOwner || '',
      copyrightYear: entry.copyrightYear ? String(entry.copyrightYear) : '',
      publisher: entry.publisher || '',
      proAffiliation: entry.proAffiliation || '',
      writerSplit: entry.writerSplit || '',
      credits: entry.credits || [],
      publishers: entry.publishers || [],
      distributionDate: entry.distributionDate ? entry.distributionDate.split('T')[0] : '',
      distributionPlatform: entry.distributionPlatform || '',
      preSaveDate: entry.preSaveDate ? entry.preSaveDate.split('T')[0] : '',
      audioFormat: entry.audioFormat || '',
      sampleRate: entry.sampleRate || '',
      bitDepth: entry.bitDepth || '',
      isExplicit: entry.isExplicit,
      notes: entry.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title) return toast.error('Title is required');
    if (!form.artist) return toast.error('Artist is required');
    if (!editingId && !form.songId) return toast.error('Song is required');
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (form.bpm) payload.bpm = parseInt(form.bpm as string);
      if (form.copyrightYear) payload.copyrightYear = parseInt(form.copyrightYear as string);
      if (!form.distributionDate) payload.distributionDate = null;
      if (!form.preSaveDate) payload.preSaveDate = null;
      if (!form.releaseDate) payload.releaseDate = null;

      if (editingId) {
        await api.put(`/metadata/${editingId}`, payload);
        toast.success('Metadata updated');
      } else {
        await api.post('/metadata', payload);
        toast.success('Metadata created');
      }
      setShowModal(false);
      loadMetadata();
      loadStats();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save';
      toast.error(msg);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/metadata/${id}`);
      toast.success('Deleted');
      loadMetadata();
      loadStats();
    } catch { toast.error('Failed to delete'); }
  };

  const handleValidate = async (id: string) => {
    try {
      await api.post('/metadata/validate', { id });
      toast.success('Validated');
      loadMetadata();
      loadStats();
    } catch { toast.error('Validation failed'); }
  };

  const handleBulkValidate = async () => {
    try {
      const res = await api.post('/metadata/validate/bulk');
      const { total, valid, invalid } = res.data.data;
      toast.success(`Validated ${total}: ${valid} valid, ${invalid} invalid`);
      loadMetadata();
      loadStats();
    } catch { toast.error('Bulk validation failed'); }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const res = await api.post('/metadata/export', { format });
      if (format === 'csv') {
        const blob = new Blob([res.data.data], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'metadata-export.csv';
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([JSON.stringify(res.data.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'metadata-export.json';
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch { toast.error('Export failed'); }
  };

  const updateField = (field: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Disc className="text-indigo-600" size={28} />
            Metadata Manager
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage song metadata, validate and export data</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Metadata', value: stats.total, icon: <FileText size={20} className="text-indigo-600" />, bg: 'bg-indigo-50' },
            { label: 'Valid', value: stats.valid, icon: <CheckCircle size={20} className="text-emerald-600" />, bg: 'bg-emerald-50' },
            { label: 'Incomplete', value: stats.incomplete, icon: <AlertTriangle size={20} className="text-amber-600" />, bg: 'bg-amber-50' },
            { label: 'Unvalidated', value: stats.unvalidated, icon: <Shield size={20} className="text-gray-500" />, bg: 'bg-gray-100' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.bg}`}>{s.icon}</div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by title or ISRC..."
            className={`${INPUT_CLASS} pl-9`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="w-auto px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:border-indigo-500"
        >
          <option value="">All Statuses</option>
          <option value="valid">Valid</option>
          <option value="incomplete">Incomplete</option>
          <option value="needs_review">Needs Review</option>
          <option value="unvalidated">Unvalidated</option>
        </select>
        <select
          value={genreFilter}
          onChange={e => { setGenreFilter(e.target.value); setPage(1); }}
          className="w-auto px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:border-indigo-500"
        >
          <option value="">All Genres</option>
          <option value="Hip-Hop">Hip-Hop</option>
          <option value="Pop">Pop</option>
          <option value="R&B">R&B</option>
          <option value="Rock">Rock</option>
          <option value="Electronic">Electronic</option>
          <option value="Jazz">Jazz</option>
          <option value="Country">Country</option>
          <option value="Latin">Latin</option>
          <option value="Classical">Classical</option>
          <option value="Other">Other</option>
        </select>
        <button onClick={handleBulkValidate} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 transition-colors flex items-center gap-2">
          <RefreshCw size={14} /> Validate All
        </button>
        <button onClick={() => handleExport('json')} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2">
          <Download size={14} /> JSON
        </button>
        <button onClick={() => handleExport('csv')} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors flex items-center gap-2">
          <Download size={14} /> CSV
        </button>
        <button onClick={openCreate} className={PRIMARY_BTN}>
          <Plus size={14} /> Add Metadata
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={24} className="text-indigo-600 animate-spin" />
          </div>
        ) : metadata.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Music size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No metadata entries found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Song / Title</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Artist</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Genre</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">ISRC</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">BPM</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Language</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {metadata.map(entry => {
                  const sc = STATUS_CONFIG[entry.validationStatus] || STATUS_CONFIG.unvalidated;
                  return (
                    <tr key={entry._id} className="hover:bg-gray-50 transition-colors border-b border-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <Music size={16} className="text-indigo-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{entry.title}</div>
                            <div className="text-xs text-gray-500">{entry.songId?.title || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{entry.artist?.stageName || entry.artist?.artistName || entry.artist?.name || '—'}</td>
                      <td className="px-4 py-3 text-gray-700">{entry.genre || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{entry.isrc || '—'}</td>
                      <td className="px-4 py-3">
                        <span title={entry.validationErrors?.join('\n') || 'All required metadata is complete'} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {entry.validationStatus?.replace('_', ' ')}
                          {!!entry.validationErrors?.length && <AlertTriangle size={11} />}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{entry.bpm || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-gray-700">
                          <Globe size={12} className="text-gray-400" />
                          {entry.language || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleValidate(entry._id)} title="Validate" className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors">
                            <Shield size={15} />
                          </button>
                          <button onClick={() => openEdit(entry)} title="Edit" className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors">
                            <Edit2 size={15} />
                          </button>
                          <button onClick={() => setDeleteTarget(entry._id)} title="Delete" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors">Prev</button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col dark:bg-gray-900 dark:border dark:border-gray-700">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{editingId ? 'Edit Metadata' : 'Add Metadata'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-800">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {/* Core */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 dark:text-gray-400">Core</h3>
                <div className="grid grid-cols-2 gap-3">
                  {!editingId && (
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">Song</label>
                      <select value={form.songId} onChange={e => {
                        const song = songs.find(item => item._id === e.target.value);
                        setForm(previous => ({ ...previous, songId: e.target.value, title: song?.title || previous.title, artist: song?.artist?._id || previous.artist }));
                      }} className={INPUT_CLASS}>
                        <option value="">Select a song</option>
                        {songs.map(s => <option key={s._id} value={s._id}>{s.title}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">Title *</label>
                    <input value={form.title} onChange={e => updateField('title', e.target.value)} className={INPUT_CLASS} placeholder="Song title" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">Version *</label>
                    <input value={form.version} onChange={e => updateField('version', e.target.value)} className={INPUT_CLASS} placeholder="Original, Clean, Radio Edit..." />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">Label *</label>
                    <input value={form.label} onChange={e => updateField('label', e.target.value)} className={INPUT_CLASS} placeholder="Record label" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">Artist *</label>
                    <select value={form.artist} onChange={e => updateField('artist', e.target.value)} className={INPUT_CLASS}>
                      <option value="">Select artist</option>
                      {artists.map(a => <option key={a._id} value={a._id}>{a.stageName || a.artistName || a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">Album</label>
                    <input value={form.album} onChange={e => updateField('album', e.target.value)} className={INPUT_CLASS} placeholder="Album name" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">Genre</label>
                    <input value={form.genre} onChange={e => updateField('genre', e.target.value)} className={INPUT_CLASS} placeholder="e.g. Hip-Hop" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">Subgenre</label>
                    <input value={form.subgenre} onChange={e => updateField('subgenre', e.target.value)} className={INPUT_CLASS} placeholder="e.g. Trap" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">Mood</label>
                    <input value={form.mood} onChange={e => updateField('mood', e.target.value)} className={INPUT_CLASS} placeholder="e.g. Upbeat" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">BPM</label>
                    <input type="number" value={form.bpm} onChange={e => updateField('bpm', e.target.value)} className={INPUT_CLASS} placeholder="120" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">Key</label>
                    <input value={form.key} onChange={e => updateField('key', e.target.value)} className={INPUT_CLASS} placeholder="e.g. C Major" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">Language</label>
                    <input value={form.language} onChange={e => updateField('language', e.target.value)} className={INPUT_CLASS} placeholder="English" />
                  </div>
                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.isExplicit} onChange={e => updateField('isExplicit', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-gray-700 dark:text-gray-200">Explicit</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">Official Release Date *</label>
                    <input type="date" value={form.releaseDate} onChange={e => updateField('releaseDate', e.target.value)} className={INPUT_CLASS} />
                  </div>
                </div>
              </div>

              {/* Rights */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 dark:text-gray-400">Rights & Identifiers</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">ISRC</label>
                    <input value={form.isrc} onChange={e => updateField('isrc', e.target.value)} className={INPUT_CLASS} placeholder="US-S1Z-99-00001" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">UPC</label>
                    <input value={form.upc} onChange={e => updateField('upc', e.target.value)} className={INPUT_CLASS} placeholder="UPC code" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">Copyright</label>
                    <input value={form.copyright} onChange={e => updateField('copyright', e.target.value)} className={INPUT_CLASS} placeholder="© 2026 HoodBoy Entertainment" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">Copyright Owner *</label>
                    <input value={form.copyrightOwner} onChange={e => updateField('copyrightOwner', e.target.value)} className={INPUT_CLASS} placeholder="Master copyright owner" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">Copyright Year</label>
                    <input type="number" value={form.copyrightYear} onChange={e => updateField('copyrightYear', e.target.value)} className={INPUT_CLASS} placeholder="2026" />
                  </div>
                </div>
              </div>

              {/* Publishing */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 dark:text-gray-400">Publishing</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">Publisher</label>
                    <input value={form.publisher} onChange={e => updateField('publisher', e.target.value)} className={INPUT_CLASS} placeholder="Publisher" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">PRO Affiliation</label>
                    <input value={form.proAffiliation} onChange={e => updateField('proAffiliation', e.target.value)} className={INPUT_CLASS} placeholder="BMI / ASCAP" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">Writer Split</label>
                    <input value={form.writerSplit} onChange={e => updateField('writerSplit', e.target.value)} className={INPUT_CLASS} placeholder="e.g. 50/50" />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <div className="mb-3 flex items-center justify-between"><div><h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Credits</h3><p className="mt-1 text-[10px] text-gray-400">Add writers, producers, featured artists, and other official credits.</p></div><button type="button" onClick={() => setForm(previous => ({ ...previous, credits: [...previous.credits, { name: '', role: 'songwriter', percentage: 0 }] }))} className="text-xs font-semibold text-indigo-600">+ Add credit</button></div>
                {form.credits.length === 0 ? <p className="py-2 text-center text-xs text-gray-400">No credits entered</p> : <div className="space-y-2">{form.credits.map((credit, index) => <div key={index} className="grid grid-cols-[1fr_150px_90px_auto] gap-2"><input value={credit.name} placeholder="Legal credit name" onChange={e => setForm(previous => ({ ...previous, credits: previous.credits.map((item, i) => i === index ? { ...item, name: e.target.value } : item) }))} className={INPUT_CLASS} /><select value={credit.role} onChange={e => setForm(previous => ({ ...previous, credits: previous.credits.map((item, i) => i === index ? { ...item, role: e.target.value } : item) }))} className={INPUT_CLASS}>{['songwriter','composer','producer','featured_artist','engineer','mixer','masterer','vocalist','musician','other'].map(role => <option key={role} value={role}>{role.replace(/_/g, ' ')}</option>)}</select><input type="number" min="0" max="100" title="Percentage" value={credit.percentage} onChange={e => setForm(previous => ({ ...previous, credits: previous.credits.map((item, i) => i === index ? { ...item, percentage: +e.target.value } : item) }))} className={INPUT_CLASS} /><button type="button" onClick={() => setForm(previous => ({ ...previous, credits: previous.credits.filter((_, i) => i !== index) }))} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={15} /></button></div>)}</div>}
                <p className="mt-2 text-[10px] text-gray-400">Writer and composer percentages must total 100%.</p>
              </div>

              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <div className="mb-3 flex items-center justify-between"><div><h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Publishers</h3><p className="mt-1 text-[10px] text-gray-400">Structured publisher ownership and registration details.</p></div><button type="button" onClick={() => setForm(previous => ({ ...previous, publishers: [...previous.publishers, { name: '', percentage: 0, proAffiliation: '', ipi: '' }] }))} className="text-xs font-semibold text-indigo-600">+ Add publisher</button></div>
                {form.publishers.length === 0 ? <p className="py-2 text-center text-xs text-gray-400">No publishers entered</p> : <div className="space-y-2">{form.publishers.map((publisher, index) => <div key={index} className="grid grid-cols-[1fr_80px_110px_110px_auto] gap-2"><input value={publisher.name} placeholder="Publisher" onChange={e => setForm(previous => ({ ...previous, publishers: previous.publishers.map((item, i) => i === index ? { ...item, name: e.target.value } : item) }))} className={INPUT_CLASS} /><input type="number" min="0" max="100" title="Percentage" value={publisher.percentage} onChange={e => setForm(previous => ({ ...previous, publishers: previous.publishers.map((item, i) => i === index ? { ...item, percentage: +e.target.value } : item) }))} className={INPUT_CLASS} /><input value={publisher.proAffiliation} placeholder="PRO" onChange={e => setForm(previous => ({ ...previous, publishers: previous.publishers.map((item, i) => i === index ? { ...item, proAffiliation: e.target.value } : item) }))} className={INPUT_CLASS} /><input value={publisher.ipi} placeholder="IPI" onChange={e => setForm(previous => ({ ...previous, publishers: previous.publishers.map((item, i) => i === index ? { ...item, ipi: e.target.value } : item) }))} className={INPUT_CLASS} /><button type="button" onClick={() => setForm(previous => ({ ...previous, publishers: previous.publishers.filter((_, i) => i !== index) }))} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={15} /></button></div>)}</div>}
              </div>

              {/* Distribution */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 dark:text-gray-400">Distribution</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">Distribution Date</label>
                    <input type="date" value={form.distributionDate} onChange={e => updateField('distributionDate', e.target.value)} className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">Platform</label>
                    <input value={form.distributionPlatform} onChange={e => updateField('distributionPlatform', e.target.value)} className={INPUT_CLASS} placeholder="Spotify, Apple Music..." />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">Pre-Save Date</label>
                    <input type="date" value={form.preSaveDate} onChange={e => updateField('preSaveDate', e.target.value)} className={INPUT_CLASS} />
                  </div>
                </div>
              </div>

              {/* Technical */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 dark:text-gray-400">Technical</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">Audio Format</label>
                    <select value={form.audioFormat} onChange={e => updateField('audioFormat', e.target.value)} className={INPUT_CLASS}>
                      <option value="">Select format</option>
                      <option value="wav">WAV</option>
                      <option value="flac">FLAC</option>
                      <option value="mp3">MP3</option>
                      <option value="aac">AAC</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">Sample Rate</label>
                    <input value={form.sampleRate} onChange={e => updateField('sampleRate', e.target.value)} className={INPUT_CLASS} placeholder="44.1 kHz" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">Bit Depth</label>
                    <input value={form.bitDepth} onChange={e => updateField('bitDepth', e.target.value)} className={INPUT_CLASS} placeholder="24-bit" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 dark:text-gray-400">Lyrics & Contact</h3>
                <textarea value={form.lyrics} onChange={e => updateField('lyrics', e.target.value)} rows={7} className={INPUT_CLASS} placeholder="Official lyrics *" />
                <div className="mt-3 grid grid-cols-3 gap-3"><input value={form.contactInformation.name} onChange={e => setForm(previous => ({ ...previous, contactInformation: { ...previous.contactInformation, name: e.target.value } }))} className={INPUT_CLASS} placeholder="Contact name" /><input type="email" value={form.contactInformation.email} onChange={e => setForm(previous => ({ ...previous, contactInformation: { ...previous.contactInformation, email: e.target.value } }))} className={INPUT_CLASS} placeholder="Contact email *" /><input value={form.contactInformation.phone} onChange={e => setForm(previous => ({ ...previous, contactInformation: { ...previous.contactInformation, phone: e.target.value } }))} className={INPUT_CLASS} placeholder="Contact phone" /></div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 dark:text-gray-300">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => updateField('notes', e.target.value)}
                  rows={3}
                  className={INPUT_CLASS}
                  placeholder="Additional notes..."
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className={PRIMARY_BTN}>
                {saving ? <RefreshCw size={14} className="animate-spin" /> : null}
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Metadata Entry"
        message="Are you sure you want to delete this metadata entry? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default MetadataManager;
