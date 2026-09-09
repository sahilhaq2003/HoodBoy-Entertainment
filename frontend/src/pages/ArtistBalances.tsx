import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, Plus, Search, ArrowUpRight, ArrowDownRight, Edit2, Trash2,
  Wallet, TrendingUp, TrendingDown, CreditCard, Clock, Filter, ChevronRight,
  ChevronDown, FileText, AlertCircle, User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate, formatStatus } from '../utils/helpers';
import api, { artistsApi } from '../services/api';

interface Transaction {
  _id: string;
  type: 'royalty_payment' | 'advance' | 'recoupment' | 'adjustment' | 'expense' | 'other';
  amount: number;
  balanceAfter: number;
  description: string;
  reference?: string;
  date: string;
  createdAt: string;
}

interface ArtistBalance {
  _id: string;
  artist: { _id: string; name: string; stageName?: string };
  currentBalance: number;
  totalEarned: number;
  totalPaid: number;
  totalAdvances: number;
  advanceRemaining: number;
  lastPaymentDate?: string;
  lastStatementDate?: string;
  transactions: Transaction[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

const TRANSACTION_TYPE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  royalty_payment: { color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40', label: 'Royalty Payment' },
  advance: { color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40', label: 'Advance' },
  recoupment: { color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40', label: 'Recoupment' },
  adjustment: { color: 'text-gray-700 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700/40 border-gray-200 dark:border-gray-700', label: 'Adjustment' },
  expense: { color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40', label: 'Expense' },
  other: { color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/40', label: 'Other' },
};

const ArtistBalances: React.FC = () => {
  const [balances, setBalances] = useState<ArtistBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBalance, setSelectedBalance] = useState<ArtistBalance | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const [artists, setArtists] = useState<{ _id: string; name: string; stageName?: string }[]>([]);
  const [creatingBalance, setCreatingBalance] = useState(false);
  const [addingTransaction, setAddingTransaction] = useState(false);

  const [createForm, setCreateForm] = useState({
    artist: '',
    currentBalance: 0,
    totalEarned: 0,
    totalPaid: 0,
    totalAdvances: 0,
    advanceRemaining: 0,
    notes: '',
  });

  const [transactionForm, setTransactionForm] = useState({
    type: 'royalty_payment' as Transaction['type'],
    amount: 0,
    description: '',
    reference: '',
    date: new Date().toISOString().split('T')[0],
  });

  const fetchBalances = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/artist-balances');
      setBalances(res.data.data || []);
    } catch {
      toast.error('Failed to load artist balances');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchArtists = useCallback(async () => {
    try {
      const res = await artistsApi.getAll({ limit: 100 });
      setArtists(res.data.data || []);
    } catch { toast.error('Failed to load artists'); }
  }, []);

  useEffect(() => {
    fetchBalances();
    fetchArtists();
  }, [fetchBalances, fetchArtists]);

  const openDetail = async (balance: ArtistBalance) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`/artist-balances/artist/${balance.artist._id}/history`);
      setSelectedBalance(res.data.data || balance);
    } catch {
      setSelectedBalance(balance);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.artist) {
      toast.error('Please select an artist');
      return;
    }
    setCreatingBalance(true);
    try {
      await api.post('/artist-balances', createForm);
      toast.success('Balance record created');
      setShowCreateModal(false);
      setCreateForm({ artist: '', currentBalance: 0, totalEarned: 0, totalPaid: 0, totalAdvances: 0, advanceRemaining: 0, notes: '' });
      fetchBalances();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create balance');
    } finally {
      setCreatingBalance(false);
    }
  };

  const handleAddTransaction = async () => {
    if (!selectedBalance) return;
    if (!transactionForm.description.trim()) {
      toast.error('Description is required');
      return;
    }
    if (transactionForm.amount === 0) {
      toast.error('Amount cannot be zero');
      return;
    }
    setAddingTransaction(true);
    try {
      const res = await api.post(`/artist-balances/${selectedBalance._id}/transactions`, transactionForm);
      toast.success('Transaction added');
      setSelectedBalance(res.data.data);
      setTransactionForm({
        type: 'royalty_payment',
        amount: 0,
        description: '',
        reference: '',
        date: new Date().toISOString().split('T')[0],
      });
      setShowTransactionModal(false);
      fetchBalances();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add transaction');
    } finally {
      setAddingTransaction(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/artist-balances/${id}`);
      toast.success('Balance deleted');
      setShowDeleteConfirm(null);
      setSelectedBalance(null);
      fetchBalances();
    } catch {
      toast.error('Failed to delete balance');
    }
  };

  const filteredBalances = balances.filter((b) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = b.artist.stageName || b.artist.name;
    return name.toLowerCase().includes(q) || b.artist.name.toLowerCase().includes(q);
  });

  const totalBalances = filteredBalances.reduce((s, b) => s + (b.currentBalance || 0), 0);
  const totalEarned = filteredBalances.reduce((s, b) => s + (b.totalEarned || 0), 0);
  const totalPaid = filteredBalances.reduce((s, b) => s + (b.totalPaid || 0), 0);
  const totalAdvances = filteredBalances.reduce((s, b) => s + (b.advanceRemaining || 0), 0);

  const kpis = [
    { label: 'Total Artist Balances', value: formatCurrency(totalBalances), icon: Wallet, color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' },
    { label: 'Total Earned', value: formatCurrency(totalEarned), icon: TrendingUp, color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' },
    { label: 'Total Paid Out', value: formatCurrency(totalPaid), icon: CreditCard, color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' },
    { label: 'Outstanding Advances', value: formatCurrency(totalAdvances), icon: TrendingDown, color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' },
  ];

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const getAvatarColor = (name: string) => {
    const colors = ['#7C3AED', '#8B5CF6', '#F59E0B', '#059669', '#DC2626', '#EC4899', '#0891B2', '#10B981'];
    return colors[name.charCodeAt(0) % colors.length];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Artist Balances</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage account balances and financial transactions</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={16} />
          New Balance
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${kpi.color}`}>
                <Icon size={22} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{kpi.value}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{kpi.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search artists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredBalances.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-16 text-center">
          <Wallet size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">No Balances Found</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {searchQuery ? 'No balances match your search.' : 'Create your first artist balance record to get started.'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Create Balance
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredBalances.map((balance) => (
            <div
              key={balance._id}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: getAvatarColor(balance.artist.name) }}
                  >
                    {getInitials(balance.artist.stageName || balance.artist.name)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {balance.artist.stageName || balance.artist.name}
                    </div>
                    {balance.artist.stageName && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">{balance.artist.name}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowDeleteConfirm(balance._id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatCurrency(balance.currentBalance)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Current Balance</div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(balance.totalEarned)}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Total Earned</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(balance.totalPaid)}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Total Paid</div>
                </div>
              </div>

              {balance.advanceRemaining > 0 && (
                <div className="mb-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={14} className="text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                      {formatCurrency(balance.advanceRemaining)} advance remaining
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {balance.lastPaymentDate ? `Paid ${formatDate(balance.lastPaymentDate)}` : 'No payments yet'}
                </span>
                <span>{balance.transactions?.length || 0} transactions</span>
              </div>

              <button
                onClick={() => openDetail(balance)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 transition-colors"
              >
                View History
                <ChevronRight size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedBalance && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setSelectedBalance(null)} />
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white dark:bg-gray-900 z-50 shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ background: getAvatarColor(selectedBalance.artist.name) }}
                >
                  {getInitials(selectedBalance.artist.stageName || selectedBalance.artist.name)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {selectedBalance.artist.stageName || selectedBalance.artist.name}
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Balance History</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedBalance(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                <span className="sr-only">Close</span>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>

            {detailLoading ? (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current Balance</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {formatCurrency(selectedBalance.currentBalance)}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Earned</div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(selectedBalance.totalEarned)}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Paid</div>
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {formatCurrency(selectedBalance.totalPaid)}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Advances</div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(selectedBalance.totalAdvances)}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Advance Remaining</div>
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {formatCurrency(selectedBalance.advanceRemaining)}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Last Payment</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {selectedBalance.lastPaymentDate ? formatDate(selectedBalance.lastPaymentDate) : 'N/A'}
                    </div>
                  </div>
                </div>

                {selectedBalance.notes && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Notes</div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{selectedBalance.notes}</p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Transaction History</h3>
                  <button
                    onClick={() => setShowTransactionModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                  >
                    <Plus size={14} />
                    Add Transaction
                  </button>
                </div>

                {selectedBalance.transactions && selectedBalance.transactions.length > 0 ? (
                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ref</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedBalance.transactions.map((tx) => {
                            const config = TRANSACTION_TYPE_CONFIG[tx.type] || TRANSACTION_TYPE_CONFIG.other;
                            const isCredit = tx.amount >= 0;
                            return (
                              <tr key={tx._id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatDate(tx.date)}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bg} ${config.color}`}>
                                    {config.label}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className={`text-sm font-semibold flex items-center justify-end gap-1 ${isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {isCredit ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                    {formatCurrency(Math.abs(tx.amount))}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 max-w-[200px] truncate">{tx.description}</td>
                                <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{tx.reference || '—'}</td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 text-right">{formatCurrency(tx.balanceAfter)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
                    <FileText size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No transactions recorded yet.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {showCreateModal && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={() => setShowCreateModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Create Balance Record</h2>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Artist *</label>
                  <select
                    value={createForm.artist}
                    onChange={(e) => setCreateForm({ ...createForm, artist: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Select an artist</option>
                    {artists.map((a) => (
                      <option key={a._id} value={a._id}>{a.stageName || a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Balance</label>
                    <input
                      type="number"
                      value={createForm.currentBalance}
                      onChange={(e) => setCreateForm({ ...createForm, currentBalance: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Earned</label>
                    <input
                      type="number"
                      value={createForm.totalEarned}
                      onChange={(e) => setCreateForm({ ...createForm, totalEarned: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Paid</label>
                    <input
                      type="number"
                      value={createForm.totalPaid}
                      onChange={(e) => setCreateForm({ ...createForm, totalPaid: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Advances</label>
                    <input
                      type="number"
                      value={createForm.totalAdvances}
                      onChange={(e) => setCreateForm({ ...createForm, totalAdvances: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Advance Remaining</label>
                    <input
                      type="number"
                      value={createForm.advanceRemaining}
                      onChange={(e) => setCreateForm({ ...createForm, advanceRemaining: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                    <textarea
                      value={createForm.notes}
                      onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
                    />
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creatingBalance}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {creatingBalance ? 'Creating...' : 'Create Balance'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showTransactionModal && selectedBalance && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={() => setShowTransactionModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Add Transaction</h2>
                <button onClick={() => setShowTransactionModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Transaction Type *</label>
                  <select
                    value={transactionForm.type}
                    onChange={(e) => setTransactionForm({ ...transactionForm, type: e.target.value as Transaction['type'] })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    {Object.entries(TRANSACTION_TYPE_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount * (negative for debits)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={transactionForm.amount}
                    onChange={(e) => setTransactionForm({ ...transactionForm, amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="e.g. 5000 or -2500"
                  />
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    {transactionForm.amount >= 0 ? (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><ArrowUpRight size={12} /> Credit (positive)</span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600 dark:text-red-400"><ArrowDownRight size={12} /> Debit (negative)</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description *</label>
                  <input
                    type="text"
                    value={transactionForm.description}
                    onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="e.g. Q1 2024 Royalty Payment"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reference</label>
                  <input
                    type="text"
                    value={transactionForm.reference}
                    onChange={(e) => setTransactionForm({ ...transactionForm, reference: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="e.g. INV-2024-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date *</label>
                  <input
                    type="date"
                    value={transactionForm.date}
                    onChange={(e) => setTransactionForm({ ...transactionForm, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowTransactionModal(false)}
                  className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTransaction}
                  disabled={addingTransaction}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {addingTransaction ? 'Adding...' : 'Add Transaction'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showDeleteConfirm && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={() => setShowDeleteConfirm(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={24} className="text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Delete Balance?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                This will permanently remove this balance record and all associated transactions. This action cannot be undone.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(showDeleteConfirm)}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ArtistBalances;
