import React, { useEffect, useState } from 'react';
import {
  Plus, Trash2, Edit2, RefreshCw, Tv, Calendar, Users, Eye, PlayCircle, X, Star, Film,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { lnkUpApi, artistsApi } from '../services/api';
import ConfirmDialog from '../components/ui/ConfirmDialog';

interface Artist {
  _id: string;
  name?: string;
  artistName?: string;
  stageName?: string;
}

interface LnkUpEpisode {
  _id: string;
  title: string;
  season: number;
  episode: number;
  artist?: Artist | null;
  guests: string[];
  status: string;
  airDate?: string;
  platform: string;
  description: string;
  thumbnail: string;
  featured: boolean;
  views: number;
  likes: number;
  watchTime: number;
  notes: string;
  tags: string[];
  createdAt: string;
}

interface Stats {
  total: number;
  aired: number;
  scheduled: number;
  inProduction: number;
  planned: number;
  views: number;
  likes: number;
  watchTime: number;
  upcoming: LnkUpEpisode[];
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  planned: { label: 'Planned', bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  casting: { label: 'Casting', bg: 'bg-sky-100', text: 'text-sky-700', dot: 'bg-sky-500' },
  recorded: { label: 'Recorded', bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  editing: { label: 'Editing', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  scheduled: { label: 'Scheduled', bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  aired: { label: 'Aired', bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelled', bg: 'bg-red-100', text: 'text-red-600', dot: 'bg-red-500' },
};

const PLATFORMS = ['youtube', 'tv', 'streaming', 'podcast', 'live', 'other'];

type FormState = {
  title: string; season: number | string; episode: number | string; artist: string; guests: string;
  status: string; airDate: string; platform: string; description: string; thumbnail: string;
  featured: boolean; views: number | string; likes: number | string; watchTime: number | string;
  notes: string; tags: string;
};

const EMPTY_FORM: FormState = {
  title: '', season: 1, episode: 1, artist: '', guests: '', status: 'planned',
  airDate: '', platform: 'youtube', description: '', thumbnail: '',
  featured: false, views: 0, likes: 0, watchTime: 0, notes: '', tags: '',
};

const LnkUp: React.FC = () => {
  const [episodes, setEpisodes] = useState<LnkUpEpisode[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LnkUpEpisode | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [episodesRes, statsRes] = await Promise.all([lnkUpApi.getAll(), lnkUpApi.getStats()]);
      setEpisodes(episodesRes.data.data);
      setStats(statsRes.data.data);
    } catch { toast.error('Failed to load The Lnk Up show data'); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await artistsApi.getAll();
        setArtists(res.data.data || res.data);
      } catch { /* artist dropdown is optional */ }
    })();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  };

  const openEdit = (ep: LnkUpEpisode) => {
    setEditing(ep);
    setForm({
      title: ep.title, season: ep.season, episode: ep.episode,
      artist: ep.artist?._id || '', guests: (ep.guests || []).join(', '),
      status: ep.status, airDate: ep.airDate ? ep.airDate.slice(0, 10) : '',
      platform: ep.platform, description: ep.description || '', thumbnail: ep.thumbnail || '',
      featured: !!ep.featured, views: ep.views || 0, likes: ep.likes || 0,
      watchTime: ep.watchTime || 0, notes: ep.notes || '', tags: (ep.tags || []).join(', '),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Episode title is required'); return; }
    setSaving(true);
    const payload = {
      ...form,
      episode: Number(form.episode) || 1,
      season: Number(form.season) || 1,
      views: Number(form.views) || 0,
      likes: Number(form.likes) || 0,
      watchTime: Number(form.watchTime) || 0,
      artist: form.artist || undefined,
      guests: form.guests.split(',').map(g => g.trim()).filter(Boolean),
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      airDate: form.airDate ? new Date(form.airDate).toISOString() : undefined,
    };
    try {
      if (editing) {
        await lnkUpApi.update(editing._id, payload);
        toast.success('Episode updated');
      } else {
        await lnkUpApi.create(payload);
        toast.success('Episode created');
      }
      setShowForm(false);
      fetchData();
    } catch { toast.error('Failed to save episode'); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await lnkUpApi.delete(id);
      toast.success('Episode deleted');
      setDeleteTarget(null);
      fetchData();
    } catch { toast.error('Failed to delete episode'); }
  };

  const artistName = (a?: Artist | null) =>
    a ? (a.stageName || a.artistName || a.name || 'Unknown Artist') : 'Showcase';

  const filtered = episodes.filter(ep => {
    const matchesStatus = !statusFilter || ep.status === statusFilter;
    const haystack = `${ep.title} ${ep.season} ${artistName(ep.artist)} ${(ep.tags || []).join(' ')}`.toLowerCase();
    const matchesSearch = !search || haystack.includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  }).sort((a, b) => a.season - b.season || a.episode - b.episode);

  const statCards = stats ? [
    { label: 'Total Episodes', value: stats.total, icon: <Film size={20} className="text-violet-600" />, bg: 'bg-violet-50' },
    { label: 'Aired', value: stats.aired, icon: <PlayCircle size={20} className="text-emerald-600" />, bg: 'bg-emerald-50' },
    { label: 'In Production', value: stats.inProduction, icon: <RefreshCw size={20} className="text-amber-600" />, bg: 'bg-amber-50' },
    { label: 'Total Views', value: stats.views.toLocaleString(), icon: <Eye size={20} className="text-cyan-600" />, bg: 'bg-cyan-50' },
  ] : [];

  const inputClass = "w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:border-violet-500";

  if (loading) {
    return <div className="flex justify-center py-20"><RefreshCw size={24} className="text-violet-500 animate-spin" /></div>;
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Tv className="text-violet-600" size={28} />
            The Lnk Up
          </h1>
          <p className="text-sm text-gray-500 mt-1">HoodBoy Entertainment's flagship TV show &amp; entertainment brand</p>
        </div>
        <button onClick={openCreate}
          className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 flex items-center gap-2">
          <Plus size={15} /> New Episode
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.bg}`}>{s.icon}</div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Upcoming */}
      {stats && stats.upcoming.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={16} className="text-violet-500" />
            <h2 className="text-sm font-bold text-gray-900">Upcoming Episodes</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {stats.upcoming.map(ep => (
              <div key={ep._id} className="border border-gray-200 rounded-lg p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-violet-500">
                  S{ep.season} · E{ep.episode}
                </div>
                <div className="text-sm font-bold text-gray-900 mt-1 truncate">{ep.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{artistName(ep.artist)}</div>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                  <Calendar size={12} />
                  {ep.airDate ? new Date(ep.airDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBA'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Tv size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search episodes by title, artist or tag..."
            className={`${inputClass} pl-9`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="w-auto px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:border-violet-500"
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Episodes table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 font-semibold">Episode</th>
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Artist / Guest</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Air Date</th>
                <th className="px-4 py-3 font-semibold">Platform</th>
                <th className="px-4 py-3 font-semibold">Views</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(ep => {
                const cfg = STATUS_CONFIG[ep.status] || STATUS_CONFIG.planned;
                return (
                  <tr key={ep._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-bold text-gray-900">S{ep.season} · E{ep.episode}</span>
                      {ep.featured && <Star size={12} className="inline text-amber-400 ml-1.5 -mt-0.5" />}
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <div className="font-semibold text-gray-900 truncate">{ep.title}</div>
                      <div className="text-xs text-gray-500 truncate">{ep.description}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Users size={12} className="text-gray-400" />
                        <span className="text-gray-700">{artistName(ep.artist)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-bold ${cfg.bg} ${cfg.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} /> {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {ep.airDate ? new Date(ep.airDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBA'}
                    </td>
                    <td className="px-4 py-3 capitalize text-gray-600">{ep.platform}</td>
                    <td className="px-4 py-3 text-gray-700">{ep.views.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(ep)} className="p-1.5 rounded-lg hover:bg-violet-50 text-gray-400 hover:text-violet-600"><Edit2 size={14} /></button>
                        <button onClick={() => setDeleteTarget(ep._id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-gray-500">
                    <Tv size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-sm">No episodes yet. Add your first The Lnk Up episode.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-bold text-gray-900">{editing ? 'Edit Episode' : 'New Episode'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Episode Title *</label>
                  <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Season 3 Premiere / Live From The Studio" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Season</label>
                  <input type="number" min={1} value={form.season} onChange={e => setForm(p => ({ ...p, season: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Episode #</label>
                  <input type="number" min={1} value={form.episode} onChange={e => setForm(p => ({ ...p, episode: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Featured Artist</label>
                  <select value={form.artist} onChange={e => setForm(p => ({ ...p, artist: e.target.value }))} className={inputClass}>
                    <option value="">Showcase / Feature</option>
                    {artists.map(a => (
                      <option key={a._id} value={a._id}>{a.stageName || a.artistName || a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className={inputClass}>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Air Date</label>
                  <input type="date" value={form.airDate} onChange={e => setForm(p => ({ ...p, airDate: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Platform</label>
                  <select value={form.platform} onChange={e => setForm(p => ({ ...p, platform: e.target.value }))} className={inputClass}>
                    {PLATFORMS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Guests (comma separated)</label>
                  <input value={form.guests} onChange={e => setForm(p => ({ ...p, guests: e.target.value }))}
                    placeholder="e.g. DJ Khaled, Megan Thee Stallion" className={inputClass} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                  <textarea rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Short synopsis of the episode..." className={`${inputClass} resize-none`} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Thumbnail URL</label>
                  <input value={form.thumbnail} onChange={e => setForm(p => ({ ...p, thumbnail: e.target.value }))}
                    placeholder="https://..." className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Tags (comma separated)</label>
                  <input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
                    placeholder="e.g. premiere, interview, live" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Views</label>
                  <input type="number" min={0} value={form.views} onChange={e => setForm(p => ({ ...p, views: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Likes</label>
                  <input type="number" min={0} value={form.likes} onChange={e => setForm(p => ({ ...p, likes: e.target.value }))} className={inputClass} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                  <textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Internal production notes..." className={`${inputClass} resize-none`} />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form.featured} onChange={e => setForm(p => ({ ...p, featured: e.target.checked }))} className="accent-violet-600" />
                  Featured episode
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Episode'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Episode"
        message="Are you sure you want to delete this The Lnk Up episode? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default LnkUp;
