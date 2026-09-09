import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, TrendingDown, TrendingUp, Clock, Wallet, Hash,
  AlertCircle, CreditCard, BarChart3, PiggyBank, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { dashboardApi } from '../services/api';
import { formatCurrency, formatDate, formatStatus } from '../utils/helpers';
import DashboardHero from '../components/ui/DashboardHero';
import StatCard from '../components/ui/StatCard';
import Card from '../components/ui/Card';
import StatusBadge from '../components/ui/StatusBadge';
import PerformanceSnapshot from '../components/dashboard/PerformanceSnapshot';

const fmtCur = (v: number) => formatCurrency(Math.round(v));

interface KPIs {
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  pendingPayments: number;
  totalBudgets: number;
  royaltyEntries: number;
  totalRoyaltiesPaid: number;
}

interface Transaction {
  id: string;
  type: string;
  category: string;
  amount: number;
  description: string;
  artist: string;
  date: string;
  paymentStatus: string;
}

interface DashboardData {
  role: string;
  kpis: KPIs;
  recentTransactions: Transaction[];
}

const FinanceDashboard: React.FC = () => {
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
          <p className="text-sm font-medium text-[var(--hbe-muted)]">Loading finance dashboard...</p>
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

  const { kpis, recentTransactions } = data;

  const margin = kpis.totalRevenue > 0 ? (kpis.profit / kpis.totalRevenue) * 100 : 0;
  const spendRatio = kpis.totalRevenue > 0 ? (kpis.totalExpenses / kpis.totalRevenue) * 100 : 0;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">

      <DashboardHero
        eyebrow="Financial Operations"
        title="Finance Command Center"
        subtitle="Financial overview, cash flow, and royalty settlement at a glance"
        icon={<PiggyBank size={22} />}
        accent="amber"
        onRefresh={() => load(true)}
        refreshing={refreshing}
        stats={[
          { label: 'Net Profit', value: `${kpis.profit >= 0 ? '+' : ''}${fmtCur(kpis.profit)}`, tone: kpis.profit >= 0 ? 'up' : 'down' },
          { label: 'Royalties Paid', value: fmtCur(kpis.totalRoyaltiesPaid), tone: 'up' },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={kpis.totalRevenue} format={fmtCur} icon={<TrendingUp size={19} />} color="#16A34A" trend="income" trendUp />
        <StatCard label="Total Expenses" value={kpis.totalExpenses} format={fmtCur} icon={<TrendingDown size={19} />} color="#DC2626" trend="spend" />
        <StatCard label="Net Profit" value={kpis.profit} format={fmtCur} icon={<BarChart3 size={19} />} color="#7C3AED" trendNote={kpis.profit >= 0 ? 'Profitable period' : 'Operating at a loss'} />
        <StatCard label="Pending Payments" value={kpis.pendingPayments} format={fmtCur} icon={<Clock size={19} />} color="#F59E0B" trend="awaiting" />
      </div>

      <PerformanceSnapshot
        description="Financial ratios computed from live ledger data"
        metrics={[
          { label: 'Net Margin', value: Math.max(0, margin), color: kpis.profit >= 0 ? '#16A34A' : '#DC2626', note: `${fmtCur(kpis.profit)} profit` },
          { label: 'Spend Ratio', value: Math.min(100, spendRatio), color: spendRatio <= 70 ? '#16A34A' : '#F59E0B', note: `${fmtCur(kpis.totalExpenses)} spent` },
          { label: 'Budget Coverage', value: kpis.totalRevenue > 0 ? Math.min(100, (kpis.totalBudgets / kpis.totalRevenue) * 100) : 0, color: '#0EA5E9', note: `${kpis.royaltyEntries} royalty entries` },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Budgets" value={kpis.totalBudgets} format={fmtCur} icon={<Wallet size={19} />} color="#7C3AED" />
        <StatCard label="Royalty Entries" value={kpis.royaltyEntries} icon={<Hash size={19} />} color="#0EA5E9" />
        <StatCard label="Royalties Paid" value={kpis.totalRoyaltiesPaid} format={fmtCur} icon={<CreditCard size={19} />} color="#16A34A" />
      </div>

      <Card title="Recent Transactions" description="Latest income and expense movements" icon={<DollarSign size={16} />} accent="emerald" badge={recentTransactions.length}>
        {recentTransactions.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign size={28} className="text-[var(--hbe-muted)] mx-auto mb-2" />
            <p className="text-xs text-[var(--hbe-muted)]">No transactions yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Category</th>
                  <th className="pb-3 pr-4 text-right">Amount</th>
                  <th className="pb-3 pr-4">Description</th>
                  <th className="pb-3 pr-4">Artist</th>
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--hbe-divide)">
                {recentTransactions.map((txn) => {
                  const isIncome = txn.type === 'income';
                  return (
                    <tr key={txn.id} className="transition-colors hover:bg-(--hbe-hover-fill)">
                      <td className="py-3 pr-4">
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold"
                          style={{
                            background: isIncome ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
                            color: isIncome ? '#16A34A' : '#DC2626',
                          }}
                        >
                          {isIncome ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                          {formatStatus(txn.type)}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-sm text-[var(--hbe-text-soft)]">{txn.category}</td>
                      <td className="py-3 pr-4 text-right">
                        <span className={`text-sm font-extrabold ${isIncome ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                          {isIncome ? '+' : '-'}{formatCurrency(txn.amount)}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-sm text-[var(--hbe-text-soft)] max-w-[200px] truncate">{txn.description}</td>
                      <td className="py-3 pr-4 text-sm text-[var(--hbe-text-soft)]">{txn.artist}</td>
                      <td className="py-3 pr-4 text-sm text-[var(--hbe-muted)]">{formatDate(txn.date)}</td>
                      <td className="py-3">
                        <StatusBadge status={txn.paymentStatus} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

    </div>
  );
};

export default FinanceDashboard;