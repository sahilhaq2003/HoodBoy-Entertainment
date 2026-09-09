import React from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { DollarSign, Users, Disc, FileText, TrendingUp, TrendingDown, AlertTriangle, Target, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#8B5CF6', '#EC4899', '#14B8A6'];

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

const TrendBadge = ({ value }: { value: number }) => {
  const positive = value > 0;
  const color = positive ? 'text-emerald-600' : value === 0 ? 'text-gray-500' : 'text-red-500';
  const bg = positive ? 'bg-emerald-50' : value === 0 ? 'bg-gray-50' : 'bg-red-50';
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${color} ${bg}`}>
      <Icon size={12} />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
};

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white border border-gray-200 rounded-xl shadow-sm p-6 ${className}`}>{children}</div>
);

const SectionTitle: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div className="mb-4">
    <h3 className="text-base font-bold text-gray-900">{title}</h3>
    <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-4 py-3 rounded-xl text-sm border border-gray-200 shadow-xl">
        <p className="text-gray-500 mb-2 font-semibold">{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-600">{p.name}:</span>
            <span className="text-gray-900 font-bold">{fmtCurrency(Number(p.value))}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

interface ExecutiveDashboardProps {
  data: any;
}

const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({ data }) => {
  if (!data) return null;

  const { revenue, expenses, artists, releases, contracts, tasks, royalties, campaigns, monthlyRevenue, topRevenueSources } = data;

  const contractSummaryData = contracts?.summary
    ? Object.entries(contracts.summary).map(([status, info]: [string, any]) => ({
        name: status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        count: info.count || 0,
        value: info.totalValue || 0,
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Revenue & Profit KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: 'Revenue YTD', value: fmtCurrency(revenue?.ytd || 0), icon: <DollarSign size={16} />, color: '#6366F1', trend: revenue?.growth },
          { label: 'Net Profit YTD', value: fmtCurrency(revenue?.netProfitYTD || 0), icon: <TrendingUp size={16} />, color: '#10B981' },
          { label: 'Profit Margin', value: `${revenue?.profitMarginYTD || 0}%`, icon: <BarChart3 size={16} />, color: '#8B5CF6' },
          { label: 'Active Artists', value: artists?.active || 0, icon: <Users size={16} />, color: '#06B6D4' },
          { label: 'Active Releases', value: releases?.active || 0, icon: <Disc size={16} />, color: '#F59E0B' },
          { label: 'Total Streams', value: fmtNum(artists?.totalStreams || 0), icon: <TrendingUp size={16} />, color: '#EC4899' },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15` }}>
                <span style={{ color: s.color }}>{s.icon}</span>
              </div>
              {s.trend !== undefined && s.trend !== null && <TrendBadge value={s.trend} />}
            </div>
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Contract & Task Status */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Contracts', value: contracts?.totalActive || 0, icon: <FileText size={16} />, color: '#10B981' },
          { label: 'Overdue Tasks', value: tasks?.overdue || 0, icon: <AlertTriangle size={16} />, color: '#EF4444' },
          { label: 'Active Campaigns', value: campaigns?.count || 0, icon: <Target size={16} />, color: '#06B6D4' },
          { label: 'Campaign ROI', value: `${campaigns?.roi || 0}%`, icon: <TrendingUp size={16} />, color: '#8B5CF6' },
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

      {/* Revenue Trend & Top Sources */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <SectionTitle title="Revenue Trend" subtitle="Monthly revenue for current year" />
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyRevenue?.map((m: any) => ({ name: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m.month - 1], revenue: m.total })) || []}>
              <defs>
                <linearGradient id="gExecRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#6366F1" fill="url(#gExecRev)" strokeWidth={2.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionTitle title="Top Revenue Sources" subtitle="Income by category" />
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={topRevenueSources || []}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ name, percent }: any) => `${name.split(' ')[0]} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                labelLine={{ stroke: '#9CA3AF', strokeWidth: 1 }}
              >
                {(topRevenueSources || []).map((_: any, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => fmtCurrency(Number(v))} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Outstanding Royalty Balances */}
      {royalties?.byArtist?.length > 0 && (
        <Card>
          <SectionTitle title="Outstanding Artist Royalty Balances" subtitle={`Total outstanding: ${fmtCurrency(royalties.totalOutstanding || 0)}`} />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Artist</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Entries</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Amount Owed</th>
                </tr>
              </thead>
              <tbody>
                {royalties.byArtist.map((r: any) => (
                  <tr key={r._id} className="hover:bg-gray-50 transition-colors border-b border-gray-50">
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{r.artistName}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-600">{r.entryCount}</td>
                    <td className="py-3 px-4 text-sm text-right font-semibold text-red-600">{fmtCurrency(r.totalOwed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Campaign Performance */}
      <Card>
        <SectionTitle title="Campaign Performance Summary" subtitle="Overall marketing metrics" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Budget', value: fmtCurrency(campaigns?.totalBudget || 0) },
            { label: 'Total Spent', value: fmtCurrency(campaigns?.totalSpent || 0) },
            { label: 'Total Reach', value: fmtNum(campaigns?.totalReach || 0) },
            { label: 'Total Conversions', value: fmtNum(campaigns?.totalConversions || 0) },
          ].map((item, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-4">
              <div className="text-lg font-bold text-gray-900">{item.value}</div>
              <div className="text-xs text-gray-500">{item.label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Contract Status Summary */}
      {contractSummaryData.length > 0 && (
        <Card>
          <SectionTitle title="Contract Status Summary" subtitle="Active contract breakdown" />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={contractSummaryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="count" name="Contracts" fill="#6366F1" radius={[4, 4, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
};

export default ExecutiveDashboard;
