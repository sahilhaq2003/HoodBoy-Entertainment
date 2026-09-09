import React, { useEffect, useState } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import {
  Activity, AlertCircle, DollarSign, FileText, Radio, TrendingUp, Users,
  Clock, FolderOpen, Megaphone, Calendar, CheckCircle2, AlertTriangle,
  Target, Zap, FileWarning, TrendingDown,
} from 'lucide-react';
import { dashboardApi } from '../services/api';
import { formatCurrency, formatDate, formatNumber } from '../utils/helpers';
import DashboardHero from '../components/ui/DashboardHero';
import StatCard from '../components/ui/StatCard';
import Card from '../components/ui/Card';
import ProgressRing from '../components/ui/ProgressRing';

const PIE_COLORS = ['#7C3AED', '#16A34A', '#0EA5E9', '#F59E0B', '#EC4899', '#EF4444'];

const CustomPieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--hbe-border)] bg-[var(--hbe-panel)] px-3 py-2 shadow-lg text-xs">
      <span className="font-semibold text-[var(--hbe-text)]">{payload[0].name}</span>
      <span className="ml-2 font-bold" style={{ color: payload[0].payload.fill }}>{payload[0].value}</span>
    </div>
  );
};

const AdminDashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    dashboardApi.getRoleDashboard()
      .then(response => setData(response.data.data))
      .catch(err => setError(err.response?.data?.message || 'Failed to load dashboard'));
  }, []);

  if (error) return (
    <div className="flex h-96 items-center justify-center text-sm text-red-400">
      <AlertCircle className="mr-2" size={18} />{error}
    </div>
  );

  if (!data) return (
    <div className="flex h-96 items-center justify-center">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--hbe-accent)] border-t-transparent" />
    </div>
  );

  const {
    kpis, projectNextActions = [], attentionItems = [], upcomingReleaseSchedule = [],
    campaignStatus = [], recentActivity = [], contractAlerts = [], topArtists = [],
    approvalQueue = [],
  } = data;

  const revenue = kpis.totalRevenue || 0;
  const expenses = kpis.totalExpenses || 0;
  const profit = kpis.profit || 0;

  const financialPieData = [
    { name: 'Revenue', value: revenue || 0 },
    { name: 'Expenses', value: expenses || 0 },
  ].filter(d => d.value > 0);

  const taskPieData = [
    { name: 'Overdue', value: kpis.overdueTasks || 0 },
    { name: 'Due this week', value: kpis.tasksDueThisWeek || 0 },
    { name: 'Total active', value: Math.max(0, (kpis.totalTasks || 0) - (kpis.overdueTasks || 0) - (kpis.tasksDueThisWeek || 0)) },
  ].filter(d => d.value > 0);

  const artistActive = kpis.activeArtists || 0;
  const artistInactive = Math.max(0, (kpis.totalArtists || 0) - artistActive);
  const artistPieData = [
    { name: 'Active', value: artistActive },
    { name: 'Inactive', value: artistInactive },
  ].filter(d => d.value > 0);

  const healthPercent = kpis.totalTasks > 0 ? Math.round(((kpis.totalTasks - kpis.overdueTasks) / kpis.totalTasks) * 100) : 100;
  const approvalPercent = kpis.totalTasks > 0 ? Math.round(((kpis.totalTasks - kpis.pendingApprovals) / kpis.totalTasks) * 100) : 100;
  const artistPercent = kpis.totalArtists > 0 ? Math.round((artistActive / kpis.totalArtists) * 100) : 100;
  const contractPercent = kpis.totalContracts > 0 ? Math.round(((kpis.totalContracts - kpis.expiringContracts) / kpis.totalContracts) * 100) : 100;

  const monthlyBarData = upcomingReleaseSchedule.slice(0, 6).map((r: any) => ({
    name: r.title?.length > 12 ? r.title.slice(0, 12) + '…' : r.title,
    daysLeft: Math.max(0, Math.ceil((new Date(r.releaseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))),
  }));

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 pb-12">
      {/* Hero */}
      <DashboardHero
        title="Label performance overview"
        eyebrow="Executive command"
        subtitle="Live operational data across the label"
        actions={
          <div className="flex gap-2">
            {kpis.criticalIssues > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[10px] font-semibold text-red-500">
                <Zap size={10} />{kpis.criticalIssues} critical
              </span>
            )}
            {kpis.pendingApprovals > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[10px] font-semibold text-amber-500">
                <Clock size={10} />{kpis.pendingApprovals} approvals
              </span>
            )}
          </div>
        }
      />

      {/* Row 1 — KPI Stat Cards */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total revenue"
          value={formatCurrency(revenue)}
          icon={<DollarSign size={18} />}
          color="#7C3AED"
          trendNote={`${formatCurrency(expenses)} expenses`}
        />
        <StatCard
          label="Net profit"
          value={formatCurrency(profit)}
          icon={<TrendingUp size={18} />}
          color="#16A34A"
          trendNote={profit >= 0 ? 'Positive margin' : 'Operating at a loss'}
        />
        <StatCard
          label="Active artists"
          value={artistActive}
          icon={<Users size={18} />}
          color="#0EA5E9"
          trendNote={`${kpis.totalArtists || 0} total · ${kpis.totalSongs || 0} songs`}
        />
        <StatCard
          label="Upcoming releases"
          value={kpis.upcomingReleases || 0}
          icon={<Radio size={18} />}
          color="#F59E0B"
          trendNote={`${kpis.totalReleases || 0} total · ${kpis.activeContracts || 0} contracts`}
        />
      </section>

      {/* Row 2 — Performance Rings + Financial Pie */}
      <section className="grid gap-5 xl:grid-cols-12">
        <Card
          title="Performance overview"
          description="Key health metrics at a glance"
          icon={<Activity size={16} />}
          accent="violet"
          className="xl:col-span-7"
          hover={false}
        >
          <div className="grid grid-cols-4 gap-4 py-2">
            {[
              { label: 'Task health', value: healthPercent, color: '#16A34A' },
              { label: 'On track', value: approvalPercent, color: '#7C3AED' },
              { label: 'Artists active', value: artistPercent, color: '#0EA5E9' },
              { label: 'Contract health', value: contractPercent, color: '#F59E0B' },
            ].map(ring => (
              <div key={ring.label} className="flex flex-col items-center gap-2">
                <ProgressRing value={ring.value} size={72} strokeWidth={7} color={ring.color} />
                <span className="text-[11px] font-medium text-[var(--hbe-muted)] text-center leading-tight">{ring.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-4 gap-3">
            {[
              { label: 'Total tasks', value: kpis.totalTasks || 0, icon: <CheckCircle2 size={13} />, color: '#7C3AED' },
              { label: 'Overdue tasks', value: kpis.overdueTasks || 0, icon: <AlertTriangle size={13} />, color: '#EF4444' },
              { label: 'Active projects', value: kpis.projectsInProduction || 0, icon: <FolderOpen size={13} />, color: '#0EA5E9' },
              { label: 'Active campaigns', value: kpis.activeCampaigns || 0, icon: <Target size={13} />, color: '#EC4899' },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-[var(--hbe-border-soft)] bg-[var(--hbe-fill-soft)] p-3 text-center">
                <div className="mx-auto mb-1.5 flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: `${s.color}14`, color: s.color }}>
                  {s.icon}
                </div>
                <p className="text-lg font-bold text-[var(--hbe-text)]">{s.value}</p>
                <p className="text-[10px] text-[var(--hbe-muted)]">{s.label}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Financial breakdown"
          description="Revenue vs expenses this year"
          icon={<DollarSign size={16} />}
          accent="violet"
          className="xl:col-span-5"
          hover={false}
        >
          {financialPieData.length > 0 ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={financialPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {financialPieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex items-center gap-5 text-[11px]">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE_COLORS[0] }} /><span className="text-[var(--hbe-muted)]">Revenue</span> <span className="font-bold text-[var(--hbe-text)]">{formatCurrency(revenue)}</span></span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE_COLORS[1] }} /><span className="text-[var(--hbe-muted)]">Expenses</span> <span className="font-bold text-[var(--hbe-text)]">{formatCurrency(expenses)}</span></span>
              </div>
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center text-xs text-[var(--hbe-muted)]">No financial data yet</div>
          )}
        </Card>
      </section>

      {/* Row 3 — Tasks Donut + Artist Donut + Approvals */}
      <section className="grid gap-5 lg:grid-cols-12">
        <Card
          title="Task distribution"
          icon={<AlertCircle size={16} />}
          accent="rose"
          className="lg:col-span-4"
          hover={false}
        >
          {taskPieData.length > 0 ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={taskPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={72}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {taskPieData.map((_, i) => (
                      <Cell key={i} fill={[('#EF4444'), ('#F59E0B'), ('#7C3AED')][i % 3]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-1 space-y-1.5 text-[11px]">
                {[
                  { label: 'Overdue', count: kpis.overdueTasks, color: '#EF4444' },
                  { label: 'Due this week', count: kpis.tasksDueThisWeek, color: '#F59E0B' },
                  { label: 'On track', count: Math.max(0, (kpis.totalTasks || 0) - (kpis.overdueTasks || 0) - (kpis.tasksDueThisWeek || 0)), color: '#7C3AED' },
                ].filter(d => d.count > 0).map(d => (
                  <div key={d.label} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: d.color }} /><span className="text-[var(--hbe-muted)]">{d.label}</span></span>
                    <span className="font-bold text-[var(--hbe-text)]">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center text-xs text-[var(--hbe-muted)]">No tasks yet</div>
          )}
        </Card>

        <Card
          title="Artist roster"
          icon={<Users size={16} />}
          accent="sky"
          className="lg:col-span-4"
          hover={false}
        >
          {artistPieData.length > 0 ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={artistPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={72}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    <Cell fill="#0EA5E9" />
                    <Cell fill="#CBD5E1" />
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-1 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#0EA5E9]" /><span className="text-[var(--hbe-muted)]">Active</span></span>
                  <span className="font-bold text-[var(--hbe-text)]">{artistActive}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gray-300" /><span className="text-[var(--hbe-muted)]">Inactive</span></span>
                  <span className="font-bold text-[var(--hbe-text)]">{artistInactive}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center text-xs text-[var(--hbe-muted)]">No artists yet</div>
          )}
        </Card>

        <Card
          title="Approval queue"
          description="Pending items requiring review"
          icon={<Clock size={16} />}
          accent="amber"
          className="lg:col-span-4"
          hover={false}
        >
          <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1">
            {approvalQueue.length > 0 ? approvalQueue.slice(0, 6).map((item: any) => (
              <div key={`${item.type}-${item.id}`} className="rounded-xl border border-[var(--hbe-border-soft)] bg-[var(--hbe-fill-soft)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[var(--hbe-text)]">{item.title}</p>
                    <p className="mt-1 truncate text-[10px] text-[var(--hbe-muted)]">{item.owner} · {item.context}</p>
                  </div>
                  <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider"
                    style={{
                      background: item.type === 'task' ? 'rgba(124,58,237,0.1)' : item.type === 'song' ? 'rgba(236,72,153,0.1)' : 'rgba(14,165,233,0.1)',
                      color: item.type === 'task' ? '#7C3AED' : item.type === 'song' ? '#EC4899' : '#0EA5E9',
                    }}
                  >
                    {item.type}
                  </span>
                </div>
              </div>
            )) : (
              <div className="flex h-40 items-center justify-center text-xs text-[var(--hbe-muted)]">
                <CheckCircle2 size={16} className="mr-1.5 opacity-40" />All clear — nothing pending
              </div>
            )}
          </div>
        </Card>
      </section>

      {/* Row 4 — Project Momentum + Needs Attention */}
      <section className="grid gap-5 xl:grid-cols-12">
        <Card
          title="Project momentum"
          description="Progress, owners and next deadlines"
          icon={<FolderOpen size={16} />}
          accent="violet"
          className="xl:col-span-7"
          hover={false}
        >
          <div className="divide-y divide-[var(--hbe-divide)]">
            {projectNextActions.slice(0, 6).map((p: any) => (
              <div key={p.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-[var(--hbe-text)]">{p.title}</span>
                  <span className="font-semibold text-[var(--hbe-accent)]">{p.progress}%</span>
                </div>
                <p className="mt-2 text-[11px] text-[var(--hbe-muted)]">Next: {p.nextAction} · {p.owner}</p>
                <div className="mt-3 h-1.5 rounded-full bg-[var(--hbe-fill)]">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(p.progress, 100)}%`,
                      background: p.progress >= 80 ? '#16A34A' : p.progress >= 40 ? '#7C3AED' : '#F59E0B',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Needs attention"
          description="Late, blocked or at-risk work"
          icon={<AlertCircle size={16} />}
          accent="rose"
          className="xl:col-span-5"
          hover={false}
        >
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {attentionItems.slice(0, 8).map((item: any) => (
              <div key={`${item.type}-${item.id}`} className="rounded-xl border border-[var(--hbe-border-soft)] bg-[var(--hbe-fill-soft)] p-3">
                <div className="flex justify-between gap-3">
                  <p className="truncate text-xs font-semibold text-[var(--hbe-text)]">{item.title}</p>
                  <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-red-500">
                    <AlertTriangle size={8} />{item.overdue ? 'Overdue' : item.status}
                  </span>
                </div>
                <p className="mt-1.5 truncate text-[10px] text-[var(--hbe-muted)]">{item.context} · {item.owner}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Row 5 — Releases + Campaigns + Activity */}
      <section className="grid gap-5 lg:grid-cols-3">
        <Card
          title="Release schedule"
          icon={<Radio size={16} />}
          accent="sky"
          hover={false}
        >
          <div className="space-y-3">
            {upcomingReleaseSchedule.slice(0, 5).map((r: any) => {
              const daysLeft = Math.max(0, Math.ceil((new Date(r.releaseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
              return (
                <div key={r.id} className="flex items-center justify-between border-b border-[var(--hbe-divide)] pb-3 text-xs last:border-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-[var(--hbe-text)]">{r.title}</span>
                    <span className="block text-[10px] text-[var(--hbe-muted)] mt-0.5">{r.artist}</span>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <span className="block text-[var(--hbe-muted)]">{formatDate(r.releaseDate)}</span>
                    <span className={`block text-[10px] font-semibold mt-0.5 ${daysLeft <= 7 ? 'text-red-500' : daysLeft <= 14 ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {daysLeft}d left
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card
          title="Campaign runway"
          icon={<Megaphone size={16} />}
          accent="amber"
          hover={false}
        >
          <div className="space-y-4">
            {campaignStatus.slice(0, 5).map((c: any) => (
              <div key={c.id}>
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-[var(--hbe-text)]">{c.title}</span>
                  <span className="font-semibold text-[var(--hbe-accent)]">{c.progress}%</span>
                </div>
                <div className="mt-1.5 text-[10px] text-[var(--hbe-muted)]">
                  {formatCurrency(c.spent)} spent / {formatCurrency(c.budget)} budget
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-[var(--hbe-fill)]">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(c.progress, 100)}%`,
                      background: c.progress >= 80 ? '#16A34A' : c.progress >= 40 ? '#F59E0B' : '#7C3AED',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Recent activity"
          icon={<Activity size={16} />}
          accent="emerald"
          hover={false}
        >
          <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
            {recentActivity.slice(0, 8).map((a: any) => {
              const timeAgo = (() => {
                const diff = Date.now() - new Date(a.createdAt).getTime();
                const mins = Math.floor(diff / 60000);
                if (mins < 60) return `${mins}m ago`;
                const hrs = Math.floor(mins / 60);
                if (hrs < 24) return `${hrs}h ago`;
                return `${Math.floor(hrs / 24)}d ago`;
              })();
              return (
                <div key={a.id} className="flex items-start gap-3">
                  <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--hbe-accent)]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-[var(--hbe-muted)] leading-relaxed">
                      <span className="font-semibold text-[var(--hbe-text)]">{a.userName}</span>{' '}
                      {a.action}{' '}
                      <span className="font-medium text-[var(--hbe-text-soft)]">{a.entityName}</span>
                    </p>
                    <span className="text-[9px] text-[var(--hbe-muted)]">{timeAgo}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      {/* Row 6 — Contract Alerts + Portfolio Table */}
      <section className="grid gap-5 xl:grid-cols-12">
        {contractAlerts.length > 0 && (
          <Card
            title="Contract alerts"
            description="Expiring within 90 days"
            icon={<FileWarning size={16} />}
            accent="rose"
            className="xl:col-span-4"
            badge={contractAlerts.length}
            hover={false}
          >
            <div className="space-y-2">
              {contractAlerts.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl border border-[var(--hbe-border-soft)] bg-[var(--hbe-fill-soft)] p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[var(--hbe-text)]">{c.artist}</p>
                    <p className="mt-0.5 text-[10px] text-[var(--hbe-muted)]">{c.title}</p>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <span className={`text-[10px] font-bold ${c.daysLeft <= 14 ? 'text-red-500' : 'text-amber-500'}`}>
                      {c.daysLeft}d
                    </span>
                    <p className="text-[9px] text-[var(--hbe-muted)]">left</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card
          title="Portfolio snapshot"
          icon={<FileText size={16} />}
          accent="slate"
          className={contractAlerts.length > 0 ? 'xl:col-span-8' : 'xl:col-span-12'}
          hover={false}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-[var(--hbe-muted)]">
                  <th className="pb-3 font-semibold">Artist</th>
                  <th className="pb-3 text-right font-semibold">Streams</th>
                  <th className="pb-3 text-right font-semibold">Revenue</th>
                  <th className="pb-3 text-right font-semibold">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--hbe-divide)]">
                {topArtists.map((a: any, i: number) => {
                  const totalRev = topArtists.reduce((s: number, x: any) => s + (x.totalRevenue || 0), 0);
                  const share = totalRev > 0 ? ((a.totalRevenue / totalRev) * 100).toFixed(1) : '0';
                  return (
                    <tr key={a._id} className="hover:bg-[var(--hbe-fill-soft)] transition-colors">
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold text-white" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}>
                            {(a.stageName || a.name)?.charAt(0)}
                          </div>
                          <span className="text-xs font-semibold text-[var(--hbe-text)]">{a.stageName || a.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right text-xs text-[var(--hbe-muted)]">{formatNumber(a.totalStreams)}</td>
                      <td className="py-3 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(a.totalRevenue)}</td>
                      <td className="py-3 text-right">
                        <span className="text-[10px] font-bold text-[var(--hbe-muted)]">{share}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
};

export default AdminDashboard;
