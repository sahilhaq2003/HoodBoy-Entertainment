import React, { useEffect, useState, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis
} from 'recharts';
import { TrendingUp, TrendingDown, Music, Users, DollarSign, Disc, FileText, CheckSquare, Activity, Target, BarChart3, ArrowUpRight, ArrowDownRight, Download, LayoutDashboard, Wallet, Megaphone, Calculator } from 'lucide-react';
import toast from 'react-hot-toast';
import { analyticsApi } from '../services/api';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ExecutiveDashboard from '../components/analytics/ExecutiveDashboard';
import ArtistPerformance from '../components/analytics/ArtistPerformance';
import ReleasePerformance from '../components/analytics/ReleasePerformance';
import FinancialAnalytics from '../components/analytics/FinancialAnalytics';
import MarketingAnalytics from '../components/analytics/MarketingAnalytics';
import AnalyticsFilters, { AnalyticsFiltersState } from '../components/analytics/AnalyticsFilters';

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#8B5CF6', '#EC4899', '#14B8A6'];

interface TooltipPayloadItem {
  dataKey: string;
  name: string;
  value: number | string;
  color: string;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-4 py-3 rounded-xl text-sm border border-gray-200 shadow-xl">
        <p className="text-gray-500 mb-2 font-semibold">{label}</p>
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-600">{p.name}:</span>
            <span className="text-gray-900 font-bold">
              {typeof p.value === 'number' && p.value > 10000
                ? `$${(p.value/1000).toFixed(1)}k`
                : typeof p.value === 'number'
                  ? p.value.toLocaleString()
                  : p.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const fmtCurrency = (v: number) => {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toLocaleString()}`;
};

const fmtNum = (v: number) => {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v.toLocaleString();
};

const TrendBadge = ({ value, invert }: { value: number; invert?: boolean }) => {
  const positive = invert ? value < 0 : value > 0;
  const color = positive ? 'text-emerald-600' : value === 0 ? 'text-gray-500' : 'text-red-500';
  const bg = positive ? 'bg-emerald-50' : value === 0 ? 'bg-gray-50' : 'bg-red-50';
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${color} ${bg}`}>
      <Icon size={12} />
      {Math.abs(value)}%
    </span>
  );
};

const DEFAULT_FILTERS: AnalyticsFiltersState = {
  startDate: '',
  endDate: '',
  artistId: '',
  releaseId: '',
  campaignType: '',
  period: '',
  revenueSource: '',
};

