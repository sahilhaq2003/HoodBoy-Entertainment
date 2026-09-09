import React from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Disc, TrendingUp, DollarSign, Globe, Music, BarChart3 } from 'lucide-react';

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

interface ReleasePerformanceProps {
  data: any;
}

const ReleasePerformance: React.FC<ReleasePerformanceProps> = ({ data }) => {
  if (!data) return null;

  const { releasePerformance, platformBreakdown, sourceBreakdown, songPerformance, topPerformers, underperformers, totals } = data;

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Total Release Streams', value: fmtNum(totals?.totalStreams || 0), icon: <TrendingUp size={16} />, color: '#6366F1' },
          { label: 'Total Release Revenue', value: fmtCurrency(totals?.totalRevenue || 0), icon: <DollarSign size={16} />, color: '#10B981' },
          { label: 'Active Releases', value: totals?.releaseCount || 0, icon: <Disc size={16} />, color: '#8B5CF6' },
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

      {/* Top Performers vs Underperformers */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <SectionTitle title="Best Performing Releases" subtitle="Top releases by streams" />
          <div className="space-y-3">
            {topPerformers?.map((r: any, i: number) => (
              <div key={r._id || i} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: COLORS[i % COLORS.length] }}>
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900">{r.title}</div>
                  <div className="text-xs text-gray-500">{r.artistName}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900">{fmtNum(r.totalStreams)}</div>
                  <div className="text-xs text-gray-500">{fmtCurrency(r.totalRevenue)}</div>
                </div>
              </div>
            ))}
            {(!topPerformers || topPerformers.length === 0) && (
              <div className="text-center py-6 text-sm text-gray-400">No release performance data</div>
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Underperforming Releases" subtitle="Releases needing attention" />
          <div className="space-y-3">
            {underperformers?.map((r: any, i: number) => (
              <div key={r._id || i} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-sm font-bold text-red-500">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900">{r.title}</div>
                  <div className="text-xs text-gray-500">{r.artistName}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900">{fmtNum(r.totalStreams)}</div>
                  <div className="text-xs text-gray-500">{fmtCurrency(r.totalRevenue)}</div>
                </div>
              </div>
            ))}
            {(!underperformers || underperformers.length === 0) && (
              <div className="text-center py-6 text-sm text-gray-400">No underperforming releases</div>
            )}
          </div>
        </Card>
      </div>

      {/* Revenue by Platform */}
      {platformBreakdown?.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <SectionTitle title="Revenue by Platform" subtitle="Streaming platform breakdown" />
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={platformBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" name="Revenue" fill="#6366F1" radius={[4, 4, 0, 0]} opacity={0.85} />
                <Bar dataKey="streams" name="Streams" fill="#10B981" radius={[4, 4, 0, 0]} opacity={0.6} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <SectionTitle title="Streaming by Platform" subtitle="Platform stream counts" />
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={platformBreakdown}
                  dataKey="streams"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }: any) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                  labelLine={{ stroke: '#9CA3AF', strokeWidth: 1 }}
                >
                  {platformBreakdown.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => fmtNum(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Revenue by Source */}
      {sourceBreakdown?.length > 0 && (
        <Card>
          <SectionTitle title="Revenue by Source" subtitle="Income source breakdown" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sourceBreakdown.map((s: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-sm font-medium text-gray-700">{s.name}</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{fmtCurrency(s.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Full Release Performance Table */}
      {releasePerformance?.length > 0 && (
        <Card>
          <SectionTitle title="All Release Performance" subtitle="Detailed release metrics" />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Release</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Artist</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Streams</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Saves</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Playlist Adds</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Songs</th>
                </tr>
              </thead>
              <tbody>
                {releasePerformance.map((r: any) => (
                  <tr key={r._id} className="hover:bg-gray-50 transition-colors border-b border-gray-50">
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{r.title}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{r.artistName}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-900">{fmtNum(r.totalStreams)}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-900">{fmtCurrency(r.totalRevenue)}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-600">{fmtNum(r.totalSaves)}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-600">{fmtNum(r.totalPlaylistAdds)}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-600">{r.songsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Song Performance by Artist */}
      {songPerformance?.length > 0 && (
        <Card>
          <SectionTitle title="Song Performance by Artist" subtitle="Individual song metrics" />
          <div className="space-y-4">
            {songPerformance.map((artist: any) => (
              <div key={artist._id}>
                <p className="text-sm font-semibold text-gray-700 mb-2">{artist.artistName}</p>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Song</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Streams</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {artist.songs?.map((s: any) => (
                        <tr key={s._id} className="hover:bg-gray-50 border-b border-gray-50">
                          <td className="py-2 px-3 text-sm text-gray-900">{s.title}</td>
                          <td className="py-2 px-3 text-sm text-right text-gray-900">{fmtNum(s.streams || 0)}</td>
                          <td className="py-2 px-3 text-sm text-right text-gray-900">{fmtCurrency(s.revenue || 0)}</td>
                          <td className="py-2 px-3 text-sm text-right">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              s.status === 'released' ? 'bg-emerald-50 text-emerald-600' :
                              s.status === 'in_production' ? 'bg-blue-50 text-blue-600' :
                              'bg-gray-50 text-gray-500'
                            }`}>
                              {s.status?.replace(/_/g, ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default ReleasePerformance;
