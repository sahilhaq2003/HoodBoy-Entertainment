import React, { useEffect, useState, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
  Users, Radio, Megaphone, DollarSign,
  AlertTriangle, CheckSquare,
  FileText, Activity, CalendarClock, ShieldAlert, User, TrendingUp, Download
} from 'lucide-react';
import { dashboardApi } from '../services/api';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import KPICard from '../components/dashboard/KPICard';
import ActivityFeed from '../components/dashboard/ActivityFeed';
import QuickActions from '../components/dashboard/QuickActions';
import DashboardHero from '../components/ui/DashboardHero';
import Card from '../components/ui/Card';
import { formatCurrency, formatNumber } from '../utils/helpers';

const COLORS = {
  coral: '#7C3AED',
  amber: '#F59E0B',
  sky: '#0EA5E9',
  emerald: '#16A34A',
  rose: '#DC2626',
  purple: '#7C3AED',
};

const PIE_COLORS = ['#7C3AED', '#F59E0B', '#16A34A', '#0EA5E9', '#DC2626', '#8B5CF6', '#EC4899', '#6B7280'];

const fmtCur = (v: number) => formatCurrency(Math.round(v));

interface UnifiedDashboard {
  kpis: {
    totalArtists: number;
    activeArtists: number;
    totalSongs: number;
    totalProjects: number;
    projectsInProduction: number;
    totalReleases: number;
    upcomingReleases: number;
    totalContracts: number;
    activeContracts: number;
    expiringContracts: number;
    totalRevenue: number;
    totalExpenses: number;
    profit: number;
    totalCampaigns: number;
    activeCampaigns: number;
    totalTasks: number;
    overdueTasks: number;
    tasksDueThisWeek: number;
    totalContacts: number;
  };
  financials: { name: string; revenue: number; expenses: number; profit: number }[];
  songStatus: Record<string, number>;
  recentTasks: { id: string; title: string; deadline: string; assignee?: string; priority: string; status: string }[];
  recentReleases: { id: string; title: string; artist?: string; releaseDate: string; status: string }[];
  recentContracts: { id: string; title: string; artist?: string; endDate: string }[];
  topArtists: { _id: string; name: string; stageName?: string; totalStreams?: number; totalRevenue?: number; image?: string }[];
  campaignPerformance: { _id: string; name: string; artist?: { name: string; stageName?: string }; budget?: number; spent?: number; reach?: number; impressions?: number; progress?: number }[];
  recentActivity: { id: string; action: string; entityType: string; entityName: string; userName?: string; details?: string; createdAt: string }[];
  deadlineTimeline: { id: string; title: string; deadline: string; assignee?: string; priority: string; status: string }[];
  contractAlerts: { id: string; title: string; artist?: string; endDate: string; daysLeft: number }[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="hbe-tooltip" style={{ minWidth: 170 }}>
        <p style={{ color: 'var(--hbe-muted)', fontWeight: 700, marginBottom: 8, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--hbe-line)', paddingBottom: 6 }}>{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4" style={{ padding: '2px 0' }}>
            <div className="flex items-center gap-2">
              <div style={{ width: 10, height: 10, borderRadius: 3, background: p.color }} />
              <span style={{ color: 'var(--hbe-muted)', textTransform: 'capitalize' }}>{p.name}:</span>
            </div>
            <span style={{ fontWeight: 800, color: 'var(--hbe-text)' }}>{formatCurrency(p.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const PieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div className="hbe-tooltip">
        <div className="flex items-center gap-2">
          <div style={{ width: 10, height: 10, borderRadius: 3, background: item.payload.fill }} />
          <span style={{ color: 'var(--hbe-muted)' }}>{item.name}:</span>
        </div>
        <span style={{ fontWeight: 800, color: 'var(--hbe-text)' }}>{item.value}</span>
      </div>
    );
  }
  return null;
};

const Dashboard: React.FC = () => {
  const [data, setData] = useState<UnifiedDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await dashboardApi.getUnified();
      setData(res.data.data);
      setError(null);
    } catch (err: any) {
      console.error('Dashboard load error:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const exportCSV = () => {
    if (!data || !data.financials.length) return;
    const header = ['Month', 'Revenue', 'Expenses', 'Profit'];
    const rows = data.financials.map((r) => `"${r.name}",${r.revenue},${r.expenses},${r.profit}`);
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hbe-revenue-report.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size={36} text="Loading unified dashboard..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-3">
          <AlertTriangle size={40} className="text-[#DC2626] mx-auto" />
          <p className="text-sm font-semibold text-[var(--hbe-text-soft)]">{error || 'No data available'}</p>
        </div>
      </div>
    );
  }

  const { kpis, financials, songStatus, recentReleases, recentContracts, topArtists, campaignPerformance } = data;
  const recentActivity = (data as any).recentActivity || [];
  const deadlineTimeline = (data as any).deadlineTimeline || [];
  const contractAlerts = (data as any).contractAlerts || [];

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const allActivity = [
    ...deadlineTimeline.map((t: any) => ({ id: t.id, title: t.title, date: t.deadline, type: 'task' as const, assignee: t.assignee, priority: t.priority })),
    ...recentReleases.map(r => ({ id: r.id, title: r.title, date: r.releaseDate, type: 'release' as const, artist: r.artist, status: r.status })),
    ...recentContracts.map(c => ({ id: c.id, title: c.title, date: c.endDate, type: 'contract' as const, artist: c.artist })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const songPieData = Object.entries(songStatus).map(([name, value]) => ({
    name: name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
    value,
  }));

  const revenueSpark = financials.map((f) => f.revenue);
  const profitSpark = financials.map((f) => f.profit);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">

      <DashboardHero
        eyebrow="Unified Command Dashboard"
        title="Welcome back"
        subtitle={`${today} — ${kpis.overdueTasks} overdue tasks and ${kpis.expiringContracts} expiring contracts need your attention.`}
        icon={<TrendingUp size={22} />}
        accent="coral"
        onRefresh={() => load(true)}
        refreshing={refreshing}
        actions={
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-(--hbe-line) bg-(--hbe-fill-soft) hover:border-[#C4B5FD] hover:bg-(--hbe-fill) text-[12px] font-semibold text-[var(--hbe-text-soft)] hover:text-[var(--hbe-text)] transition-all"
          >
            <Download size={13} style={{ color: '#16A34A' }} />
            Export
          </button>
        }
        stats={[
          { label: 'Revenue YTD', value: fmtCur(kpis.totalRevenue), tone: 'up' },
          { label: 'Net Profit', value: `${kpis.profit >= 0 ? '+' : ''}${fmtCur(kpis.profit)}`, tone: kpis.profit >= 0 ? 'up' : 'down' },
        ]}
      />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          title="Active Artists"
          value={kpis.activeArtists}
          icon={<Users size={18} />}
          color={COLORS.coral}
          change={`${kpis.totalArtists} total`}
          changeType="neutral"
        />
        <KPICard
          title="Revenue YTD"
          value={kpis.totalRevenue}
          format={fmtCur}
          icon={<DollarSign size={18} />}
          color={COLORS.emerald}
          change={kpis.profit >= 0 ? `+${fmtCur(kpis.profit)} profit` : `${fmtCur(Math.abs(kpis.profit))} loss`}
          changeType={kpis.profit >= 0 ? 'up' : 'down'}
          subtitle={`${fmtCur(kpis.totalExpenses)} expenses`}
          sparkline={revenueSpark.length >= 2 ? revenueSpark : undefined}
        />
        <KPICard
          title="Active Releases"
          value={kpis.totalReleases}
          icon={<Radio size={18} />}
          color={COLORS.amber}
          change={`${kpis.upcomingReleases} upcoming`}
          changeType="up"
          subtitle="in next 30 days"
        />
        <KPICard
          title="Active Contracts"
          value={kpis.activeContracts}
          icon={<FileText size={18} />}
          color={COLORS.sky}
          change={kpis.expiringContracts > 0 ? `${kpis.expiringContracts} expiring` : 'All stable'}
          changeType={kpis.expiringContracts > 0 ? 'down' : 'neutral'}
          subtitle={`${kpis.totalContracts} total`}
        />
        <KPICard
          title="Active Campaigns"
          value={kpis.activeCampaigns}
          icon={<Megaphone size={18} />}
          color={COLORS.purple}
          change={`${kpis.totalCampaigns} total`}
          changeType="neutral"
        />
        <KPICard
          title="Open Tasks"
          value={kpis.totalTasks - kpis.overdueTasks}
          icon={<CheckSquare size={18} />}
          color={COLORS.coral}
          change={kpis.overdueTasks > 0 ? `${kpis.overdueTasks} overdue` : 'All on track'}
          changeType={kpis.overdueTasks > 0 ? 'down' : 'up'}
          subtitle={`${kpis.tasksDueThisWeek} due this week`}
          sparkline={profitSpark.length >= 2 ? profitSpark : undefined}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Revenue vs Expenses Area Chart */}
        <Card
          title="Revenue vs Expenses"
          description="Monthly financial performance"
          icon={<TrendingUp size={16} />}
          accent="coral"
          className="xl:col-span-2"
          action={
            <div className="flex items-center gap-4 text-[11px] font-semibold">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.coral }} /><span className="text-[var(--hbe-muted)]">Revenue</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.rose }} /><span className="text-[var(--hbe-muted)]">Expenses</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.emerald }} /><span className="text-[var(--hbe-muted)]">Profit</span></div>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={financials} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
              <defs>
                <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.coral} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={COLORS.coral} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.rose} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={COLORS.rose} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.emerald} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={COLORS.emerald} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--hbe-line)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--hbe-muted)', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: 'var(--hbe-muted)', fontSize: 11, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : `$${(v/1000).toFixed(0)}k`}
                width={62}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke={COLORS.coral} fill="url(#gradRevenue)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 2 }} />
              <Area type="monotone" dataKey="expenses" name="Expenses" stroke={COLORS.rose} fill="url(#gradExpenses)" strokeWidth={2.5} dot={false} />
              <Area type="monotone" dataKey="profit" name="Profit" stroke={COLORS.emerald} fill="url(#gradProfit)" strokeWidth={2.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Song Status Pie Chart */}
        <Card
          title="Song Status"
          description={`${kpis.totalSongs} songs across all stages`}
          icon={<Radio size={16} />}
          accent="emerald"
        >
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={songPieData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={4} dataKey="value" animationBegin={150} animationDuration={900}>
                {songPieData.map((_, index) => (
                  <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 pt-4 border-t border-(--hbe-line-soft)">
            {songPieData.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-[var(--hbe-text-soft)] font-semibold">{item.name}</span>
                </div>
                <span className="text-[var(--hbe-text)] font-bold px-2 py-0.5 rounded-md bg-(--hbe-fill)">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Activity Row - 3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Upcoming Deadlines Activity Feed */}
        <ActivityFeed items={allActivity} title="Upcoming Deadlines" />

        {/* Top Artists */}
        <Card title="Top Artists" description="By streams and revenue" icon={<Users size={16} />} accent="emerald" badge={topArtists.length}>
          {topArtists.length === 0 ? (
            <p className="text-xs text-[var(--hbe-muted)] text-center py-8">No active artists</p>
          ) : (
            <div className="space-y-1.5">
              {topArtists.map((artist, idx) => (
                <div key={artist._id} className="flex items-center gap-3 p-2.5 rounded-xl transition-colors hover:bg-(--hbe-hover-fill)" style={{ animationDelay: `${idx * 60}ms` }}>
                  {artist.image ? (
                    <img src={artist.image} alt={artist.stageName || artist.name} className="w-8 h-8 rounded-[10px] object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-[10px] flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: 'linear-gradient(135deg,#7C3AED,#0EA5E9)' }}>
                      {(artist.stageName || artist.name).charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-[var(--hbe-text)] truncate">{artist.stageName || artist.name}</div>
                    <div className="text-[10px] text-[var(--hbe-muted)] mt-0.5">{formatNumber(artist.totalStreams || 0)} streams</div>
                  </div>
                  <div className="text-xs font-bold text-[#16A34A]">{formatCurrency(artist.totalRevenue || 0)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Campaign Performance */}
        <Card title="Campaign Performance" description="Budget spend and reach" icon={<Megaphone size={16} />} accent="rose" badge={campaignPerformance.length}>
          {campaignPerformance.length === 0 ? (
            <p className="text-xs text-[var(--hbe-muted)] text-center py-8">No active campaigns</p>
          ) : (
            <div className="space-y-4">
              {campaignPerformance.map((campaign) => {
                const progress = campaign.progress || 0;
                return (
                  <div key={campaign._id}>
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[var(--hbe-text)] truncate">{campaign.name}</div>
                        <div className="text-[10px] text-[var(--hbe-muted)] mt-0.5">{campaign.artist?.stageName || campaign.artist?.name}</div>
                      </div>
                      <span className="text-xs font-bold" style={{ color: COLORS.coral }}>{progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-(--hbe-fill) rounded-full mt-2">
                      <div
                        className="h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(progress, 100)}%`, background: 'linear-gradient(90deg,#7C3AED,#7C3AED)' }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[var(--hbe-muted)] mt-1.5">
                      <span>Budget: {formatCurrency(campaign.budget || 0)}</span>
                      <span>Spent: {formatCurrency(campaign.spent || 0)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Activity Timeline & Contract Alerts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Activity Timeline */}
        <Card
          title="Activity Timeline"
          icon={<Activity size={16} />}
          accent="coral"
          badge={Math.min(recentActivity.length, 10)}
        >
          {recentActivity.length === 0 ? (
            <p className="text-xs text-[var(--hbe-muted)] text-center py-8">No recent activity</p>
          ) : (
            <div>
              {recentActivity.slice(0, 10).map((activity: any, i: number) => {
                const actionColors: Record<string, string> = {
                  create: '#16A34A', update: '#F59E0B', delete: '#DC2626',
                  calculate: '#0EA5E9', approve: '#7C3AED', submit: '#0EA5E9',
                };
                const dotColor = actionColors[activity.action] || '#6B7280';
                return (
                  <div key={activity.id} className="flex gap-3 relative">
                    {i < Math.min(recentActivity.length, 10) - 1 && (
                      <span className="absolute left-[5px] top-5 bottom-0 w-px" style={{ background: 'var(--hbe-line)' }} />
                    )}
                    <span className="w-3 h-3 rounded-full shrink-0 mt-1.5 z-10" style={{ background: dotColor, boxShadow: `0 0 0 3px ${dotColor}26` }} />
                    <div className="flex-1 pb-3.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold text-[var(--hbe-text)] capitalize">{activity.action}</span>
                        <span className="text-[11px] text-[var(--hbe-muted)]">{activity.entityType}</span>
                      </div>
                      <div className="text-xs text-[var(--hbe-text-soft)] font-medium truncate">{activity.entityName}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {activity.userName && (
                          <span className="text-[10px] text-[var(--hbe-muted)] inline-flex items-center gap-1">
                            <User size={10} />{activity.userName}
                          </span>
                        )}
                        <span className="text-[10px] text-[var(--hbe-muted)]">
                          {new Date(activity.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Contract Expiration Alerts */}
        <Card
          title="Contract Alerts"
          icon={<ShieldAlert size={16} />}
          accent="amber"
          badge={contractAlerts.length}
        >
          {contractAlerts.length === 0 ? (
            <div className="text-center py-8">
              <CalendarClock size={28} className="text-[var(--hbe-muted)] mx-auto mb-2" />
              <p className="text-xs text-[var(--hbe-muted)]">No contracts expiring soon</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contractAlerts.map((contract: any) => {
                const critical = contract.daysLeft <= 30;
                return (
                  <div
                    key={contract.id}
                    className="flex items-center gap-3 p-3.5 rounded-xl border"
                    style={{
                      background: critical ? 'rgba(220,38,38,0.07)' : 'rgba(245,158,11,0.06)',
                      borderColor: critical ? 'rgba(220,38,38,0.2)' : 'rgba(245,158,11,0.16)',
                    }}
                  >
                    <div
                      className="flex items-center justify-center rounded-[11px] shrink-0"
                      style={{
                        width: 40, height: 40,
                        background: critical ? 'rgba(220,38,38,0.14)' : 'rgba(245,158,11,0.13)',
                        color: critical ? '#DC2626' : '#D97706',
                      }}
                    >
                      <CalendarClock size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-[var(--hbe-text)] truncate">{contract.title}</div>
                      <div className="text-[11px] text-[var(--hbe-muted)] mt-0.5">{contract.artist}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-black" style={{ color: critical ? '#DC2626' : '#F59E0B' }}>{contract.daysLeft}d</div>
                      <div className="text-[10px] text-[var(--hbe-muted)] mt-0.5">remaining</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-[15px] font-bold text-[var(--hbe-text)] mb-3">Quick Actions</h3>
        <QuickActions />
      </div>

    </div>
  );
};

export default Dashboard;