const Analytics: React.FC = () => {
  const [activeTab, setActiveTab] = useState('executive');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [artists, setArtists] = useState<any>(null);
  const [releaseData, setReleaseData] = useState<any>(null);
  const [operational, setOperational] = useState<any>(null);
  const [kpis, setKpis] = useState<any>(null);
  // System 14: Enhanced analytics data
  const [executive, setExecutive] = useState<any>(null);
  const [artistPerf, setArtistPerf] = useState<any>(null);
  const [releasePerf, setReleasePerf] = useState<any>(null);
  const [financial, setFinancial] = useState<any>(null);
  const [marketing, setMarketing] = useState<any>(null);
  const [filters, setFilters] = useState<AnalyticsFiltersState>(DEFAULT_FILTERS);
  const [exporting, setExporting] = useState(false);

  const tabs = [
    { id: 'executive', label: 'Executive', icon: LayoutDashboard },
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'revenue', label: 'Revenue', icon: DollarSign },
    { id: 'artists', label: 'Artists', icon: Users },
    { id: 'artist-performance', label: 'Artist Performance', icon: Users },
    { id: 'releases', label: 'Releases', icon: Disc },
    { id: 'release-performance', label: 'Release Performance', icon: Disc },
    { id: 'financial', label: 'Financial', icon: Calculator },
    { id: 'marketing', label: 'Marketing', icon: Megaphone },
    { id: 'operations', label: 'Operations', icon: CheckSquare },
    { id: 'kpis', label: 'KPIs', icon: Target },
  ];

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [ov, rv, ar, rl, op, kp, ex] = await Promise.all([
          analyticsApi.getOverview(),
          analyticsApi.getRevenue(),
          analyticsApi.getArtists(),
          analyticsApi.getReleases(),
          analyticsApi.getOperational(),
          analyticsApi.getKPIs(),
          analyticsApi.getExecutive(),
        ]);
        setOverview(ov.data.data);
        setRevenue(rv.data.data);
        setArtists(ar.data.data);
        setReleaseData(rl.data.data);
        setOperational(op.data.data);
        setKpis(kp.data.data);
        setExecutive(ex.data.data);
      } catch {
        toast.error('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  // Load filtered data when tab changes or filters change
  useEffect(() => {
    const loadTabData = async () => {
      if (activeTab === 'artist-performance') {
        try {
          const params: any = {};
          if (filters.artistId) params.artistId = filters.artistId;
          if (filters.period) params.period = filters.period;
          if (filters.startDate) params.startDate = filters.startDate;
          if (filters.endDate) params.endDate = filters.endDate;
          const res = await analyticsApi.getArtistPerformance(params);
          setArtistPerf(res.data.data);
        } catch { toast.error('Failed to load artist performance'); }
      } else if (activeTab === 'release-performance') {
        try {
          const params: any = {};
          if (filters.artistId) params.artistId = filters.artistId;
          if (filters.startDate) params.startDate = filters.startDate;
          if (filters.endDate) params.endDate = filters.endDate;
          const res = await analyticsApi.getReleasePerformance(params);
          setReleasePerf(res.data.data);
        } catch { toast.error('Failed to load release performance'); }
      } else if (activeTab === 'financial') {
        try {
          const res = await analyticsApi.getFinancial();
          setFinancial(res.data.data);
        } catch { toast.error('Failed to load financial analytics'); }
      } else if (activeTab === 'marketing') {
        try {
          const params: any = {};
          if (filters.artistId) params.artistId = filters.artistId;
          if (filters.campaignType) params.type = filters.campaignType;
          if (filters.startDate) params.startDate = filters.startDate;
          if (filters.endDate) params.endDate = filters.endDate;
          const res = await analyticsApi.getMarketing(params);
          setMarketing(res.data.data);
        } catch { toast.error('Failed to load marketing analytics'); }
      }
    };
    if (!loading) loadTabData();
  }, [activeTab, filters, loading]);

  const handleExport = async (type: string) => {
    setExporting(true);
    try {
      const params: any = { type };
      if (filters.artistId) params.artistId = filters.artistId;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const res = await analyticsApi.exportReport(params);
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-report.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`${type} report exported`);
    } catch {
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><LoadingSpinner size={28} /></div>;
  }

  const radarData = overview ? [
    { subject: 'Revenue', A: Math.min(100, overview.totalRevenueYTD > 0 ? 75 : 30) },
    { subject: 'Streams', A: Math.min(100, overview.totalStreams > 100000 ? 85 : overview.totalStreams > 10000 ? 60 : 35) },
    { subject: 'Campaigns', A: Math.min(100, (overview.activeCampaigns || 0) * 20 + 20) },
    { subject: 'Releases', A: Math.min(100, (overview.totalReleases || 0) * 10 + 20) },
    { subject: 'Artists', A: Math.min(100, (overview.totalArtists || 0) * 15 + 20) },
    { subject: 'Tasks', A: overview.pendingTasks > 0 ? Math.max(20, 100 - overview.overdueTasks * 15) : 90 },
  ] : [];

  const showFilters = ['artist-performance', 'release-performance', 'marketing'].includes(activeTab);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics & Performance</h1>
          <p className="text-sm text-gray-500 mt-1">Track your label's key metrics and performance indicators</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('finances')}
            disabled={exporting}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      {showFilters && (
        <AnalyticsFilters
          filters={filters}
          onChange={setFilters}
          showArtistFilter
          showReleaseFilter={activeTab === 'release-performance'}
          showCampaignFilter={activeTab === 'marketing'}
          showPeriodFilter
        />
      )}

      {/* Executive Tab */}
      {activeTab === 'executive' && <ExecutiveDashboard data={executive} />}

      {/* Overview Tab (existing) */}
      {activeTab === 'overview' && overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {[
              {
                label: 'Revenue YTD',
                value: fmtCurrency(overview.totalRevenueYTD),
                icon: <DollarSign size={16} />,
                color: '#6366F1',
                trend: overview.revenueGrowth,
              },
              {
                label: 'Total Streams',
                value: fmtNum(overview.totalStreams),
                icon: <Music size={16} />,
                color: '#8B5CF6',
              },
              {
                label: 'Active Artists',
                value: overview.totalArtists,
                icon: <Users size={16} />,
                color: '#06B6D4',
              },
              {
                label: 'Releases',
                value: overview.totalReleases,
                icon: <Disc size={16} />,
                color: '#10B981',
              },
              {
                label: 'Task Completion',
                value: `${overview.pendingTasks > 0 ? (((overview.totalSongs || 1) / (overview.totalSongs + overview.pendingTasks)) * 100).toFixed(0) : 100}%`,
                icon: <CheckSquare size={16} />,
                color: '#F59E0B',
              },
              {
                label: 'Revenue / Artist',
                value: overview.totalArtists > 0 ? fmtCurrency(overview.totalRevenueYTD / overview.totalArtists) : '$0',
                icon: <BarChart3 size={16} />,
                color: '#EC4899',
              },
            ].map((s, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15` }}>
                    <span style={{ color: s.color }}>{s.icon}</span>
                  </div>
                  {s.trend !== undefined && <TrendBadge value={s.trend} />}
                </div>
                <div className="text-2xl font-bold text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm xl:col-span-2">
              <h3 className="text-base font-bold text-gray-900 mb-1">Revenue vs Expenses</h3>
              <p className="text-xs text-gray-500 mb-5">Monthly trend comparison</p>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={revenue?.monthly || []}>
                  <defs>
                    <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="currentRevenue" name="Revenue" stroke="#6366F1" fill="url(#gRev)" strokeWidth={2.5} dot={false} />
                  <Area type="monotone" dataKey="currentExpenses" name="Expenses" stroke="#EF4444" fill="url(#gExp)" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-gray-900 mb-1">Performance Radar</h3>
              <p className="text-xs text-gray-500 mb-4">Label health by category</p>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#E5E7EB" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#6B7280', fontSize: 11 }} />
                  <Radar name="Score" dataKey="A" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.15} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Active Contracts', value: overview.activeContracts, icon: <FileText size={16} />, color: '#10B981' },
              { label: 'Active Campaigns', value: overview.activeCampaigns, icon: <Activity size={16} />, color: '#06B6D4' },
              { label: 'Pending Tasks', value: overview.pendingTasks, icon: <CheckSquare size={16} />, color: '#F59E0B' },
              { label: 'Overdue Tasks', value: overview.overdueTasks, icon: <TrendingDown size={16} />, color: '#EF4444' },
            ].map((s, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15` }}>
                    <span style={{ color: s.color }}>{s.icon}</span>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-gray-900">{s.value}</div>
                    <div className="text-xs text-gray-500">{s.label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revenue Tab (existing) */}
      {activeTab === 'revenue' && revenue && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-gray-900 mb-1">Monthly Revenue Comparison</h3>
              <p className="text-xs text-gray-500 mb-5">Current year vs previous year</p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenue.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="currentRevenue" name="This Year" fill="#6366F1" radius={[4, 4, 0, 0]} opacity={0.85} />
                  <Bar dataKey="previousRevenue" name="Last Year" fill="#C7D2FE" radius={[4, 4, 0, 0]} opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-gray-900 mb-1">Revenue by Category</h3>
              <p className="text-xs text-gray-500 mb-5">Income breakdown</p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenue.byCategory} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F9FAFB' }} />
                  <Bar dataKey="value" name="Revenue" fill="#10B981" radius={[0, 4, 4, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-gray-900 mb-1">Revenue by Artist</h3>
              <p className="text-xs text-gray-500 mb-5">Artist revenue share</p>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={revenue.byArtist}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }: any) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                    labelLine={{ stroke: '#9CA3AF', strokeWidth: 1 }}
                  >
                    {revenue.byArtist.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmtCurrency(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-gray-900 mb-1">Quarterly Revenue</h3>
              <p className="text-xs text-gray-500 mb-5">Revenue, expenses, and profit by quarter</p>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenue.quarterly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#6366F1" strokeWidth={2.5} dot={{ fill: '#6366F1', r: 4 }} />
                  <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#EF4444" strokeWidth={2} dot={{ fill: '#EF4444', r: 4 }} strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="profit" name="Profit" stroke="#10B981" strokeWidth={2.5} dot={{ fill: '#10B981', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 mb-1">Revenue Growth</h3>
            <p className="text-xs text-gray-500 mb-4">Month-over-month growth rates</p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Month</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Current Year</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Previous Year</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Growth</th>
                  </tr>
                </thead>
                <tbody>
                  {revenue.momGrowth.map((row: any) => (
                    <tr key={row.month} className="hover:bg-gray-50 transition-colors border-b border-gray-50">
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">{row.month}</td>
                      <td className="py-3 px-4 text-sm text-right text-gray-900">{fmtCurrency(row.current)}</td>
                      <td className="py-3 px-4 text-sm text-right text-gray-500">{fmtCurrency(row.previous)}</td>
                      <td className="py-3 px-4 text-sm text-right">
                        <TrendBadge value={row.growth} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Artists Tab (existing) */}
      {activeTab === 'artists' && artists && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 mb-1">Top Artists</h3>
            <p className="text-xs text-gray-500 mb-4">Performance overview by artist</p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Artist</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Streams</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Songs</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Releases</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Contracts</th>
                  </tr>
                </thead>
                <tbody>
                  {artists.artists.map((a: any) => (
                    <tr key={a._id} className="hover:bg-gray-50 transition-colors border-b border-gray-50">
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">{a.displayName}</td>
                      <td className="py-3 px-4 text-sm text-right text-gray-900">{fmtNum(a.totalStreams || 0)}</td>
                      <td className="py-3 px-4 text-sm text-right text-gray-900">{fmtCurrency(a.totalRevenue || 0)}</td>
                      <td className="py-3 px-4 text-sm text-right text-gray-900">{a.songsCount}</td>
                      <td className="py-3 px-4 text-sm text-right text-gray-900">{a.releasesCount}</td>
                      <td className="py-3 px-4 text-sm text-right text-gray-900">{a.activeContracts}</td>
                    </tr>
                  ))}
                  {artists.artists.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-sm text-gray-400">No artist data available</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-gray-900 mb-1">Artist Revenue</h3>
              <p className="text-xs text-gray-500 mb-5">Revenue comparison</p>
              <ResponsiveContainer width="100%" height={Math.max(240, artists.topByRevenue.length * 40 + 40)}>
                <BarChart data={artists.topByRevenue} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="displayName" tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F9FAFB' }} />
                  <Bar dataKey="totalRevenue" name="Revenue" fill="#6366F1" radius={[0, 4, 4, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-gray-900 mb-1">Artist Streams</h3>
              <p className="text-xs text-gray-500 mb-5">Stream count comparison</p>
              <ResponsiveContainer width="100%" height={Math.max(240, artists.topByStreams.length * 40 + 40)}>
                <BarChart data={artists.topByStreams} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="displayName" tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F9FAFB' }} />
                  <Bar dataKey="totalStreams" name="Streams" fill="#10B981" radius={[0, 4, 4, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {artists.artists.slice(0, 6).map((a: any) => (
              <div key={a._id} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                    {a.displayName?.charAt(0) || '?'}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{a.displayName}</div>
                    <div className={`text-xs font-medium ${a.status === 'active' ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {a.status}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-lg font-bold text-gray-900">{fmtNum(a.totalStreams || 0)}</div>
                    <div className="text-xs text-gray-500">Streams</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-900">{fmtCurrency(a.totalRevenue || 0)}</div>
                    <div className="text-xs text-gray-500">Revenue</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-900">{a.songsCount}</div>
                    <div className="text-xs text-gray-500">Songs</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Artist Performance Tab (new) */}
      {activeTab === 'artist-performance' && <ArtistPerformance data={artistPerf} />}

      {/* Releases Tab (existing) */}
      {activeTab === 'releases' && releaseData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'This Month', value: releaseData.thisMonth, icon: <Disc size={16} />, color: '#10B981' },
              { label: 'Last Month', value: releaseData.lastMonth, icon: <Disc size={16} />, color: '#06B6D4' },
              { label: 'Avg Prep Time', value: `${releaseData.avgPrepDays}d`, icon: <Activity size={16} />, color: '#F59E0B' },
              { label: 'Upcoming', value: releaseData.upcomingReleases.length, icon: <FileText size={16} />, color: '#8B5CF6' },
            ].map((s, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15` }}>
                    <span style={{ color: s.color }}>{s.icon}</span>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-gray-900">{s.value}</div>
                    <div className="text-xs text-gray-500">{s.label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-gray-900 mb-1">Releases by Status</h3>
              <p className="text-xs text-gray-500 mb-5">Current release distribution</p>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={Object.entries(releaseData.byStatus).map(([k, v]) => ({
                      name: k.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
                      value: v as number,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }: any) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                    labelLine={{ stroke: '#9CA3AF', strokeWidth: 1 }}
                  >
                    {Object.keys(releaseData.byStatus).map((_: string, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-gray-900 mb-1">Releases by Type</h3>
              <p className="text-xs text-gray-500 mb-5">Type distribution</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={releaseData.byType}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Releases" fill="#8B5CF6" radius={[4, 4, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 mb-1">Upcoming Releases</h3>
            <p className="text-xs text-gray-500 mb-4">Scheduled releases timeline</p>
            <div className="space-y-3">
              {releaseData.upcomingReleases.map((r: any) => (
                <div key={r._id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors border-b border-gray-50">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                    <Disc size={16} className="text-indigo-500" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-900">{r.title}</div>
                    <div className="text-xs text-gray-500">{r.artist} &middot; {r.type}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {new Date(r.releaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className={`text-xs font-medium ${r.status === 'scheduled' ? 'text-gray-500' : 'text-amber-600'}`}>
                      {r.status.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>
              ))}
              {releaseData.upcomingReleases.length === 0 && (
                <div className="text-center py-8 text-sm text-gray-400">No upcoming releases</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Release Performance Tab (new) */}
      {activeTab === 'release-performance' && <ReleasePerformance data={releasePerf} />}

      {/* Financial Analytics Tab (new) */}
      {activeTab === 'financial' && <FinancialAnalytics data={financial} />}

      {/* Marketing Analytics Tab (new) */}
      {activeTab === 'marketing' && <MarketingAnalytics data={marketing} />}

      {/* Operations Tab (existing) */}
      {activeTab === 'operations' && operational && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Tasks', value: operational.totalTasks, icon: <CheckSquare size={16} />, color: '#6366F1' },
              { label: 'Completion Rate', value: `${operational.completionRate}%`, icon: <Target size={16} />, color: '#10B981' },
              { label: 'Overdue', value: operational.overdueTasks, icon: <TrendingDown size={16} />, color: '#EF4444' },
              { label: 'Team Members', value: operational.teamPerformance.length, icon: <Users size={16} />, color: '#06B6D4' },
            ].map((s, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15` }}>
                    <span style={{ color: s.color }}>{s.icon}</span>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-gray-900">{s.value}</div>
                    <div className="text-xs text-gray-500">{s.label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-gray-900 mb-1">Task Completion Trend</h3>
              <p className="text-xs text-gray-500 mb-5">Tasks completed per week (last 12 weeks)</p>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={operational.weeklyTrend}>
                  <defs>
                    <linearGradient id="gTask" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="completed" name="Completed" stroke="#10B981" fill="url(#gTask)" strokeWidth={2.5} dot={{ fill: '#10B981', r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-gray-900 mb-1">Tasks by Status</h3>
              <p className="text-xs text-gray-500 mb-5">Current task distribution</p>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={Object.entries(operational.byStatus).map(([k, v]) => ({
                      name: k.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
                      value: v as number,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }: any) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                    labelLine={{ stroke: '#9CA3AF', strokeWidth: 1 }}
                  >
                    {Object.keys(operational.byStatus).map((_: string, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 mb-1">Team Performance</h3>
            <p className="text-xs text-gray-500 mb-4">Task completion by team member</p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Team Member</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Assigned</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Completed</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Delayed</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Completion Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {operational.teamPerformance.map((m: any) => (
                    <tr key={m._id} className="hover:bg-gray-50 transition-colors border-b border-gray-50">
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">{m.name}</td>
                      <td className="py-3 px-4 text-sm text-right text-gray-900">{m.total}</td>
                      <td className="py-3 px-4 text-sm text-right text-emerald-600 font-medium">{m.completed}</td>
                      <td className="py-3 px-4 text-sm text-right text-red-500 font-medium">{m.delayed}</td>
                      <td className="py-3 px-4 text-sm text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${m.completionRate}%`,
                                background: m.completionRate >= 75 ? '#10B981' : m.completionRate >= 50 ? '#F59E0B' : '#EF4444',
                              }}
                            />
                          </div>
                          <span className="text-gray-900 font-medium">{m.completionRate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {operational.teamPerformance.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-sm text-gray-400">No team performance data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {operational.overdueByAssignee.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-gray-900 mb-1">Overdue Tasks by Assignee</h3>
              <p className="text-xs text-gray-500 mb-5">Who has overdue work</p>
              <ResponsiveContainer width="100%" height={Math.max(200, operational.overdueByAssignee.length * 40 + 40)}>
                <BarChart data={operational.overdueByAssignee} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F9FAFB' }} />
                  <Bar dataKey="count" name="Overdue Tasks" fill="#EF4444" radius={[0, 4, 4, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* KPIs Tab (existing) */}
      {activeTab === 'kpis' && kpis && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {kpis.kpis.map((kpi: any, i: number) => {
              const color = COLORS[i % COLORS.length];
              const isPositive = kpi.invertTrend ? kpi.change < 0 : kpi.change > 0;
              return (
                <div key={i} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
                      <Target size={16} style={{ color }} />
                    </div>
                    {kpi.change !== 0 && (
                      <div className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full ${
                        isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                      }`}>
                        {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {Math.abs(kpi.change)}%
                      </div>
                    )}
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {kpi.format === 'currency'
                      ? fmtCurrency(kpi.value)
                      : `${kpi.value}%`}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{kpi.name}</div>
                  {kpi.previousValue > 0 && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      Previous: {kpi.format === 'currency' ? fmtCurrency(kpi.previousValue) : `${kpi.previousValue}%`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 mb-1">KPI Summary</h3>
            <p className="text-xs text-gray-500 mb-4">Key performance indicators at a glance</p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">KPI</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Current</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Previous</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.kpis.map((kpi: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors border-b border-gray-50">
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">{kpi.name}</td>
                      <td className="py-3 px-4 text-sm text-right text-gray-900 font-semibold">
                        {kpi.format === 'currency' ? fmtCurrency(kpi.value) : `${kpi.value}%`}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-gray-500">
                        {kpi.previousValue > 0
                          ? kpi.format === 'currency' ? fmtCurrency(kpi.previousValue) : `${kpi.previousValue}%`
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-sm text-right">
                        {kpi.change !== 0 ? <TrendBadge value={kpi.change} invert={kpi.invertTrend} /> : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
