import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Music,
  TrendingUp,
  TrendingDown,
  Globe,
  Users,
  List,
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  ChevronRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Minus,
  Globe2,
  Headphones,
  Heart,
  Share2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, formatNumber, formatDate, formatStatus } from '../utils/helpers';
import { songsApi } from '../services/api';
import api from '../services/api';
import ConfirmDialog from '../components/ui/ConfirmDialog';

interface PlatformMetrics {
  streams: number;
  revenue: number;
  saves: number;
  shares: number;
  listeners: number;
  playlistAdds: number;
  peakPosition?: number;
  currentRank?: number;
}

interface PerSongAnalytics {
  _id: string;
  song: { _id: string; title: string; artist?: { name: string; stageName?: string } };
  period: string;
  periodStart: string;
  periodEnd: string;
  totalStreams: number;
  totalRevenue: number;
  totalSaves: number;
  totalShares: number;
  totalPlaylistAdds: number;
  avgSkipRate: number;
  avgListenThroughRate: number;
  platforms: Record<string, PlatformMetrics>;
  topCountries: Array<{ country: string; streams: number; percentage: number }>;
  demographics: {
    ageGroups: Array<{ range: string; percentage: number }>;
    genderSplit: { male: number; female: number; other: number };
  };
  playlistPlacements: Array<{ name: string; type: string; followers: number; addedDate: string }>;
  notableEvents: Array<{ date: string; event: string; impact: string }>;
  comparisonToPrevious: {
    streamsChange: number;
    revenueChange: number;
    savesChange: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface Song {
  _id: string;
  title: string;
  artist?: { name: string; stageName?: string };
}

const defaultPlatformMetrics: PlatformMetrics = {
  streams: 0,
  revenue: 0,
  saves: 0,
  shares: 0,
  listeners: 0,
  playlistAdds: 0,
  peakPosition: undefined,
  currentRank: undefined,
};

const platformConfig: Record<string, { label: string; colorClass: string }> = {
  spotify: { label: 'Spotify', colorClass: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40' },
  appleMusic: { label: 'Apple Music', colorClass: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/40' },
  youtubeMusic: { label: 'YouTube Music', colorClass: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40' },
  amazonMusic: { label: 'Amazon Music', colorClass: 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800/40' },
  tidal: { label: 'Tidal', colorClass: 'bg-black dark:bg-gray-800 border-gray-700 text-white' },
  deezer: { label: 'Deezer', colorClass: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800/40' },
  soundcloud: { label: 'SoundCloud', colorClass: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/40' },
  other: { label: 'Other', colorClass: 'bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-700' },
};

const emptyPlatforms = (): PerSongAnalytics['platforms'] => ({
  spotify: { ...defaultPlatformMetrics },
  appleMusic: { ...defaultPlatformMetrics },
  youtubeMusic: { ...defaultPlatformMetrics },
  amazonMusic: { ...defaultPlatformMetrics },
  tidal: { ...defaultPlatformMetrics },
  deezer: { ...defaultPlatformMetrics },
  soundcloud: { ...defaultPlatformMetrics },
  other: { ...defaultPlatformMetrics },
});

const emptyForm = () => ({
  songId: '',
  period: '',
  periodStart: '',
  periodEnd: '',
  platforms: emptyPlatforms(),
  topCountries: [{ country: '', streams: 0, percentage: 0 }],
  notableEvents: [{ date: '', event: '', impact: '' }],
});

const ChangeIndicator = ({ value }: { value: number }) => {
  if (value > 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">
        <ArrowUp className="w-3 h-3" />
        {value.toFixed(1)}%
      </span>
    );
  if (value < 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
        <ArrowDown className="w-3 h-3" />
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
      <Minus className="w-3 h-3" />
      0%
    </span>
  );
};

export default function PerSongAnalyticsPage() {
  const [analytics, setAnalytics] = useState<PerSongAnalytics[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/per-song-analytics');
      if (res.data.success) setAnalytics(res.data.data);
    } catch {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSongs = useCallback(async () => {
    try {
      const res = await songsApi.getAll();
      setSongs(res.data?.data || res.data || []);
    } catch {
      toast.error('Failed to load songs');
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
    fetchSongs();
  }, [fetchAnalytics, fetchSongs]);

  const filteredAnalytics = analytics.filter((a) => {
    const q = searchTerm.toLowerCase();
    return (
      a.song?.title?.toLowerCase().includes(q) ||
      a.song?.artist?.name?.toLowerCase().includes(q) ||
      a.song?.artist?.stageName?.toLowerCase().includes(q) ||
      a.period?.toLowerCase().includes(q)
    );
  });

  const totalStreams = analytics.reduce((s, a) => s + a.totalStreams, 0);
  const totalRevenue = analytics.reduce((s, a) => s + a.totalRevenue, 0);
  const avgSkipRate = analytics.length ? analytics.reduce((s, a) => s + a.avgSkipRate, 0) / analytics.length : 0;
  const totalPlaylistAdds = analytics.reduce((s, a) => s + a.totalPlaylistAdds, 0);

  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (entry: PerSongAnalytics) => {
    setEditingId(entry._id);
    setFormData({
      songId: entry.song._id,
      period: entry.period,
      periodStart: entry.periodStart,
      periodEnd: entry.periodEnd,
      platforms: entry.platforms,
      topCountries: entry.topCountries.length ? entry.topCountries : [{ country: '', streams: 0, percentage: 0 }],
      notableEvents: entry.notableEvents.length ? entry.notableEvents : [{ date: '', event: '', impact: '' }],
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/per-song-analytics/${id}`);
      toast.success('Deleted');
      setAnalytics((prev) => prev.filter((a) => a._id !== id));
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleSave = async () => {
    if (!formData.songId || !formData.period || !formData.periodStart || !formData.periodEnd) {
      toast.error('Please fill in required fields');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        song: formData.songId,
        period: formData.period,
        periodStart: formData.periodStart,
        periodEnd: formData.periodEnd,
        platforms: formData.platforms,
        topCountries: formData.topCountries.filter((c) => c.country),
        notableEvents: formData.notableEvents.filter((e) => e.event),
      };
      if (editingId) {
        const res = await api.put(`/per-song-analytics/${editingId}`, payload);
        if (res.data.success) {
          toast.success('Updated');
          setAnalytics((prev) => prev.map((a) => (a._id === editingId ? res.data.data : a)));
        }
      } else {
        const res = await api.post('/per-song-analytics', payload);
        if (res.data.success) {
          toast.success('Created');
          setAnalytics((prev) => [...prev, res.data.data]);
        }
      }
      setModalOpen(false);
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const updatePlatform = (platform: string, field: keyof PlatformMetrics, value: number | string) => {
    setFormData((prev) => ({
      ...prev,
      platforms: {
        ...prev.platforms,
        [platform]: {
          ...prev.platforms[platform as keyof typeof prev.platforms],
          [field]: typeof value === 'string' ? parseFloat(value) || 0 : value,
        },
      },
    }));
  };

  const addCountry = () =>
    setFormData((prev) => ({ ...prev, topCountries: [...prev.topCountries, { country: '', streams: 0, percentage: 0 }] }));

  const removeCountry = (i: number) =>
    setFormData((prev) => ({ ...prev, topCountries: prev.topCountries.filter((_, idx) => idx !== i) }));

  const updateCountry = (i: number, field: string, value: string | number) =>
    setFormData((prev) => ({
      ...prev,
      topCountries: prev.topCountries.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)),
    }));

  const addEvent = () =>
    setFormData((prev) => ({ ...prev, notableEvents: [...prev.notableEvents, { date: '', event: '', impact: '' }] }));

  const removeEvent = (i: number) =>
    setFormData((prev) => ({ ...prev, notableEvents: prev.notableEvents.filter((_, idx) => idx !== i) }));

  const updateEvent = (i: number, field: string, value: string) =>
    setFormData((prev) => ({
      ...prev,
      notableEvents: prev.notableEvents.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)),
    }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Per-Song Analytics</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Streaming data and performance by song</p>
        </div>
        <button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Analytics
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-center gap-4">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
            <Headphones className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Streams</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{formatNumber(totalStreams)}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-center gap-4">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
            <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalRevenue)}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-center gap-4">
          <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <BarChart3 className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Avg Skip Rate</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{avgSkipRate.toFixed(1)}%</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-center gap-4">
          <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
            <List className="w-6 h-6 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Playlist Adds</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{formatNumber(totalPlaylistAdds)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search songs, artists, periods..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        {filteredAnalytics.length === 0 ? (
          <div className="p-12 text-center">
            <Music className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No analytics data found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="px-4 py-3">Song</th>
                  <th className="px-4 py-3">Artist</th>
                  <th className="px-4 py-3 text-right">Streams</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">Saves</th>
                  <th className="px-4 py-3 text-right">Playlist Adds</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredAnalytics.map((entry) => {
                  const isExpanded = expandedId === entry._id;
                  return (
                    <React.Fragment key={entry._id}>
                      <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : entry._id)}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            <span className="font-medium text-gray-900 dark:text-white">{entry.song?.title || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {entry.song?.artist?.stageName || entry.song?.artist?.name || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">{formatNumber(entry.totalStreams)}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">{formatCurrency(entry.totalRevenue)}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">{formatNumber(entry.totalSaves)}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">{formatNumber(entry.totalPlaylistAdds)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{entry.period}</td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setExpandedId(isExpanded ? null : entry._id)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button onClick={() => openEdit(entry)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteTarget(entry._id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-600">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="px-4 pb-4">
                            <ExpandedDetail analytics={entry} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{editingId ? 'Edit Analytics' : 'Add Analytics'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                &times;
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Song *</label>
                  <select
                    value={formData.songId}
                    onChange={(e) => setFormData((p) => ({ ...p, songId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Select song</option>
                    {songs.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.title} — {s.artist?.stageName || s.artist?.name || 'Unknown'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Period *</label>
                  <input
                    type="text"
                    value={formData.period}
                    onChange={(e) => setFormData((p) => ({ ...p, period: e.target.value }))}
                    placeholder="e.g. Q1 2024, Jan 2024"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start *</label>
                    <input
                      type="date"
                      value={formData.periodStart}
                      onChange={(e) => setFormData((p) => ({ ...p, periodStart: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End *</label>
                    <input
                      type="date"
                      value={formData.periodEnd}
                      onChange={(e) => setFormData((p) => ({ ...p, periodEnd: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Platform Metrics</h3>
                <div className="space-y-4">
                  {(Object.keys(platformConfig) as Array<keyof typeof platformConfig>).map((key) => (
                    <div key={key} className={`rounded-lg border p-4 ${platformConfig[key].colorClass}`}>
                      <p className={`text-sm font-medium mb-3 ${key === 'tidal' ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>{platformConfig[key].label}</p>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                        {(['streams', 'revenue', 'saves', 'shares', 'listeners', 'playlistAdds'] as Array<keyof PlatformMetrics>).map((field) => (
                          <div key={field}>
                            <label className={`block text-xs mb-1 ${key === 'tidal' ? 'text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>
                              {field === 'playlistAdds' ? 'Playlists' : field.charAt(0).toUpperCase() + field.slice(1)}
                            </label>
                            <input
                              type="number"
                              value={formData.platforms[key as keyof typeof formData.platforms][field] ?? ''}
                              onChange={(e) => updatePlatform(key, field, e.target.value)}
                              className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Top Countries</h3>
                  <button onClick={addCountry} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.topCountries.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={c.country}
                        onChange={(e) => updateCountry(i, 'country', e.target.value)}
                        placeholder="Country"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                      <input
                        type="number"
                        value={c.streams || ''}
                        onChange={(e) => updateCountry(i, 'streams', parseFloat(e.target.value) || 0)}
                        placeholder="Streams"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                      <input
                        type="number"
                        value={c.percentage || ''}
                        onChange={(e) => updateCountry(i, 'percentage', parseFloat(e.target.value) || 0)}
                        placeholder="%"
                        className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                      {formData.topCountries.length > 1 && (
                        <button onClick={() => removeCountry(i)} className="p-2 text-gray-400 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Notable Events</h3>
                  <button onClick={addEvent} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.notableEvents.map((e, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="date"
                        value={e.date}
                        onChange={(ev) => updateEvent(i, 'date', ev.target.value)}
                        className="w-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                      <input
                        type="text"
                        value={e.event}
                        onChange={(ev) => updateEvent(i, 'event', ev.target.value)}
                        placeholder="Event"
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                      <input
                        type="text"
                        value={e.impact}
                        onChange={(ev) => updateEvent(i, 'impact', ev.target.value)}
                        placeholder="Impact"
                        className="w-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                      {formData.notableEvents.length > 1 && (
                        <button onClick={() => removeEvent(i)} className="p-2 text-gray-400 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Analytics Entry"
        message="Are you sure you want to delete this analytics entry? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function ExpandedDetail({ analytics }: { analytics: PerSongAnalytics }) {
  const [openSection, setOpenSection] = useState<string>('platforms');
  const toggle = (s: string) => setOpenSection(openSection === s ? '' : s);

  return (
    <div className="space-y-4 bg-gray-50 dark:bg-gray-800/30 rounded-lg p-4 mt-1">
      <div className="grid grid-cols-3 gap-4">
        <ChangeIndicator value={analytics.comparisonToPrevious.streamsChange} />
        <div className="text-xs text-gray-500 dark:text-gray-400">Streams Change</div>
        <ChangeIndicator value={analytics.comparisonToPrevious.revenueChange} />
        <div className="text-xs text-gray-500 dark:text-gray-400">Revenue Change</div>
        <ChangeIndicator value={analytics.comparisonToPrevious.savesChange} />
        <div className="text-xs text-gray-500 dark:text-gray-400">Saves Change</div>
      </div>

      <button onClick={() => toggle('platforms')} className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white w-full text-left">
        {openSection === 'platforms' ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Headphones className="w-4 h-4" /> Platform Breakdown
      </button>
      {openSection === 'platforms' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(Object.keys(platformConfig) as Array<keyof typeof platformConfig>).map((key) => {
            const m = analytics.platforms[key];
            if (!m.streams && !m.revenue) return null;
            return (
              <div key={key} className={`rounded-lg border p-4 ${platformConfig[key].colorClass}`}>
                <p className={`text-sm font-semibold mb-2 ${key === 'tidal' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{platformConfig[key].label}</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className={key === 'tidal' ? 'text-gray-300' : 'text-gray-500 dark:text-gray-400'}>Streams</span>
                    <span className={key === 'tidal' ? 'text-white' : 'text-gray-900 dark:text-white'}>{formatNumber(m.streams)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={key === 'tidal' ? 'text-gray-300' : 'text-gray-500 dark:text-gray-400'}>Revenue</span>
                    <span className={key === 'tidal' ? 'text-white' : 'text-gray-900 dark:text-white'}>{formatCurrency(m.revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={key === 'tidal' ? 'text-gray-300' : 'text-gray-500 dark:text-gray-400'}>Saves</span>
                    <span className={key === 'tidal' ? 'text-white' : 'text-gray-900 dark:text-white'}>{formatNumber(m.saves)}</span>
                  </div>
                  {m.peakPosition && (
                    <div className="flex justify-between">
                      <span className={key === 'tidal' ? 'text-gray-300' : 'text-gray-500 dark:text-gray-400'}>Peak</span>
                      <span className={key === 'tidal' ? 'text-white' : 'text-gray-900 dark:text-white'}>#{m.peakPosition}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {analytics.topCountries.length > 0 && (
        <>
          <button onClick={() => toggle('countries')} className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white w-full text-left">
            {openSection === 'countries' ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <Globe className="w-4 h-4" /> Top Countries
          </button>
          {openSection === 'countries' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase">
                    <th className="pb-2 pr-4">Country</th>
                    <th className="pb-2 pr-4 text-right">Streams</th>
                    <th className="pb-2 w-1/3">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {analytics.topCountries.map((c, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 text-gray-900 dark:text-white flex items-center gap-2">
                        <Globe2 className="w-4 h-4 text-gray-400" />
                        {c.country}
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-900 dark:text-white">{formatNumber(c.streams)}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${c.percentage}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right">{c.percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <button onClick={() => toggle('demographics')} className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white w-full text-left">
        {openSection === 'demographics' ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Users className="w-4 h-4" /> Demographics
      </button>
      {openSection === 'demographics' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Age Groups</p>
            <div className="space-y-2">
              {analytics.demographics?.ageGroups?.map((ag, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-700 dark:text-gray-300">{ag.range}</span>
                    <span className="text-gray-500 dark:text-gray-400">{ag.percentage}%</span>
                  </div>
                  <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-violet-500 h-2 rounded-full" style={{ width: `${ag.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Gender Split</p>
            <div className="flex items-center gap-3">
              {[
                { label: 'Male', value: analytics.demographics?.genderSplit?.male ?? 0, color: 'bg-blue-500' },
                { label: 'Female', value: analytics.demographics?.genderSplit?.female ?? 0, color: 'bg-pink-500' },
                { label: 'Other', value: analytics.demographics?.genderSplit?.other ?? 0, color: 'bg-gray-400' },
              ].map((g) => (
                <div key={g.label} className="flex-1 text-center">
                  <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: g.color.replace('bg-', '').includes('blue') ? '#3b82f6' : g.color.includes('pink') ? '#ec4899' : '#9ca3af' }}>
                    {g.value}%
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{g.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {analytics.playlistPlacements?.length > 0 && (
        <>
          <button onClick={() => toggle('playlists')} className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white w-full text-left">
            {openSection === 'playlists' ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <List className="w-4 h-4" /> Playlist Placements
          </button>
          {openSection === 'playlists' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase">
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Type</th>
                    <th className="pb-2 pr-4 text-right">Followers</th>
                    <th className="pb-2">Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {analytics.playlistPlacements.map((p, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 text-gray-900 dark:text-white flex items-center gap-1">
                        {p.name}
                        <ExternalLink className="w-3 h-3 text-gray-400" />
                      </td>
                      <td className="py-2 pr-4">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400">{p.type}</span>
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-900 dark:text-white">{formatNumber(p.followers)}</td>
                      <td className="py-2 text-gray-500 dark:text-gray-400">{formatDate(p.addedDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {analytics.notableEvents?.length > 0 && (
        <>
          <button onClick={() => toggle('events')} className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white w-full text-left">
            {openSection === 'events' ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <AlertCircle className="w-4 h-4" /> Notable Events
          </button>
          {openSection === 'events' && (
            <div className="relative pl-6 space-y-4">
              <div className="absolute left-2 top-1 bottom-1 w-px bg-gray-300 dark:bg-gray-600" />
              {analytics.notableEvents.map((ev, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-4 top-1 w-3 h-3 rounded-full bg-indigo-600 border-2 border-white dark:border-gray-900" />
                  <div className="text-xs text-gray-500 dark:text-gray-400">{formatDate(ev.date)}</div>
                  <div className="text-sm text-gray-900 dark:text-white">{ev.event}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Impact: {ev.impact}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
