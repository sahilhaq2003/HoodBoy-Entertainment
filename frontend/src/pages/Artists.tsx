import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, DollarSign, TrendingUp,
  Filter, UserPlus, Clock, CheckCircle, XCircle, AlertCircle,
  RefreshCw, Grid3X3, List, Disc3, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { artistsApi } from '../services/api';
import type { Artist, OnboardingStats } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ArtistCard from '../components/artists/ArtistCard';
import { formatCurrency, formatNumber, getInitials, getAvatarColor } from '../utils/helpers';

const Artists: React.FC = () => {
  const navigate = useNavigate();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [onboardingFilter, setOnboardingFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [onboardingStats, setOnboardingStats] = useState<OnboardingStats>({
    not_started: 0, in_progress: 0, pending_approval: 0, approved: 0, rejected: 0,
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (onboardingFilter) params.onboardingStatus = onboardingFilter;
      const [artistsRes, statsRes] = await Promise.all([
        artistsApi.getAll(params),
        artistsApi.getOnboardingStats(),
      ]);
      setArtists(artistsRes.data.data);
      setOnboardingStats(statsRes.data.data);
    } catch (e) { console.error(e); toast.error('Failed to load artists'); }
    setLoading(false);
  }, [search, statusFilter, onboardingFilter]);

  useEffect(() => { load(); }, [load]);

  const totalRevenue = artists.reduce((sum, a) => sum + (a.totalRevenue || 0), 0);
  const totalStreams = artists.reduce((sum, a) => sum + (a.totalStreams || 0), 0);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await artistsApi.delete(deleteId);
      toast.success('Artist deleted');
      setDeleteId(null);
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to delete artist');
    }
    setDeleting(false);
  };

  const stats = [
    { label: 'Total Artists', value: artists.length, icon: <Users size={18} />, color: '#4F46E5', bg: '#EEF2FF' },
    { label: 'Pending Approval', value: onboardingStats.pending_approval, icon: <Clock size={18} />, color: '#D97706', bg: '#FFFBEB' },
    { label: 'Active Artists', value: onboardingStats.approved, icon: <CheckCircle size={18} />, color: '#059669', bg: '#ECFDF5' },
    { label: 'In Progress', value: onboardingStats.in_progress, icon: <AlertCircle size={18} />, color: '#0891B2', bg: '#ECFEFF' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.bg }}>
                <span style={{ color: s.color }}>{s.icon}</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Stats Bar */}
      <div className="flex flex-wrap items-center gap-6 p-4 rounded-xl bg-white border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2">
          <DollarSign size={14} className="text-emerald-500" />
          <span className="text-xs text-gray-500">Revenue</span>
          <span className="text-xs font-semibold text-gray-900">{formatCurrency(totalRevenue)}</span>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-indigo-500" />
          <span className="text-xs text-gray-500">Streams</span>
          <span className="text-xs font-semibold text-gray-900">{formatNumber(totalStreams)}</span>
        </div>
        <div className="flex items-center gap-2">
          <XCircle size={14} className="text-red-500" />
          <span className="text-xs text-gray-500">Rejected</span>
          <span className="text-xs font-semibold text-gray-900">{onboardingStats.rejected}</span>
        </div>
        <div className="flex items-center gap-2">
          <Disc3 size={14} className="text-gray-400" />
          <span className="text-xs text-gray-500">Not Started</span>
          <span className="text-xs font-semibold text-gray-900">{onboardingStats.not_started}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 flex-1 min-w-48">
          <Search size={14} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search artists..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none flex-1"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
              <XCircle size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 text-sm">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="upcoming">Upcoming</option>
            <option value="on_hold">On Hold</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <select value={onboardingFilter} onChange={(e) => setOnboardingFilter(e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 text-sm">
          <option value="">All Onboarding</option>
          <option value="not_started">Not Started</option>
          <option value="in_progress">In Progress</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-white border border-gray-200">
          <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
            <Grid3X3 size={14} />
          </button>
          <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
            <List size={14} />
          </button>
        </div>

        <button onClick={load} className="px-4 py-2 bg-white text-gray-600 font-medium rounded-lg text-sm border border-gray-200 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-all duration-200 flex items-center gap-2 text-sm">
          <RefreshCw size={14} />
        </button>

        <button onClick={() => navigate('/artists/new')} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2">
          <UserPlus size={14} />
          Onboard Artist
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size={28} text="Loading artists..." /></div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {artists.map(artist => (
            <ArtistCard
              key={artist._id}
              artist={artist}
              onOpen={() => navigate(`/artists/${artist._id}`)}
              onDelete={setDeleteId}
            />
          ))}

          {artists.length === 0 && (
            <div className="col-span-full text-center py-16">
              <Users size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">No artists found</p>
              <button onClick={() => navigate('/artists/new')} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition-all duration-200 shadow-sm hover:shadow-md mt-4 flex items-center gap-2 mx-auto">
                <UserPlus size={14} /> Onboard First Artist
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3 bg-gray-50">Artist</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3 bg-gray-50">Genre</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3 bg-gray-50">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3 bg-gray-50">Onboarding</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3 bg-gray-50">Streams</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3 bg-gray-50">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {artists.map(artist => {
                  const displayName = artist.artistName || artist.stageName || artist.name;
                  return (
                    <tr key={artist._id} className="cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100" onClick={() => navigate(`/artists/${artist._id}`)}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style={{ background: getAvatarColor(displayName) }}>
                            {artist.image ? <img src={artist.image} alt={displayName} className="w-full h-full object-cover rounded-lg" /> : getInitials(displayName)}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{displayName}</div>
                            <div className="text-xs text-gray-500">{artist.email || ''}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">{artist.genre || '-'}</td>
                      <td className="px-5 py-3"><StatusBadge status={artist.status} /></td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide text-[10px] ${
                          artist.onboardingStatus === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          artist.onboardingStatus === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200' :
                          artist.onboardingStatus === 'pending_approval' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          artist.onboardingStatus === 'in_progress' ? 'bg-cyan-50 text-cyan-700 border border-cyan-200' :
                          'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}>
                          {artist.onboardingStatus?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-900 text-right font-medium">{formatNumber(artist.totalStreams || 0)}</td>
                      <td className="px-5 py-3 text-sm text-gray-900 text-right font-medium">{formatCurrency(artist.totalRevenue || 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {artists.length === 0 && (
            <div className="text-center py-16">
              <Users size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">No artists found</p>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="relative z-10 bg-white dark:bg-gray-900 dark:border dark:border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Delete Artist</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Are you sure you want to delete this artist? All associated data will be removed. This action cannot be undone.</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="inline-flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition">
                {deleting && <Loader2 size={14} className="animate-spin" />}
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Artists;
