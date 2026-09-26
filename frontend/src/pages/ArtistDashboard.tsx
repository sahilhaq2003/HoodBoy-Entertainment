import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Music, Radio, DollarSign, Headphones, TrendingUp,
  Clock, CheckCircle, AlertCircle, BarChart3,
  Disc3
} from 'lucide-react';
import { dashboardApi } from '../services/api';
import { formatCurrency, formatNumber, formatDate } from '../utils/helpers';
import DashboardHero from '../components/ui/DashboardHero';
import StatCard from '../components/ui/StatCard';
import Card from '../components/ui/Card';
import StatusBadge from '../components/ui/StatusBadge';
import PerformanceSnapshot from '../components/dashboard/PerformanceSnapshot';

const fmtCur = (v: number) => formatCurrency(Math.round(v));

interface ArtistProfile {
  id: string;
  name: string;
  stageName: string;
  image: string;
  status: string;
  genre: string;
}

interface KPIs {
  totalSongs: number;
  totalReleases: number;
  totalStreams: number;
  totalRevenue: number;
  totalRoyaltiesOwed: number;
  totalPaid: number;
  balance: number;
}

interface Song {
  _id: string;
  title: string;
  status: string;
  genre: string;
  streams: number;
  revenue: number;
  createdAt: string;
}

interface Release {
  _id: string;
  title: string;
  releaseDate: string;
  status: string;
  type: string;
  currentPhase: string;
}

interface Task {
  id: string;
  title: string;
  deadline: string;
  status: string;
  priority: string;
  assignedBy: string;
}

interface Royalty {
  id: string;
  period: string;
  grossIncome: number;
  artistShare: number;
  totalPaid: number;
  remainingBalance: number;
  status: string;
}

interface DashboardData {
  role: string;
  artist: ArtistProfile;
  kpis: KPIs;
  songs: Song[];
  releases: Release[];
  tasks: Task[];
  royalties: Royalty[];
}

const ArtistDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await dashboardApi.getRoleDashboard();
      setData(res.data.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-[3px] border-[#7C3AED]/30 border-t-[#7C3AED] rounded-full animate-spin" />
          <p className="text-sm font-medium text-[var(--hbe-muted)]">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-3">
          <AlertCircle size={40} className="text-[#DC2626] mx-auto" />
          <p className="text-sm font-semibold text-[var(--hbe-text-soft)]">{error || 'No data available'}</p>
        </div>
      </div>
    );
  }

  const { artist, kpis, songs, releases, tasks, royalties } = data;

  if (!artist) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-3">
          <AlertCircle size={40} className="text-[#F59E0B] mx-auto" />
          <p className="text-sm font-semibold text-[var(--hbe-text-soft)]">No artist profile linked to your account yet.</p>
          <p className="text-xs text-[var(--hbe-muted)]">Contact your manager to set up your artist profile.</p>
        </div>
      </div>
    );
  }

  const settlement = kpis.totalPaid + kpis.totalRoyaltiesOwed > 0 ? (kpis.totalPaid / (kpis.totalPaid + kpis.totalRoyaltiesOwed)) * 100 : 0;
  const releasedReleases = releases.filter((r) => r.status === 'released').length;
  const activeSongs = songs.filter((s) => ['active', 'released', 'in_production'].includes(s.status)).length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">

      <DashboardHero
        eyebrow={artist.genre ? artist.genre : 'Artist Studio'}
        title={artist.stageName || artist.name}
        subtitle={artist.name}
        icon={<Disc3 size={22} />}
        accent="violet"
        onRefresh={() => load(true)}
        refreshing={refreshing}
        stats={[
          { label: 'Total Streams', value: formatNumber(kpis.totalStreams), tone: 'up' },
          { label: 'Total Revenue', value: fmtCur(kpis.totalRevenue), tone: 'up' },
        ]}
      />

      <div className="flex flex-col gap-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-[var(--hbe-text)]">Music Distribution</p>
          <p className="mt-1 text-xs text-[var(--hbe-muted)]">Create delivery drafts, upload masters and artwork, and follow each release through the distribution pipeline.</p>
        </div>
        <Link to="/distribution" className="shrink-0 rounded-xl bg-violet-600 px-4 py-2.5 text-center text-sm font-bold text-white">Open Distribution</Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Songs" value={kpis.totalSongs} icon={<Music size={19} />} color="#7C3AED" />
        <StatCard label="Total Releases" value={kpis.totalReleases} icon={<Radio size={19} />} color="#7C3AED" />
        <StatCard label="Total Streams" value={kpis.totalStreams} format={(n) => formatNumber(Math.round(n))} icon={<Headphones size={19} />} color="#0EA5E9" />
        <StatCard label="Total Revenue" value={kpis.totalRevenue} format={fmtCur} icon={<DollarSign size={19} />} color="#16A34A" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Royalties Owed" value={kpis.totalRoyaltiesOwed} format={fmtCur} icon={<TrendingUp size={19} />} color="#F59E0B" />
        <StatCard label="Total Paid" value={kpis.totalPaid} format={fmtCur} icon={<CheckCircle size={19} />} color="#16A34A" />
        <StatCard label="Outstanding Balance" value={kpis.balance} format={fmtCur} icon={<AlertCircle size={19} />} color={kpis.balance >= 0 ? '#16A34A' : '#DC2626'} trendNote={`${kpis.balance >= 0 ? 'In credit' : 'Balanced owed'}`} />
      </div>

      <PerformanceSnapshot
        description="Ratios computed from your catalog and royalty history"
        metrics={[
          {
            label: 'Royalty Settlement',
            value: settlement,
            color: settlement >= 60 ? '#16A34A' : '#F59E0B',
            note: `${fmtCur(kpis.totalPaid)} paid`,
          },
          {
            label: 'Releases Shipped',
            value: releases.length > 0 ? (releasedReleases / releases.length) * 100 : 0,
            color: '#0EA5E9',
            note: `${releasedReleases} of ${releases.length}`,
          },
          {
            label: 'Active Catalog',
            value: songs.length > 0 ? (activeSongs / songs.length) * 100 : 0,
            color: '#7C3AED',
            note: `${activeSongs} of ${songs.length} songs`,
          },
        ]}
      />

      <Card title="My Songs" description="Catalog performance at a glance" icon={<Music size={16} />} accent="violet" badge={songs.length}>
        {songs.length === 0 ? (
          <div className="text-center py-8">
            <Music size={28} className="text-[var(--hbe-muted)] mx-auto mb-2" />
            <p className="text-xs text-[var(--hbe-muted)]">No songs yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="pb-3 pr-4">Title</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4 text-right">Streams</th>
                  <th className="pb-3 pr-4 text-right">Revenue</th>
                  <th className="pb-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--hbe-divide)">
                {songs.map((song) => (
                  <tr key={song._id} className="transition-colors hover:bg-(--hbe-hover-fill)">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--hbe-text)]">{song.title}</span>
                        {song.genre && (
                          <span className="text-[10px] text-[var(--hbe-muted)] hidden sm:inline">({song.genre})</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={song.status} />
                    </td>
                    <td className="py-3 pr-4 text-right text-sm font-medium text-[var(--hbe-text-soft)]">{formatNumber(song.streams || 0)}</td>
                    <td className="py-3 pr-4 text-right text-sm font-bold text-[#16A34A]">{formatCurrency(song.revenue || 0)}</td>
                    <td className="py-3 text-sm text-[var(--hbe-muted)]">{formatDate(song.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <Card title="My Releases" icon={<Radio size={16} />} accent="sky" badge={releases.length}>
          {releases.length === 0 ? (
            <div className="text-center py-8">
              <Radio size={28} className="text-[var(--hbe-muted)] mx-auto mb-2" />
              <p className="text-xs text-[var(--hbe-muted)]">No releases yet</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1 -mr-1">
              {releases.map((release) => (
                <div key={release._id} className="flex items-center justify-between p-3 rounded-xl border border-(--hbe-line) bg-(--hbe-fill-soft) hover:bg-(--hbe-fill) transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-[11px] bg-[#7C3AED]/12 flex items-center justify-center shrink-0">
                      <Radio size={16} className="text-[#8B5CF6]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--hbe-text)] truncate">{release.title}</p>
                      <p className="text-xs text-[var(--hbe-muted)] mt-0.5">{formatDate(release.releaseDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <StatusBadge status={release.status} />
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-(--hbe-fill) text-[var(--hbe-muted)] border border-(--hbe-line)">
                      {release.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="My Tasks" icon={<Clock size={16} />} accent="amber" badge={tasks.length}>
          {tasks.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle size={28} className="text-[var(--hbe-muted)] mx-auto mb-2" />
              <p className="text-xs text-[var(--hbe-muted)]">No tasks assigned</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1 -mr-1">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-3 rounded-xl border border-(--hbe-line) bg-(--hbe-fill-soft) hover:bg-(--hbe-fill) transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--hbe-text)] truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-[var(--hbe-muted)] flex items-center gap-1">
                        <Clock size={10} />
                        {formatDate(task.deadline)}
                      </span>
                      <span className="text-[11px] text-[var(--hbe-muted)]">by {task.assignedBy}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <StatusBadge status={task.priority} type="priority" />
                    <StatusBadge status={task.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

      </div>

      <Card title="Royalty History" icon={<BarChart3 size={16} />} accent="emerald" badge={royalties.length}>
        {royalties.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign size={28} className="text-[var(--hbe-muted)] mx-auto mb-2" />
            <p className="text-xs text-[var(--hbe-muted)]">No royalty records yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="pb-3 pr-4">Period</th>
                  <th className="pb-3 pr-4 text-right">Gross Income</th>
                  <th className="pb-3 pr-4 text-right">Artist Share</th>
                  <th className="pb-3 pr-4 text-right">Paid</th>
                  <th className="pb-3 pr-4 text-right">Balance</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--hbe-divide)">
                {royalties.map((royalty) => (
                  <tr key={royalty.id} className="transition-colors hover:bg-(--hbe-hover-fill)">
                    <td className="py-3 pr-4 text-sm font-semibold text-[var(--hbe-text)]">{royalty.period}</td>
                    <td className="py-3 pr-4 text-right text-sm font-medium text-[var(--hbe-text-soft)]">{formatCurrency(royalty.grossIncome)}</td>
                    <td className="py-3 pr-4 text-right text-sm font-medium text-[var(--hbe-text-soft)]">{formatCurrency(royalty.artistShare)}</td>
                    <td className="py-3 pr-4 text-right text-sm font-bold text-[#16A34A]">{formatCurrency(royalty.totalPaid)}</td>
                    <td className="py-3 pr-4 text-right">
                      <span className={`text-sm font-bold ${royalty.remainingBalance > 0 ? 'text-[#D97706]' : 'text-[var(--hbe-muted)]'}`}>
                        {formatCurrency(royalty.remainingBalance)}
                      </span>
                    </td>
                    <td className="py-3">
                      <StatusBadge status={royalty.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

    </div>
  );
};

export default ArtistDashboard;
