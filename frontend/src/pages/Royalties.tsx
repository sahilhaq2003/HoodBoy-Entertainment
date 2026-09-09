import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  Plus,
  Search,
  Filter,
  Download,
  Calculator,
  TrendingUp,
  TrendingDown,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  ArrowUpRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { royaltiesApi, artistsApi } from '../services/api';
import { formatCurrency, formatDate, getStatusClass, formatStatus } from '../utils/helpers';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import type { RoyaltyEntry, Artist } from '../types';

interface IncomeBySource {
  streaming: number;
  publishing: number;
  mechanical: number;
  performance: number;
  sync: number;
  merchandise: number;
  other: number;
}

const defaultIncomeBySource: IncomeBySource = {
  streaming: 0,
  publishing: 0,
  mechanical: 0,
  performance: 0,
  sync: 0,
  merchandise: 0,
  other: 0,
};

const statusOptions = ['draft', 'calculated', 'approved', 'paid', 'disputed'] as const;

const Royalties: React.FC = () => {
  const [entries, setEntries] = useState<RoyaltyEntry[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<RoyaltyEntry | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [filterArtist, setFilterArtist] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');

  const [formData, setFormData] = useState({
    artist: '',
    period: '',
    periodStart: '',
    periodEnd: '',
    grossIncome: '',
    incomeBySource: { ...defaultIncomeBySource },
    distributorFees: '',
    artistPercentage: '20',
    labelPercentage: '80',
    producerPercentage: '0',
    featuredArtistPercentage: '0',
    recoupableExpenses: '',
    deductionDescription: '',
    deductionAmount: '',
    deductionCategory: 'recoupable',
  });

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (filterArtist) params.artist = filterArtist;
      if (filterStatus) params.status = filterStatus;
      if (filterPeriod) params.period = filterPeriod;
      const res = await royaltiesApi.getAll(params);
      setEntries(res.data.data || []);
    } catch {
      toast.error('Failed to load royalty entries');
    } finally {
      setLoading(false);
    }
  }, [filterArtist, filterStatus, filterPeriod]);

  const fetchArtists = useCallback(async () => {
    try {
      const res = await artistsApi.getAll({ limit: 200 });
      setArtists(res.data.data || []);
    } catch {
      toast.error('Failed to load artists');
    }
  }, []);

  useEffect(() => {
    fetchArtists();
  }, [fetchArtists]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const totalGrossIncome = entries.reduce((sum, e) => sum + (e.grossIncome || 0), 0);
  const totalNetIncome = entries.reduce((sum, e) => sum + (e.netIncome || 0), 0);
  const totalArtistShare = entries.reduce((sum, e) => sum + (e.artistShare || 0), 0);
  const totalLabelShare = entries.reduce((sum, e) => sum + (e.labelShare || 0), 0);

  const kpis = [
    { label: 'Total Gross Income', value: formatCurrency(totalGrossIncome), icon: DollarSign, color: 'bg-emerald-500' },
    { label: 'Total Net Income', value: formatCurrency(totalNetIncome), icon: TrendingUp, color: 'bg-blue-500' },
    { label: 'Total Artist Share', value: formatCurrency(totalArtistShare), icon: TrendingUp, color: 'bg-violet-500' },
    { label: 'Total Label Share', value: formatCurrency(totalLabelShare), icon: TrendingDown, color: 'bg-amber-500' },
  ];

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetForm = () => {
    setFormData({
      artist: '',
      period: '',
      periodStart: '',
      periodEnd: '',
      grossIncome: '',
      incomeBySource: { ...defaultIncomeBySource },
      distributorFees: '',
      artistPercentage: '20',
      labelPercentage: '80',
      producerPercentage: '0',
      featuredArtistPercentage: '0',
      recoupableExpenses: '',
      deductionDescription: '',
      deductionAmount: '',
      deductionCategory: 'recoupable',
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.artist || !formData.period) {
      toast.error('Artist and period are required');
      return;
    }
    if (Number(formData.artistPercentage) + Number(formData.labelPercentage) !== 100) {
      toast.error('Artist and label percentages must total 100%');
      return;
    }
    try {
      const payload = {
        artist: formData.artist,
        period: formData.period,
        periodStart: formData.periodStart,
        periodEnd: formData.periodEnd,
        grossIncome: Number(formData.grossIncome) || 0,
        incomeBySource: {
          streaming: Number(formData.incomeBySource.streaming) || 0,
          publishing: Number(formData.incomeBySource.publishing) || 0,
          mechanical: Number(formData.incomeBySource.mechanical) || 0,
          performance: Number(formData.incomeBySource.performance) || 0,
          sync: Number(formData.incomeBySource.sync) || 0,
          merchandise: Number(formData.incomeBySource.merchandise) || 0,
          other: Number(formData.incomeBySource.other) || 0,
        },
        distributorFees: Number(formData.distributorFees) || 0,
        artistPercentage: Number(formData.artistPercentage) || 20,
        labelPercentage: Number(formData.labelPercentage) || 80,
        producerPercentage: Number(formData.producerPercentage) || 0,
        featuredArtistPercentage: Number(formData.featuredArtistPercentage) || 0,
        recoupableExpenses: Number(formData.recoupableExpenses) || 0,
        approvedDeductions: formData.deductionDescription && Number(formData.deductionAmount) > 0
          ? [{ description: formData.deductionDescription, amount: Number(formData.deductionAmount), category: formData.deductionCategory }]
          : [],
      };
      const res = await royaltiesApi.create(payload);
      toast.success('Royalty entry created');
      setShowCreateModal(false);
      resetForm();
      if (res.data.data?._id) {
        try {
          await royaltiesApi.calculate(res.data.data._id);
        } catch {
          // ignore calculate failure on create
        }
      }
      fetchEntries();
    } catch {
      toast.error('Failed to create royalty entry');
    }
  };

  const handleCalculate = async (id: string) => {
    try {
      await royaltiesApi.calculate(id);
      toast.success('Royalty calculated successfully');
      fetchEntries();
    } catch {
      toast.error('Failed to calculate royalties');
    }
  };

  const handleGenerateStatement = async (id: string) => {
    try {
      await royaltiesApi.generateStatement(id);
      toast.success('Statement generated');
      fetchEntries();
    } catch {
      toast.error('Failed to generate statement');
    }
  };

  const handleApprove = async (id: string) => {
    try { await royaltiesApi.approve(id); toast.success('Royalty statement approved'); fetchEntries(); }
    catch { toast.error('Failed to approve statement'); }
  };

  const handleRecordPayment = async (entry: RoyaltyEntry) => {
    const amount = window.prompt(`Payment amount (maximum ${formatCurrency(entry.remainingBalance)})`);
    if (!amount) return;
    const method = window.prompt('Payment method (bank transfer, cheque, etc.)') || '';
    const reference = window.prompt('Payment reference') || '';
    try { await royaltiesApi.recordPayment(entry._id, { amount: Number(amount), method, reference, date: new Date().toISOString() }); toast.success('Payment recorded'); fetchEntries(); }
    catch { toast.error('Payment could not be recorded'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await royaltiesApi.delete(id);
      toast.success('Royalty entry deleted');
      fetchEntries();
    } catch {
      toast.error('Failed to delete entry');
    }
  };

  const handleViewStatement = (entry: RoyaltyEntry) => {
    setSelectedEntry(entry);
    setShowStatementModal(true);
  };

  const getArtistName = (artist: Artist) => artist.stageName || artist.artistName || artist.name;

  const sourceLabels: Record<keyof IncomeBySource, string> = {
    streaming: 'Streaming',
    publishing: 'Publishing',
    mechanical: 'Mechanical',
    performance: 'Performance',
    sync: 'Sync',
    merchandise: 'Merchandise',
    other: 'Other',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Royalty Ledger</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage royalty calculations, statements, and artist payments
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5"
        >
          <Plus size={16} />
          New Entry
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${kpi.color}`}>
                <kpi.icon size={18} className="text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{kpi.value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Filter size={16} />
            <span>Filters</span>
          </div>
          <select
            value={filterArtist}
            onChange={(e) => setFilterArtist(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Artists</option>
            {artists.map((a) => (
              <option key={a._id} value={a._id}>
                {getArtistName(a)}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Statuses</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {formatStatus(s)}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value)}
            placeholder="Period (e.g. Q1 2026)"
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            onClick={fetchEntries}
            className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5"
          >
            <Search size={16} />
            Search
          </button>
          {(filterArtist || filterStatus || filterPeriod) && (
            <button
              onClick={() => {
                setFilterArtist('');
                setFilterStatus('');
                setFilterPeriod('');
              }}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <DollarSign size={28} className="text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No royalty entries</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Create your first royalty entry to start tracking
            </p>
            <button
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
              className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5"
            >
              <Plus size={16} />
              New Entry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3"></th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                    Period
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                    Artist
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                    Gross Income
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                    Deductions
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                    Net Income
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                    Artist Share
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                    Label Share
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                    Status
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const isExpanded = expandedRows.has(entry._id);
                  return (
                    <React.Fragment key={entry._id}>
                      <tr className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleRow(entry._id)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                          {entry.period}
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(entry.periodStart)} - {formatDate(entry.periodEnd)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {getArtistName(entry.artist)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100 font-medium">
                          {formatCurrency(entry.grossIncome)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-red-600 dark:text-red-400">
                          {formatCurrency(entry.totalDeductions)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(entry.netIncome)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-violet-600 dark:text-violet-400 font-medium">
                          {formatCurrency(entry.artistShare)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-amber-600 dark:text-amber-400 font-medium">
                          {formatCurrency(entry.labelShare)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-medium inline-flex items-center ${getStatusClass(
                              entry.status
                            )}`}
                          >
                            {formatStatus(entry.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {entry.status === 'draft' && (
                              <button
                                onClick={() => handleCalculate(entry._id)}
                                title="Calculate"
                                className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                              >
                                <Calculator size={15} />
                              </button>
                            )}
                            {entry.statementGenerated && (
                              <button
                                onClick={() => handleViewStatement(entry)}
                                title="View Statement"
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                              >
                                <Eye size={15} />
                              </button>
                            )}
                            {!entry.statementGenerated && entry.status !== 'draft' && (
                              <button
                                onClick={() => handleGenerateStatement(entry._id)}
                                title="Generate Statement"
                                className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                              >
                                <FileText size={15} />
                              </button>
                            )}
                            {entry.status === 'calculated' && (
                              <button onClick={() => handleApprove(entry._id)} title="Approve statement" className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"><CheckCircle size={15} /></button>
                            )}
                            {entry.status === 'approved' && entry.remainingBalance > 0 && (
                              <button onClick={() => handleRecordPayment(entry)} title="Record payment" className="p-1.5 rounded-lg text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20"><DollarSign size={15} /></button>
                            )}
                            <button
                              onClick={() => setDeleteTarget(entry._id)}
                              title="Delete"
                              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50 dark:bg-gray-700/20">
                          <td colSpan={10} className="px-6 py-4">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                              <div>
                                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                  Income by Source
                                </h4>
                                <div className="space-y-1">
                                  {(
                                    Object.entries(entry.incomeBySource) as [keyof IncomeBySource, number][]
                                  ).map(([key, val]) => (
                                    <div key={key} className="flex justify-between text-sm">
                                      <span className="text-gray-600 dark:text-gray-400">
                                        {sourceLabels[key]}
                                      </span>
                                      <span className="font-medium text-gray-900 dark:text-gray-100">
                                        {formatCurrency(val)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                  Breakdown
                                </h4>
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Distributor Fees</span>
                                    <span className="font-medium text-gray-900 dark:text-gray-100">
                                      {formatCurrency(entry.distributorFees)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Artist %</span>
                                    <span className="font-medium text-gray-900 dark:text-gray-100">
                                      {entry.artistPercentage}%
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Label %</span>
                                    <span className="font-medium text-gray-900 dark:text-gray-100">
                                      {entry.labelPercentage}%
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Producer Royalty</span>
                                    <span className="font-medium text-gray-900 dark:text-gray-100">
                                      {formatCurrency(entry.producerRoyalty)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Featured Artist Royalty</span>
                                    <span className="font-medium text-gray-900 dark:text-gray-100">
                                      {formatCurrency(entry.featuredArtistRoyalty)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div>
                                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                  Recoupment
                                </h4>
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Recoupable</span>
                                    <span className="font-medium text-gray-900 dark:text-gray-100">
                                      {formatCurrency(entry.recoupableExpenses)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Total Recouped</span>
                                    <span className="font-medium text-gray-900 dark:text-gray-100">
                                      {formatCurrency(entry.totalRecouped)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Remaining</span>
                                    <span className="font-medium text-gray-900 dark:text-gray-100">
                                      {formatCurrency(entry.remainingRecoupable)}
                                    </span>
                                  </div>
                                  {entry.approvedDeductions.length > 0 && (
                                    <div className="mt-2">
                                      <span className="text-gray-600 dark:text-gray-400 text-xs">Deductions:</span>
                                      {entry.approvedDeductions.map((d, i) => (
                                        <div key={i} className="flex justify-between text-xs">
                                          <span className="text-gray-500 dark:text-gray-400">
                                            {d.description}
                                          </span>
                                          <span className="text-red-600 dark:text-red-400">
                                            -{formatCurrency(d.amount)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div>
                                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                  Payments
                                </h4>
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Total Paid</span>
                                    <span className="font-medium text-gray-900 dark:text-gray-100">
                                      {formatCurrency(entry.totalPaid)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Balance</span>
                                    <span
                                      className={`font-medium ${
                                        entry.remainingBalance > 0
                                          ? 'text-amber-600 dark:text-amber-400'
                                          : 'text-emerald-600 dark:text-emerald-400'
                                      }`}
                                    >
                                      {formatCurrency(entry.remainingBalance)}
                                    </span>
                                  </div>
                                  {entry.paymentsIssued.length > 0 && (
                                    <div className="mt-2">
                                      {entry.paymentsIssued.map((p, i) => (
                                        <div key={i} className="text-xs text-gray-500 dark:text-gray-400">
                                          {formatDate(p.date)} - {formatCurrency(p.amount)} ({p.method})
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New Royalty Entry</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Artist *
                  </label>
                  <select
                    required
                    value={formData.artist}
                    onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select artist</option>
                    {artists.map((a) => (
                      <option key={a._id} value={a._id}>
                        {getArtistName(a)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Period *
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.period}
                    onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                    placeholder="e.g. Q1 2026"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Period Start
                  </label>
                  <input
                    type="date"
                    value={formData.periodStart}
                    onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Period End
                  </label>
                  <input
                    type="date"
                    value={formData.periodEnd}
                    onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Gross Income
                </label>
                <input
                  type="number"
                  value={formData.grossIncome}
                  onChange={(e) => setFormData({ ...formData, grossIncome: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Income by Source</h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {(Object.keys(sourceLabels) as (keyof IncomeBySource)[]).map((key) => (
                    <div key={key}>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {sourceLabels[key]}
                      </label>
                      <input
                        type="number"
                        value={formData.incomeBySource[key]}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            incomeBySource: { ...formData.incomeBySource, [key]: e.target.value },
                          })
                        }
                        placeholder="0"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Distributor Fees
                  </label>
                  <input
                    type="number"
                    value={formData.distributorFees}
                    onChange={(e) => setFormData({ ...formData, distributorFees: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Artist %
                  </label>
                  <input
                    type="number"
                    value={formData.artistPercentage}
                    onChange={(e) => setFormData({ ...formData, artistPercentage: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Label %
                  </label>
                  <input
                    type="number"
                    value={formData.labelPercentage}
                    onChange={(e) => setFormData({ ...formData, labelPercentage: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Recoupable Expenses
                  </label>
                  <input
                    type="number"
                    value={formData.recoupableExpenses}
                    onChange={(e) => setFormData({ ...formData, recoupableExpenses: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Producer %</label>
                  <input type="number" min="0" max="100" step="0.01" value={formData.producerPercentage} onChange={(e) => setFormData({ ...formData, producerPercentage: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Featured Artist %</label>
                  <input type="number" min="0" max="100" step="0.01" value={formData.featuredArtistPercentage} onChange={(e) => setFormData({ ...formData, featuredArtistPercentage: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Approved deduction</label>
                  <input type="text" value={formData.deductionDescription} onChange={(e) => setFormData({ ...formData, deductionDescription: e.target.value })} placeholder="Description" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deduction amount</label>
                  <input type="number" min="0" step="0.01" value={formData.deductionAmount} onChange={(e) => setFormData({ ...formData, deductionAmount: e.target.value })} placeholder="0.00" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5"
                >
                  <Plus size={16} />
                  Create Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showStatementModal && selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Royalty Statement</h2>
              <button
                onClick={() => {
                  setShowStatementModal(false);
                  setSelectedEntry(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {getArtistName(selectedEntry.artist)}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Period: {selectedEntry.period} ({formatDate(selectedEntry.periodStart)} -{' '}
                    {formatDate(selectedEntry.periodEnd)})
                  </p>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium inline-flex items-center ${getStatusClass(
                    selectedEntry.status
                  )}`}
                >
                  {formatStatus(selectedEntry.status)}
                </span>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Income Breakdown</h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {(Object.entries(selectedEntry.incomeBySource) as [keyof IncomeBySource, number][]).map(
                    ([key, val]) => (
                      <div
                        key={key}
                        className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600"
                      >
                        <div className="text-xs text-gray-500 dark:text-gray-400">{sourceLabels[key]}</div>
                        <div className="text-sm font-bold text-gray-900 dark:text-white mt-1">
                          {formatCurrency(val)}
                        </div>
                      </div>
                    )
                  )}
                </div>
                <div className="mt-3 flex justify-between text-sm">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Gross Income</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {formatCurrency(selectedEntry.grossIncome)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Deductions</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Distributor Fees</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {formatCurrency(selectedEntry.distributorFees)}
                      </span>
                    </div>
                    {selectedEntry.approvedDeductions.map((d, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">
                          {d.description} ({d.category})
                        </span>
                        <span className="font-medium text-red-600 dark:text-red-400">
                          -{formatCurrency(d.amount)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-2">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Total Deductions</span>
                      <span className="font-bold text-red-600 dark:text-red-400">
                        {formatCurrency(selectedEntry.totalDeductions)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Recoupment</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Recoupable Expenses</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {formatCurrency(selectedEntry.recoupableExpenses)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Total Recouped</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {formatCurrency(selectedEntry.totalRecouped)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-2">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Remaining</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        {formatCurrency(selectedEntry.remainingRecoupable)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Shares</h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Net Income</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                      {formatCurrency(selectedEntry.netIncome)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">
                      Artist ({selectedEntry.artistPercentage}%)
                    </div>
                    <div className="text-lg font-bold text-violet-600 dark:text-violet-400 mt-1">
                      {formatCurrency(selectedEntry.artistShare)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">
                      Label ({selectedEntry.labelPercentage}%)
                    </div>
                    <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1">
                      {formatCurrency(selectedEntry.labelShare)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Producer Royalty</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
                      {formatCurrency(selectedEntry.producerRoyalty)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Payments</h4>
                <div className="space-y-2 text-sm">
                  {selectedEntry.paymentsIssued.length > 0 ? (
                    selectedEntry.paymentsIssued.map((p, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <div>
                          <span className="text-gray-900 dark:text-gray-100 font-medium">
                            {formatCurrency(p.amount)}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400 ml-2">
                            via {p.method} - {p.reference}
                          </span>
                        </div>
                        <span className="text-gray-500 dark:text-gray-400">{formatDate(p.date)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500 dark:text-gray-400 italic">No payments issued yet</div>
                  )}
                  <div className="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-2">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Total Paid</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(selectedEntry.totalPaid)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Remaining Balance</span>
                    <span
                      className={`font-bold ${
                        selectedEntry.remainingBalance > 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {formatCurrency(selectedEntry.remainingBalance)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Royalty Entry"
        message="Are you sure you want to delete this royalty entry? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default Royalties;
