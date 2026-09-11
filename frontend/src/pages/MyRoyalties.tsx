import React, { useEffect, useState } from 'react';
import { Wallet, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { dashboardApi } from '../services/api';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import StatusBadge from '../components/ui/StatusBadge';
import { formatCurrency } from '../utils/helpers';

interface RoyaltyRow {
  id: string;
  period: string;
  grossIncome: number;
  artistShare: number;
  totalPaid: number;
  remainingBalance: number;
  status: string;
}

const MyRoyalties: React.FC = () => {
  const [royalties, setRoyalties] = useState<RoyaltyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.getRoleDashboard()
      .then((res) => setRoyalties(res.data.data?.royalties || []))
      .catch(() => toast.error('Failed to load your royalties'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-16"><LoadingSpinner size={28} text="Loading your royalties..." /></div>;
  }

  const totalOwed = royalties.reduce((s, r) => s + (r.artistShare || 0), 0);
  const totalPaid = royalties.reduce((s, r) => s + (r.totalPaid || 0), 0);
  const balance = totalOwed - totalPaid;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Wallet size={18} /> Royalties</h1>
        <p className="text-xs text-gray-500 mt-0.5">Your royalty statements and payouts</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Total Earned</div>
          <div className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{formatCurrency(Math.round(totalOwed))}</div>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Paid</div>
          <div className="text-xl font-bold text-emerald-600 mt-1">{formatCurrency(Math.round(totalPaid))}</div>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Outstanding</div>
          <div className="text-xl font-bold text-amber-600 mt-1">{formatCurrency(Math.round(balance))}</div>
        </div>
      </div>

      {royalties.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-12 text-center">
          <AlertCircle size={40} className="mx-auto text-gray-300 dark:text-gray-700 mb-3" />
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No royalty statements yet</p>
          <p className="text-xs text-gray-500 mt-1">Your royalty statements will appear here once calculated.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {royalties.map((r) => (
              <div key={r.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600 flex-shrink-0">
                  <Wallet size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{r.period || 'Royalty Statement'}</div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                    <span>Earned <span className="font-medium text-gray-700 dark:text-gray-300">{formatCurrency(Math.round(r.artistShare || 0))}</span></span>
                    <span>Paid <span className="font-medium text-emerald-600">{formatCurrency(Math.round(r.totalPaid || 0))}</span></span>
                    {r.remainingBalance > 0 && <span>Balance <span className="font-medium text-amber-600">{formatCurrency(Math.round(r.remainingBalance))}</span></span>}
                  </div>
                </div>
                <div className="w-28 flex justify-end">
                  <StatusBadge status={r.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MyRoyalties;