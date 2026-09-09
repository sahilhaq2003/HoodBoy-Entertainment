import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, FolderOpen, Megaphone, Clock, AlertCircle, Radio,
  CheckCircle, Briefcase
} from 'lucide-react';
import { dashboardApi } from '../services/api';
import { formatCurrency, formatNumber, formatDate } from '../utils/helpers';
import DashboardHero from '../components/ui/DashboardHero';
import StatCard from '../components/ui/StatCard';
import Card from '../components/ui/Card';
import StatusBadge from '../components/ui/StatusBadge';
import PerformanceSnapshot from '../components/dashboard/PerformanceSnapshot';

interface KPIs {
  myArtists: number;
  myProjects: number;
  myTasks: number;
  overdueTasks: number;
  tasksDueThisWeek: number;
  activeCampaigns: number;
}

interface Artist {
  name: string;
  stageName: string;
  status: string;
  totalStreams: number;
  totalRevenue: number;
  image: string;
}

interface Task {
  id: string;
  title: string;
  deadline: string;
  priority: string;
  status: string;
  artist: string;
}

interface UpcomingRelease {
  id: string;
  title: string;
  artist: string;
  releaseDate: string;
  status: string;
}

interface DashboardData {
  role: string;
  kpis: KPIs;
  artists: Artist[];
  tasks: Task[];
  upcomingReleases: UpcomingRelease[];
}

const ManagerDashboard: React.FC = () => {
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
          <p className="text-sm font-medium text-[var(--hbe-muted)]">Loading manager dashboard...</p>
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

  const { kpis, artists, tasks, upcomingReleases } = data;

  const activeArtists = artists.filter((a) => a.status === 'active').length;
  const taskHealth = kpis.myTasks > 0 ? Math.max(0, (1 - kpis.overdueTasks / kpis.myTasks) * 100) : 0;
  const weekFocus = kpis.myTasks > 0 ? (kpis.tasksDueThisWeek / kpis.myTasks) * 100 : 0;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">

      <DashboardHero
        eyebrow="Artist Management"
        title="Manager Dashboard"
        subtitle={`${kpis.myArtists} artists managed · ${kpis.myTasks} tasks assigned`}
        icon={<Briefcase size={22} />}
        accent="emerald"
        onRefresh={() => load(true)}
        refreshing={refreshing}
        stats={[
          { label: 'Overdue Tasks', value: kpis.overdueTasks, tone: kpis.overdueTasks > 0 ? 'down' : 'up' },
          { label: 'Due This Week', value: kpis.tasksDueThisWeek, tone: 'up' },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="My Artists" value={kpis.myArtists} icon={<Users size={19} />} color="#7C3AED" />
        <StatCard label="My Projects" value={kpis.myProjects} icon={<FolderOpen size={19} />} color="#0EA5E9" />
        <StatCard label="Active Campaigns" value={kpis.activeCampaigns} icon={<Megaphone size={19} />} color="#DB2777" />
      </div>

      <PerformanceSnapshot
        description="Ratios computed from your workload and roster"
        metrics={[
          { label: 'Task Health', value: taskHealth, color: kpis.overdueTasks > 0 ? '#7C3AED' : '#16A34A', note: `${kpis.overdueTasks} overdue` },
          { label: 'This Week Focus', value: weekFocus, color: '#0EA5E9', note: `${kpis.tasksDueThisWeek} due` },
          { label: 'Active Artists', value: artists.length > 0 ? (activeArtists / artists.length) * 100 : 0, color: '#16A34A', note: `${activeArtists} of ${artists.length}` },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <Card title="My Artists" icon={<Users size={16} />} accent="violet" badge={artists.length}>
          {artists.length === 0 ? (
            <div className="text-center py-8">
              <Users size={28} className="text-[var(--hbe-muted)] mx-auto mb-2" />
              <p className="text-xs text-[var(--hbe-muted)]">No artists assigned</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {artists.map((artist, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-(--hbe-line) bg-(--hbe-fill-soft) hover:bg-(--hbe-fill) transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    {artist.image ? (
                      <img src={artist.image} alt={artist.stageName || artist.name} className="w-10 h-10 rounded-[11px] object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-[11px] bg-[#7C3AED]/12 flex items-center justify-center shrink-0">
                        <Users size={16} className="text-[#8B5CF6]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--hbe-text)] truncate">{artist.stageName || artist.name}</p>
                      <div className="mt-1">
                        <StatusBadge status={artist.status} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 ml-3">
                    <div className="text-right">
                      <p className="text-xs font-bold text-[var(--hbe-text-soft)]">{formatNumber(artist.totalStreams)}</p>
                      <p className="text-[10px] text-[var(--hbe-muted)] mt-0.5">streams</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-[#16A34A]">{formatCurrency(artist.totalRevenue)}</p>
                      <p className="text-[10px] text-[var(--hbe-muted)] mt-0.5">revenue</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="My Tasks"
          icon={<Clock size={16} />}
          accent="amber"
          badge={kpis.overdueTasks}
        >
          {tasks.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle size={28} className="text-[var(--hbe-muted)] mx-auto mb-2" />
              <p className="text-xs text-[var(--hbe-muted)]">No tasks assigned</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1 -mr-1">
              {tasks.slice(0, 8).map((task) => (
                <div key={task.id} className="flex items-center justify-between p-3 rounded-xl border border-(--hbe-line) bg-(--hbe-fill-soft) hover:bg-(--hbe-fill) transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--hbe-text)] truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-[var(--hbe-muted)] flex items-center gap-1">
                        <Clock size={10} />
                        {formatDate(task.deadline)}
                      </span>
                      {task.artist && (
                        <span className="text-[11px] text-[var(--hbe-muted)]">{task.artist}</span>
                      )}
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

      <Card title="Upcoming Releases" icon={<Radio size={16} />} accent="sky" badge={upcomingReleases.length}>
        {upcomingReleases.length === 0 ? (
          <div className="text-center py-8">
            <Radio size={28} className="text-[var(--hbe-muted)] mx-auto mb-2" />
            <p className="text-xs text-[var(--hbe-muted)]">No upcoming releases</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="pb-3 pr-4">Title</th>
                  <th className="pb-3 pr-4">Artist</th>
                  <th className="pb-3 pr-4">Release Date</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--hbe-divide)">
                {upcomingReleases.map((release) => (
                  <tr key={release.id} className="transition-colors hover:bg-(--hbe-hover-fill)">
                    <td className="py-3 pr-4 text-sm font-semibold text-[var(--hbe-text)]">{release.title}</td>
                    <td className="py-3 pr-4 text-sm text-[var(--hbe-text-soft)]">{release.artist}</td>
                    <td className="py-3 pr-4 text-sm text-[var(--hbe-muted)]">{formatDate(release.releaseDate)}</td>
                    <td className="py-3">
                      <StatusBadge status={release.status} />
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

export default ManagerDashboard;