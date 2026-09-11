import React from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Target, TrendingUp, DollarSign, Eye, MousePointer, Users, Globe } from 'lucide-react';

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#8B5CF6', '#EC4899', '#14B8A6'];

const fmtCurrency = (v: number | undefined | null) => {
  const n = Number(v) || 0;
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toLocaleString()}`;
};

const fmtNum = (v: number | undefined | null) => {
  const n = Number(v) || 0;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
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
            <span className="text-gray-900 font-bold">
              {typeof p.value === 'number' && p.value > 10000 ? fmtCurrency(p.value) : p.value?.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

interface MarketingAnalyticsProps {
  data: any;
}

const MarketingAnalytics: React.FC<MarketingAnalyticsProps> = ({ data }) => {
  if (!data) return null;

  const { overview, campaigns, platformPerformance, typeBreakdown, socialGrowth, playlistPerformance } = data;

  return (
    <div className="space-y-6">
      {/* Overview KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Campaign Spend', value: fmtCurrency(overview?.totalSpent || 0), icon: <DollarSign size={16} />, color: '#EF4444' },
          { label: 'Campaign Revenue', value: fmtCurrency(overview?.totalRevenue || 0), icon: <TrendingUp size={16} />, color: '#10B981' },
          { label: 'Overall ROI', value: `${overview?.overallROI || 0}%`, icon: <Target size={16} />, color: '#6366F1' },
          { label: 'Total Reach', value: fmtNum(overview?.totalReach || 0), icon: <Eye size={16} />, color: '#06B6D4' },
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

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Impressions', value: fmtNum(overview?.totalImpressions || 0), color: '#8B5CF6' },
          { label: 'Total Clicks', value: fmtNum(overview?.totalClicks || 0), color: '#EC4899' },
          { label: 'Conversion Rate', value: `${overview?.conversionRate || 0}%`, color: '#F59E0B' },
          { label: 'Cost Per Result', value: fmtCurrency(overview?.costPerResult || 0), color: '#14B8A6' },
        ].map((s, i) => (
          <div key={i} className="bg-gray-50 rounded-xl p-4">
            <div className="text-lg font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Campaign Details Table */}
      {campaigns?.length > 0 && (
        <Card>
          <SectionTitle title="Campaign Details" subtitle="Individual campaign performance" />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Campaign</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Budget</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Spent</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Reach</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Conversions</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">ROI</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c: any) => (
                  <tr key={c._id} className="hover:bg-gray-50 transition-colors border-b border-gray-50">
                    <td className="py-3 px-4">
                      <div className="text-sm font-medium text-gray-900">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.artistName}</div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{c.type?.replace(/_/g, ' ')}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        c.status === 'active' ? 'bg-emerald-50 text-emerald-600' :
                        c.status === 'completed' ? 'bg-blue-50 text-blue-600' :
                        c.status === 'paused' ? 'bg-amber-50 text-amber-600' :
                        'bg-gray-50 text-gray-500'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-gray-900">{fmtCurrency(c.budget)}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-900">{fmtCurrency(c.spent)}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-900">{fmtNum(c.reach)}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-900">{fmtNum(c.conversions)}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-900">{fmtCurrency(c.attributedRevenue)}</td>
                    <td className="py-3 px-4 text-sm text-right">
                      <span className={`font-semibold ${(c.roi || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {(c.roi || 0).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Campaign Type Breakdown */}
      {typeBreakdown?.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <SectionTitle title="Performance by Campaign Type" subtitle="Budget and ROI by type" />
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={typeBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="type" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v.replace(/_/g, ' ')} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="spent" name="Spent" fill="#EF4444" radius={[4, 4, 0, 0]} opacity={0.85} />
                <Bar dataKey="revenue" name="Revenue" fill="#10B981" radius={[4, 4, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <SectionTitle title="ROI by Campaign Type" subtitle="Return on investment comparison" />
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={typeBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="type" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v.replace(/_/g, ' ')} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v: any) => `${v}%`} />
                <Bar dataKey="roi" name="ROI" fill="#6366F1" radius={[4, 4, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Platform Performance */}
      {platformPerformance?.length > 0 && (
        <Card>
          <SectionTitle title="Social Media Platform Performance" subtitle="Engagement metrics by platform" />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Platform</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Impressions</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Clicks</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">CTR</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Likes</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Shares</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Comments</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Engagement</th>
                </tr>
              </thead>
              <tbody>
                {platformPerformance.map((p: any) => (
                  <tr key={p.platform} className="hover:bg-gray-50 transition-colors border-b border-gray-50">
                    <td className="py-3 px-4 text-sm font-medium text-gray-900 capitalize">{p.platform}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-900">{fmtNum(p.impressions)}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-900">{fmtNum(p.clicks)}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-700">{p.ctr}%</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-600">{fmtNum(p.likes)}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-600">{fmtNum(p.shares)}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-600">{fmtNum(p.comments)}</td>
                    <td className="py-3 px-4 text-sm text-right font-semibold text-gray-900">{fmtNum(p.engagement)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Social Growth & Playlist Performance */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {socialGrowth?.length > 0 && (
          <Card>
            <SectionTitle title="Audience Growth Over Time" subtitle="Streams and listener trends" />
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={socialGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="period" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="streams" name="Streams" stroke="#6366F1" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="listeners" name="Listeners" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="playlistAdds" name="Playlist Adds" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {playlistPerformance?.length > 0 && (
          <Card>
            <SectionTitle title="Playlist Performance by Platform" subtitle="Playlist additions across platforms" />
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={playlistPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="platform" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="playlistAdds" name="Playlist Adds" fill="#8B5CF6" radius={[4, 4, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MarketingAnalytics;
