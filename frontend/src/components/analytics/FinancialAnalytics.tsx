import React from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Wallet, Target, BarChart3 } from 'lucide-react';

const fmtCurrency = (v: number) => {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toLocaleString()}`;
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

interface FinancialAnalyticsProps {
  data: any;
}

const FinancialAnalytics: React.FC<FinancialAnalyticsProps> = ({ data }) => {
  if (!data) return null;

  const { summary, monthly, quarterly, budgetComparison, outstandingPayments, royaltyLiabilities, recoupable, expenseBreakdown, incomeBreakdown } = data;

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: fmtCurrency(summary?.totalRevenue || 0), icon: <DollarSign size={16} />, color: '#6366F1' },
          { label: 'Total Expenses', value: fmtCurrency(summary?.totalExpenses || 0), icon: <TrendingDown size={16} />, color: '#EF4444' },
          { label: 'Net Profit', value: fmtCurrency(summary?.totalProfit || 0), icon: <TrendingUp size={16} />, color: '#10B981' },
          { label: 'Profit Margin', value: `${summary?.avgProfitMargin || 0}%`, icon: <BarChart3 size={16} />, color: '#8B5CF6' },
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

      {/* Revenue vs Expenses & Profit Margin */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <SectionTitle title="Revenue vs Expenses" subtitle="Monthly comparison" />
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthly || []}>
              <defs>
                <linearGradient id="gFinRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gFinExp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#6366F1" fill="url(#gFinRev)" strokeWidth={2.5} dot={false} />
              <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#EF4444" fill="url(#gFinExp)" strokeWidth={2} dot={false} strokeDasharray="5 5" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionTitle title="Profit Margin Trend" subtitle="Monthly profit margin percentage" />
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthly || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v: any) => `${v}%`} />
              <Line type="monotone" dataKey="profitMargin" name="Profit Margin" stroke="#10B981" strokeWidth={2.5} dot={{ fill: '#10B981', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Quarterly Summary */}
      <Card>
        <SectionTitle title="Quarterly Financial Summary" subtitle="Revenue, expenses, and profit by quarter" />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Quarter</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Expenses</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Profit</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Margin</th>
              </tr>
            </thead>
            <tbody>
              {quarterly?.map((q: any) => (
                <tr key={q.name} className="hover:bg-gray-50 transition-colors border-b border-gray-50">
                  <td className="py-3 px-4 text-sm font-semibold text-gray-900">{q.name}</td>
                  <td className="py-3 px-4 text-sm text-right text-gray-900">{fmtCurrency(q.revenue)}</td>
                  <td className="py-3 px-4 text-sm text-right text-red-600">{fmtCurrency(q.expenses)}</td>
                  <td className="py-3 px-4 text-sm text-right font-semibold" style={{ color: q.profit >= 0 ? '#10B981' : '#EF4444' }}>
                    {fmtCurrency(q.profit)}
                  </td>
                  <td className="py-3 px-4 text-sm text-right text-gray-700">{q.margin}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Budget vs Actual */}
      {budgetComparison?.length > 0 && (
        <Card>
          <SectionTitle title="Budget vs Actual Spending" subtitle="Category-level budget utilization" />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Category</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Budgeted</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Spent</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Remaining</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {budgetComparison.map((b: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors border-b border-gray-50">
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{b.category}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-900">{fmtCurrency(b.budgeted)}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-900">{fmtCurrency(b.spent)}</td>
                    <td className="py-3 px-4 text-sm text-right" style={{ color: b.remaining >= 0 ? '#10B981' : '#EF4444' }}>
                      {fmtCurrency(b.remaining)}
                    </td>
                    <td className="py-3 px-4 text-sm text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, b.utilization)}%`,
                              background: b.utilization > 90 ? '#EF4444' : b.utilization > 70 ? '#F59E0B' : '#10B981',
                            }}
                          />
                        </div>
                        <span className="text-gray-900 font-medium text-xs">{b.utilization}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Outstanding Payments & Royalty Liabilities */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <SectionTitle title="Outstanding Payments" subtitle="Pending and overdue payments" />
          <div className="space-y-4">
            {[
              { label: 'Pending', count: outstandingPayments?.pending?.count || 0, total: outstandingPayments?.pending?.total || 0, color: '#F59E0B' },
              { label: 'Overdue', count: outstandingPayments?.overdue?.count || 0, total: outstandingPayments?.overdue?.total || 0, color: '#EF4444' },
              { label: 'Partial', count: outstandingPayments?.partial?.count || 0, total: outstandingPayments?.partial?.total || 0, color: '#06B6D4' },
            ].map((p, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                  <div>
                    <div className="text-sm font-medium text-gray-700">{p.label}</div>
                    <div className="text-xs text-gray-500">{p.count} transactions</div>
                  </div>
                </div>
                <span className="text-sm font-bold text-gray-900">{fmtCurrency(p.total)}</span>
              </div>
            ))}
            <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Total Outstanding</span>
              <span className="text-lg font-bold text-red-600">{fmtCurrency(outstandingPayments?.totalOutstanding || 0)}</span>
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Royalty Liabilities" subtitle="Artist royalty obligations" />
          <div className="space-y-4">
            {[
              { label: 'Gross Income', value: royaltyLiabilities?.grossIncome || 0 },
              { label: 'Artist Share', value: royaltyLiabilities?.artistShare || 0 },
              { label: 'Label Share', value: royaltyLiabilities?.labelShare || 0 },
              { label: 'Total Paid', value: royaltyLiabilities?.totalPaid || 0 },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
                <span className="text-sm font-bold text-gray-900">{fmtCurrency(item.value)}</span>
              </div>
            ))}
            <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Remaining Balance</span>
              <span className="text-lg font-bold text-red-600">{fmtCurrency(royaltyLiabilities?.totalRemaining || 0)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Recoupable Balances */}
      <Card>
        <SectionTitle title="Recoupable Balances" subtitle="Advance and recoupment tracking" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Recoupable', value: fmtCurrency(recoupable?.totalRecoupable || 0) },
            { label: 'Total Recouped', value: fmtCurrency(recoupable?.totalRecouped || 0) },
            { label: 'Remaining', value: fmtCurrency(recoupable?.remaining || 0) },
            { label: 'Progress', value: `${recoupable?.progress || 0}%` },
          ].map((item, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-4">
              <div className="text-lg font-bold text-gray-900">{item.value}</div>
              <div className="text-xs text-gray-500">{item.label}</div>
            </div>
          ))}
        </div>
        {recoupable?.totalRecoupable > 0 && (
          <div className="mt-4">
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, recoupable.progress || 0)}%`,
                  background: (recoupable.progress || 0) >= 75 ? '#10B981' : (recoupable.progress || 0) >= 50 ? '#F59E0B' : '#6366F1',
                }}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Expense & Income Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {expenseBreakdown?.length > 0 && (
          <Card>
            <SectionTitle title="Expense Breakdown" subtitle="Expenses by category" />
            <div className="space-y-2">
              {expenseBreakdown.slice(0, 8).map((e: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-700">{e.name}</span>
                  <span className="text-sm font-semibold text-gray-900">{fmtCurrency(e.value)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {incomeBreakdown?.length > 0 && (
          <Card>
            <SectionTitle title="Income Breakdown" subtitle="Revenue by category" />
            <div className="space-y-2">
              {incomeBreakdown.slice(0, 8).map((e: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-700">{e.name}</span>
                  <span className="text-sm font-semibold text-gray-900">{fmtCurrency(e.value)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default FinancialAnalytics;
