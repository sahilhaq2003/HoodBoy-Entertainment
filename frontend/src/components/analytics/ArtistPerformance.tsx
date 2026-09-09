import React from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Users, TrendingUp, DollarSign, Music, Target, Disc, Wallet } from 'lucide-react';

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

interface ArtistPerformanceProps {
  data: any;
}

const ArtistPerformance: React.FC<ArtistPerformanceProps> = ({ data }) => {
  if (!data || !data.artists) return null;

  const { artists, totals } = data;

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: fmtCurrency(totals?.revenue || 0), icon: <DollarSign size={16} />, color: '#6366F1' },
          { label: 'Total Streams', value: fmtNum(totals?.streams || 0), icon: <TrendingUp size={16} />, color: '#10B981' },
          { label: 'Royalty Owed', value: fmtCurrency(totals?.royaltyOwed || 0), icon: <Wallet size={16} />, color: '#EF4444' },
          { label: 'Royalty Paid', value: fmtCurrency(totals?.royaltyPaid || 0), icon: <DollarSign size={16} />, color: '#8B5CF6' },
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

      {/* Artist Performance Table */}
      <Card>
        <SectionTitle title="Artist Performance" subtitle="Revenue, streams, campaigns, and royalty details by artist" />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Artist</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Streams</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Releases</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Campaigns</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Royalty Owed</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Recoupment</th>
              </tr>
            </thead>
            <tbody>
              {artists.map((a: any) => (
                <tr key={a._id} className="hover:bg-gray-50 transition-colors border-b border-gray-50">
                  <td className="py-3 px-4 text-sm font-medium text-gray-900">{a.name}</td>
                  <td className="py-3 px-4 text-sm text-right text-gray-900">{fmtCurrency(a.revenue)}</td>
                  <td className="py-3 px-4 text-sm text-right text-gray-900">{fmtNum(a.streams)}</td>
                  <td className="py-3 px-4 text-sm text-right text-gray-900">{a.releasedReleases || 0}/{a.releases || 0}</td>
                  <td className="py-3 px-4 text-sm text-right text-gray-900">{a.campaigns || 0}</td>
                  <td className="py-3 px-4 text-sm text-right font-semibold text-red-600">{fmtCurrency(a.royaltyOwed)}</td>
                  <td className="py-3 px-4 text-sm text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, a.recoupmentProgress || 0)}%`,
                            background: (a.recoupmentProgress || 0) >= 75 ? '#10B981' : (a.recoupmentProgress || 0) >= 50 ? '#F59E0B' : '#EF4444',
                          }}
                        />
                      </div>
                      <span className="text-gray-900 font-medium text-xs">{a.recoupmentProgress || 0}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {artists.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-sm text-gray-400">No artist performance data available</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Revenue Comparison Chart */}
      {artists.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <SectionTitle title="Revenue by Artist" subtitle="Top performers by revenue" />
            <ResponsiveContainer width="100%" height={Math.max(240, artists.slice(0, 10).length * 40 + 40)}>
              <BarChart data={artists.slice(0, 10)} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F9FAFB' }} />
                <Bar dataKey="revenue" name="Revenue" fill="#6366F1" radius={[0, 4, 4, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <SectionTitle title="Streams by Artist" subtitle="Top performers by streams" />
            <ResponsiveContainer width="100%" height={Math.max(240, artists.slice(0, 10).length * 40 + 40)}>
              <BarChart data={artists.slice(0, 10)} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F9FAFB' }} />
                <Bar dataKey="streams" name="Streams" fill="#10B981" radius={[0, 4, 4, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Audience Growth Trend */}
      {artists.some((a: any) => a.audienceGrowthTrend?.length > 0) && (
        <Card>
          <SectionTitle title="Audience Growth Trends" subtitle="Streams and listeners over time (top artists)" />
          <div className="space-y-4">
            {artists.filter((a: any) => a.audienceGrowthTrend?.length > 0).slice(0, 3).map((artist: any, idx: number) => (
              <div key={artist._id}>
                <p className="text-sm font-semibold text-gray-700 mb-2">{artist.name}</p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={artist.audienceGrowthTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="period" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="streams" name="Streams" stroke={COLORS[idx % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="listeners" name="Listeners" stroke={COLORS[(idx + 3) % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Artist Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {artists.slice(0, 6).map((a: any) => (
          <div key={a._id} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                {a.name?.charAt(0) || '?'}
              </div>
              <div>
                <div className="font-semibold text-gray-900 text-sm">{a.name}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-lg font-bold text-gray-900">{fmtNum(a.streams || 0)}</div>
                <div className="text-xs text-gray-500">Streams</div>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900">{fmtCurrency(a.revenue || 0)}</div>
                <div className="text-xs text-gray-500">Revenue</div>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900">{a.releases || 0}</div>
                <div className="text-xs text-gray-500">Releases</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ArtistPerformance;
