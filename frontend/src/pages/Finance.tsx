import React, { useEffect, useState, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, Plus, ArrowUpRight, ArrowDownRight,
  Filter, PieChart as PieChartIcon, Calculator, Wallet, FileText, Download,
  Edit2, Trash2, Calendar, BarChart3,
} from 'lucide-react';
import { financeApi, budgetsApi } from '../services/api';
import api from '../services/api';
import { formatCurrency, formatDate } from '../utils/helpers';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ui/ConfirmDialog';

interface FinanceRecord {
  _id: string;
  type: 'income' | 'expense';
  category: string;
  subcategory?: string;
  amount: number;
  description?: string;
  artist?: { _id: string; name: string; stageName?: string; artistName?: string };
  project?: { _id: string; name: string };
  release?: { _id: string; title: string };
  department?: string;
  counterparty?: string;
  date: string;
  month?: number;
  year?: number;
  quarter?: number;
  invoiceNumber?: string;
  paymentMethod?: string;
  paymentStatus: string;
  paymentDue?: string;
  receiptUrl?: string; receiptFileName?: string; invoiceUrl?: string; invoiceFileName?: string;
  accountName?: string; accountLast4?: string; taxDeductible?: boolean;
  notes?: string;
  tags?: string[];
  createdAt: string;
}

interface Budget {
  _id: string;
  name: string;
  year: number;
  quarter?: number;
  totalBudget: number;
  items: BudgetItem[];
  artist?: { _id: string; name: string; stageName?: string };
  project?: { _id: string; name: string };
  release?: { _id: string; title: string };
  department?: string;
  status: string;
  notes: string;
  createdBy?: { _id: string; name: string };
  createdAt: string;
}

interface BudgetItem {
  _id: string;
  category: string;
  label: string;
  budgeted: number;
  spent: number;
  notes: string;
}

interface CashFlowData {
  month: string;
  income: number;
  expenses: number;
  balance: number;
}

interface CategoryBreakdown {
  category: string;
  type: string;
  total: number;
  percentage: number;
  count: number;
}

interface BudgetStats {
  totalBudgets: number;
  activeBudgets: number;
  totalBudgeted: number;
  totalSpent: number;
  utilization: number;
}

interface SummaryData {
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  pendingCount: number;
  monthlyBreakdown: { month: number; name: string; revenue: number; expenses: number; profit: number }[];
  categoryBreakdown: { _id: { category: string; type: string }; total: number }[];
  quarterBreakdown: { quarter: number; revenue: number; expenses: number; profit: number }[];
  topArtists: { artist: string; name: string; total: number }[];
  topExpenses: { _id: string; total: number }[];
}

interface ArtistOption {
  _id: string;
  name: string;
  stageName?: string;
  artistName?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  streaming_revenue: 'Streaming Revenue',
  royalty_income: 'Royalty Income',
  sync_licensing: 'Sync / Licensing',
  merchandise: 'Merchandise',
  touring_live: 'Touring / Live',
  brand_partnerships: 'Brand Partnerships',
  publishing_income: 'Publishing Income',
  mechanical_rights: 'Mechanical Rights',
  performance_rights: 'Performance Rights',
  digital_sales: 'Digital Sales',
  physical_sales: 'Physical Sales',
  advances_received: 'Advances Received',
  other_income: 'Other Income',
  sound_recording_royalties: 'Sound Recording Royalties', beat_sales: 'Beat Sales', studio_services: 'Studio Services',
  shows: 'Shows', features: 'Features', sponsorships: 'Sponsorships', youtube: 'YouTube', direct_fan_sales: 'Direct Fan Sales',
  production: 'Production',
  recording: 'Recording',
  mixing_mastering: 'Mixing / Mastering',
  marketing_advertising: 'Marketing / Advertising',
  distribution: 'Distribution',
  legal_fees: 'Legal Fees',
  studio_rental: 'Studio Rental',
  equipment: 'Equipment',
  salaries: 'Salaries',
  touring_expenses: 'Touring Expenses',
  travel: 'Travel',
  office: 'Office',
  software_subscriptions: 'Software Subscriptions',
  insurance: 'Insurance',
  taxes: 'Taxes',
  artist_advances: 'Artist Advances',
  consulting: 'Consulting',
  contractor_payments: 'Contractor Payments',
  other_expense: 'Other Expense',
};

const INCOME_CATEGORIES = [
  'streaming_revenue', 'royalty_income', 'sync_licensing', 'merchandise', 'touring_live',
  'brand_partnerships', 'publishing_income', 'mechanical_rights', 'performance_rights',
  'digital_sales', 'physical_sales', 'advances_received', 'other_income',
  'sound_recording_royalties', 'beat_sales', 'studio_services', 'shows', 'features', 'sponsorships', 'youtube', 'direct_fan_sales',
];
const EXPENSE_CATEGORIES = [
  'production', 'recording', 'mixing_mastering', 'marketing_advertising', 'distribution',
  'legal_fees', 'studio_rental', 'equipment', 'salaries', 'touring_expenses',
  'travel', 'office', 'software_subscriptions', 'insurance', 'taxes',
  'artist_advances', 'consulting', 'contractor_payments', 'other_expense',
];
const PAYMENT_METHODS = ['bank_transfer', 'credit_card', 'cash', 'check', 'paypal', 'stripe', 'wire', 'other'];
const PAYMENT_STATUSES = ['pending', 'paid', 'overdue', 'cancelled', 'partial'];

const PIE_COLORS = ['#10B981', '#6366F1', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#7C3AED', '#14B8A6', '#A855F7'];

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border border-amber-200',
    paid: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    overdue: 'bg-red-50 text-red-700 border border-red-200',
    cancelled: 'bg-gray-100 text-gray-600 border border-gray-200',
    partial: 'bg-blue-50 text-blue-700 border border-blue-200',
    draft: 'bg-gray-100 text-gray-600 border border-gray-200',
    approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    active: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    closed: 'bg-gray-100 text-gray-600 border border-gray-200',
  };
  return map[status] || 'bg-gray-100 text-gray-600 border border-gray-200';
};

const utilizationColor = (pct: number) => {
  if (pct > 95) return 'bg-red-500';
  if (pct >= 80) return 'bg-amber-500';
  return 'bg-emerald-500';
};

const FinancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'budgets' | 'reports' | 'tax_calendar'>('overview');
  const [loading, setLoading] = useState(true);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'transaction' | 'budget' | 'item'; id: string } | null>(null);

  const [finances, setFinances] = useState<FinanceRecord[]>([]);
  const [totalFinances, setTotalFinances] = useState(0);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowData[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [artists, setArtists] = useState<ArtistOption[]>([]);
  const [projects, setProjects] = useState<Array<{ _id: string; name: string }>>([]);
  const [releases, setReleases] = useState<Array<{ _id: string; title: string }>>([]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetStats, setBudgetStats] = useState<BudgetStats | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [budgetComparison, setBudgetComparison] = useState<any[]>([]);
  const [budgetYearFilter, setBudgetYearFilter] = useState(currentYear);

  const [taxEvents, setTaxEvents] = useState<any[]>([]);

  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [editTransaction, setEditTransaction] = useState<FinanceRecord | null>(null);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [editBudget, setEditBudget] = useState<Budget | null>(null);
  const [showBudgetItemModal, setShowBudgetItemModal] = useState(false);
  const [editBudgetItem, setEditBudgetItem] = useState<BudgetItem | null>(null);

  const [txForm, setTxForm] = useState({
    type: 'income' as 'income' | 'expense',
    category: 'streaming_revenue',
    amount: '',
    description: '',
    artist: '',
    project: '', release: '', department: '', counterparty: '',
    date: new Date().toISOString().split('T')[0],
    invoiceNumber: '',
    paymentMethod: '',
    paymentStatus: 'paid',
    paymentDue: '', accountName: '', accountLast4: '', taxDeductible: false,
    notes: '',
  });

  const [budgetForm, setBudgetForm] = useState({
    name: '',
    year: currentYear,
    quarter: '',
    totalBudget: '',
    artist: '',
    project: '', release: '', department: '',
    status: 'draft',
    notes: '',
  });

  const [budgetItemForm, setBudgetItemForm] = useState({
    category: 'production',
    label: '',
    budgeted: '',
    notes: '',
  });

  const fetchFinances = useCallback(async () => {
    try {
      const params: any = { year, limit: 50 };
      if (typeFilter) params.type = typeFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (searchText) params.search = searchText;
      const res = await financeApi.getAll(params);
      setFinances(res.data.data);
      setTotalFinances(res.data.total);
    } catch (e) { console.error(e); toast.error('Failed to load transactions'); }
  }, [year, typeFilter, categoryFilter, statusFilter, dateFrom, dateTo, searchText]);

  const fetchSummary = useCallback(async () => {
    try {
      const [sumRes, cfRes, cbRes] = await Promise.all([
        financeApi.getSummary(year),
        financeApi.getCashFlow(year),
        financeApi.getCategoryBreakdown(year),
      ]);
      setSummary(sumRes.data.data);
      setCashFlow(cfRes.data.data);
      setCategoryBreakdown(cbRes.data.data);
    } catch (e) { console.error(e); toast.error('Failed to load financial summary'); }
  }, [year]);

  const fetchBudgets = useCallback(async () => {
    try {
      const [budRes, statsRes] = await Promise.all([
        budgetsApi.getAll({ year: budgetYearFilter }),
        budgetsApi.getStats(),
      ]);
      setBudgets(budRes.data.data);
      setBudgetStats(statsRes.data.data);
    } catch (e) { console.error(e); toast.error('Failed to load budgets'); }
  }, [budgetYearFilter]);

  const fetchArtists = useCallback(async () => {
    try {
      const [artistRes, projectRes, releaseRes] = await Promise.all([
        api.get('/artists', { params: { limit: 200 } }), api.get('/projects', { params: { limit: 300 } }), api.get('/releases', { params: { limit: 300 } }),
      ]);
      setArtists(artistRes.data.data || artistRes.data.artists || []);
      setProjects(projectRes.data.data || []);
      setReleases(releaseRes.data.data || []);
    } catch (e) { console.error(e); toast.error('Failed to load finance attribution options'); }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchFinances(), fetchSummary(), fetchBudgets(), fetchArtists()]);
      setLoading(false);
    };
    load();
  }, [fetchFinances, fetchSummary, fetchBudgets, fetchArtists]);

  useEffect(() => { fetchFinances(); }, [fetchFinances]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => { fetchBudgets(); }, [fetchBudgets]);

  useEffect(() => {
    if (selectedBudget) {
      budgetsApi.getActual(selectedBudget._id).then(res => setBudgetComparison(res.data.data)).catch(e => { console.error(e); toast.error('Failed to load budget data'); });
    }
  }, [selectedBudget]);

  useEffect(() => {
    if (activeTab === 'tax_calendar') {
      api.get('/tax-calendar').then((res: any) => setTaxEvents(res.data?.data || [])).catch(e => { console.error(e); toast.error('Failed to load tax events'); });
    }
  }, [activeTab]);

  const handleSaveTransaction = async () => {
    try {
      if (!txForm.description.trim()) return toast.error('Description is required');
      if ((parseFloat(txForm.amount) || 0) <= 0) return toast.error('Amount must be greater than zero');
      if (txForm.type === 'expense' && !txForm.artist && !txForm.project && !txForm.release && !txForm.department) return toast.error('Assign this expense to an artist, project, release, or department');
      const payload = new FormData();
      Object.entries(txForm).forEach(([key, value]) => { if (value !== '') payload.append(key, String(value)); });
      if (receiptFile) payload.append('receipt', receiptFile);
      if (invoiceFile) payload.append('invoice', invoiceFile);
      if (editTransaction) {
        await financeApi.update(editTransaction._id, payload);
        toast.success('Transaction updated');
      } else {
        await financeApi.create(payload);
        toast.success('Transaction created');
      }
      setShowTransactionModal(false);
      setEditTransaction(null);
      resetTxForm();
      await Promise.all([fetchFinances(), fetchSummary()]);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save transaction');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await financeApi.delete(id);
      toast.success('Transaction deleted');
      await Promise.all([fetchFinances(), fetchSummary()]);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to delete');
    }
  };

  const handleSaveBudget = async () => {
    try {
      const payload = {
        ...budgetForm,
        quarter: budgetForm.quarter ? parseInt(budgetForm.quarter as string) : undefined,
        totalBudget: parseFloat(budgetForm.totalBudget) || 0,
        artist: budgetForm.artist || undefined,
        project: budgetForm.project || undefined,
        release: budgetForm.release || undefined,
        department: budgetForm.department || undefined,
      };
      if (editBudget) {
        await budgetsApi.update(editBudget._id, payload);
        toast.success('Budget updated');
      } else {
        await budgetsApi.create(payload);
        toast.success('Budget created');
      }
      setShowBudgetModal(false);
      setEditBudget(null);
      resetBudgetForm();
      await fetchBudgets();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save budget');
    }
  };

  const handleDeleteBudget = async (id: string) => {
    try {
      await budgetsApi.delete(id);
      toast.success('Budget deleted');
      setSelectedBudget(null);
      await fetchBudgets();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to delete');
    }
  };

  const handleSaveBudgetItem = async () => {
    if (!selectedBudget) return;
    try {
      const payload = { ...budgetItemForm, budgeted: parseFloat(budgetItemForm.budgeted) || 0 };
      if (editBudgetItem) {
        await budgetsApi.updateItem(selectedBudget._id, editBudgetItem._id, payload);
        toast.success('Item updated');
      } else {
        await budgetsApi.addItem(selectedBudget._id, payload);
        toast.success('Item added');
      }
      setShowBudgetItemModal(false);
      setEditBudgetItem(null);
      resetBudgetItemForm();
      const res = await budgetsApi.getById(selectedBudget._id);
      setSelectedBudget(res.data.data);
      await fetchBudgets();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save item');
    }
  };

  const handleDeleteBudgetItem = async (itemId: string) => {
    if (!selectedBudget) return;
    try {
      await budgetsApi.deleteItem(selectedBudget._id, itemId);
      toast.success('Item removed');
      const res = await budgetsApi.getById(selectedBudget._id);
      setSelectedBudget(res.data.data);
      await fetchBudgets();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to delete item');
    }
  };

  const resetTxForm = () => { setTxForm({
    type: 'income', category: 'streaming_revenue', amount: '', description: '',
    artist: '', project: '', release: '', department: '', counterparty: '', date: new Date().toISOString().split('T')[0], invoiceNumber: '',
    paymentMethod: '', paymentStatus: 'paid', paymentDue: '', accountName: '', accountLast4: '', taxDeductible: false, notes: '',
  }); setReceiptFile(null); setInvoiceFile(null); };

  const resetBudgetForm = () => setBudgetForm({
    name: '', year: currentYear, quarter: '', totalBudget: '', artist: '', project: '', release: '', department: '', status: 'draft', notes: '',
  });

  const resetBudgetItemForm = () => setBudgetItemForm({
    category: 'production', label: '', budgeted: '', notes: '',
  });

  const openEditTransaction = (f: FinanceRecord) => {
    setEditTransaction(f);
    setTxForm({
      type: f.type,
      category: f.category,
      amount: f.amount.toString(),
      description: f.description || '',
      artist: f.artist?._id || '',
      project: f.project?._id || '', release: f.release?._id || '', department: f.department || '', counterparty: f.counterparty || '',
      date: f.date ? new Date(f.date).toISOString().split('T')[0] : '',
      invoiceNumber: f.invoiceNumber || '',
      paymentMethod: f.paymentMethod || '',
      paymentStatus: f.paymentStatus,
      paymentDue: f.paymentDue?.split('T')[0] || '', accountName: f.accountName || '', accountLast4: f.accountLast4 || '', taxDeductible: !!f.taxDeductible,
      notes: f.notes || '',
    });
    setShowTransactionModal(true);
  };

  const openEditBudget = (b: Budget) => {
    setEditBudget(b);
    setBudgetForm({
      name: b.name,
      year: b.year,
      quarter: b.quarter?.toString() || '',
      totalBudget: b.totalBudget.toString(),
      artist: b.artist?._id || '',
      project: b.project?._id || '', release: b.release?._id || '', department: b.department || '',
      status: b.status,
      notes: b.notes || '',
    });
    setShowBudgetModal(true);
  };

  const openEditBudgetItem = (item: BudgetItem) => {
    setEditBudgetItem(item);
    setBudgetItemForm({
      category: item.category,
      label: item.label,
      budgeted: item.budgeted.toString(),
      notes: item.notes || '',
    });
    setShowBudgetItemModal(true);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-4 py-3 rounded-xl text-sm border border-gray-200 shadow-xl">
          <p className="text-gray-500 mb-2 font-semibold">{label}</p>
          {payload.map((p: any, i: number) => (
            <div key={i} className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              <span className="text-gray-600">{p.name}:</span>
              <span className="text-gray-900 font-bold">{formatCurrency(p.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const tabs = [
    { key: 'overview', label: 'Overview', icon: <BarChart3 size={14} /> },
    { key: 'transactions', label: 'Transactions', icon: <FileText size={14} /> },
    { key: 'budgets', label: 'Budgets', icon: <Wallet size={14} /> },
    { key: 'reports', label: 'Reports', icon: <PieChartIcon size={14} /> },
    { key: 'tax_calendar', label: 'Tax Calendar', icon: <Calendar size={14} /> },
  ] as const;

  const kpiData = summary ? [
    { label: 'Total Revenue', value: formatCurrency(summary.totalRevenue), icon: <TrendingUp size={18} />, color: '#10B981' },
    { label: 'Total Expenses', value: formatCurrency(summary.totalExpenses), icon: <TrendingDown size={18} />, color: '#EF4444' },
    { label: 'Net Profit', value: formatCurrency(summary.profit), icon: <ArrowUpRight size={18} />, color: '#6366F1' },
    { label: 'Pending Payments', value: (summary.pendingCount || 0).toString(), icon: <DollarSign size={18} />, color: '#F59E0B' },
  ] : [];

  const chartData = summary?.monthlyBreakdown || [];
  const pieData = categoryBreakdown
    .filter(c => c.type === 'income' && c.total > 0)
    .slice(0, 8)
    .map((c, i) => ({
      name: CATEGORY_LABELS[c.category] || c.category.replace(/_/g, ' '),
      value: c.total,
      fill: PIE_COLORS[i % PIE_COLORS.length],
    }));

  const tabsForCategories = (
    <select
      value={txForm.category}
      onChange={e => setTxForm(p => ({ ...p, category: e.target.value }))}
      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
    >
      {(txForm.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => (
        <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
      ))}
    </select>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance & Budget</h1>
          <p className="text-sm text-gray-500 mt-1">Track revenue, expenses, and budgets</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10">
            {[0, 1, 2].map(i => <option key={i} value={currentYear - i}>{currentYear - i}</option>)}
          </select>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                activeTab === t.key
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>
              {t.icon}{t.label}
            </button>
          ))}
        </nav>
      </div>

      {loading && <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>}

      {/* ============ OVERVIEW TAB ============ */}
      {!loading && activeTab === 'overview' && summary && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiData.map((s, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15` }}>
                    <span style={{ color: s.color }}>{s.icon}</span>
                  </div>
                </div>
                <div className="text-2xl font-bold text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm xl:col-span-2">
              <div className="mb-5">
                <h3 className="text-base font-bold text-gray-900">Revenue vs Expenses</h3>
                <p className="text-xs text-gray-500 mt-0.5">Monthly breakdown {year}</p>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gRev2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gExp2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10B981" fill="url(#gRev2)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#EF4444" fill="url(#gExp2)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-gray-900 mb-1">Income Breakdown</h3>
              <p className="text-xs text-gray-500 mb-4">Revenue by category</p>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                        {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-3 max-h-32 overflow-y-auto">
                    {pieData.map((d, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
                          <span className="text-gray-600 truncate max-w-[120px]">{d.name}</span>
                        </div>
                        <span className="text-gray-900 font-semibold">{formatCurrency(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No income data</div>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 mb-5">Monthly Trend</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="revenue" name="Revenue" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-gray-900">Recent Transactions</h3>
                <p className="text-xs text-gray-500 mt-0.5">Latest {Math.min(finances.length, 10)} records</p>
              </div>
              <button onClick={() => { resetTxForm(); setEditTransaction(null); setShowTransactionModal(true); }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs transition-all flex items-center gap-2">
                <Plus size={12} />Add Transaction
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Type', 'Category', 'Description', 'Amount', 'Date', 'Status'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {finances.slice(0, 10).map(f => (
                    <tr key={f._id} className="hover:bg-gray-50 transition-colors border-b border-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${f.type === 'income' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                            {f.type === 'income' ? <ArrowUpRight size={12} className="text-emerald-500" /> : <ArrowDownRight size={12} className="text-red-500" />}
                          </div>
                          <span className={`text-xs font-semibold capitalize ${f.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>{f.type}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{CATEGORY_LABELS[f.category] || f.category.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">{f.description || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-bold ${f.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {f.type === 'income' ? '+' : '-'}{formatCurrency(f.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(f.date)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${statusBadge(f.paymentStatus)}`}>
                          {(f.paymentStatus || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ============ TRANSACTIONS TAB ============ */}
      {!loading && activeTab === 'transactions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">All Transactions ({totalFinances})</h2>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowFilters(!showFilters)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <Filter size={14} />Filters
              </button>
              <button onClick={() => { resetTxForm(); setEditTransaction(null); setShowTransactionModal(true); }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition-all flex items-center gap-2">
                <Plus size={14} />Add Transaction
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500">
                  <option value="">All Types</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500">
                  <option value="">All Categories</option>
                  <optgroup label="Income">
                    {INCOME_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                  </optgroup>
                  <optgroup label="Expense">
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                  </optgroup>
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500">
                  <option value="">All Statuses</option>
                  {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </select>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="From" className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500" />
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="To" className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500" />
                <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Search..." className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500" />
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Type', 'Category', 'Description', 'Amount', 'Date', 'Status', 'Artist', 'Payment', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {finances.map(f => (
                    <tr key={f._id} className="hover:bg-gray-50 transition-colors border-b border-gray-50">
                      <td className="px-4 py-3">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${f.type === 'income' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                          {f.type === 'income' ? <ArrowUpRight size={12} className="text-emerald-500" /> : <ArrowDownRight size={12} className="text-red-500" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{CATEGORY_LABELS[f.category] || f.category.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-[200px] truncate">{f.description || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-bold ${f.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {f.type === 'income' ? '+' : '-'}{formatCurrency(f.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(f.date)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${statusBadge(f.paymentStatus)}`}>
                          {(f.paymentStatus || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{f.artist?.stageName || f.artist?.artistName || f.artist?.name || f.project?.name || f.release?.title || f.department?.replace(/_/g, ' ') || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 capitalize">{(f.paymentMethod || '—').replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {f.receiptUrl && <a href={f.receiptUrl} target="_blank" rel="noreferrer" title={f.receiptFileName || 'Receipt'} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"><FileText size={14} /></a>}
                          {f.invoiceUrl && <a href={f.invoiceUrl} target="_blank" rel="noreferrer" title={f.invoiceFileName || 'Invoice'} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Download size={14} /></a>}
                          <button onClick={() => openEditTransaction(f)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => setDeleteTarget({ type: 'transaction', id: f._id })} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {finances.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400 text-sm">No transactions found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============ BUDGETS TAB ============ */}
      {!loading && activeTab === 'budgets' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Budgets</h2>
            <div className="flex items-center gap-3">
              <select value={budgetYearFilter} onChange={e => setBudgetYearFilter(parseInt(e.target.value))} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500">
                {[0, 1, 2].map(i => <option key={i} value={currentYear - i}>{currentYear - i}</option>)}
              </select>
              <button onClick={() => { resetBudgetForm(); setEditBudget(null); setShowBudgetModal(true); }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition-all flex items-center gap-2">
                <Plus size={14} />Create Budget
              </button>
            </div>
          </div>

          {/* Budget stats */}
          {budgetStats && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {[
                { label: 'Total Budgets', value: budgetStats.totalBudgets.toString() },
                { label: 'Active', value: budgetStats.activeBudgets.toString() },
                { label: 'Total Budgeted', value: formatCurrency(budgetStats.totalBudgeted) },
                { label: 'Total Spent', value: formatCurrency(budgetStats.totalSpent) },
                { label: 'Utilization', value: `${budgetStats.utilization}%` },
              ].map((s, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm text-center">
                  <div className="text-xl font-bold text-gray-900">{s.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Budget cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {budgets.map(b => {
              const spent = b.items.reduce((s, i) => s + (i.spent || 0), 0);
              const remaining = b.totalBudget - spent;
              const pct = b.totalBudget > 0 ? Math.round((spent / b.totalBudget) * 100) : 0;
              const isSelected = selectedBudget?._id === b._id;
              return (
                <div key={b._id} className={`bg-white border rounded-xl p-5 shadow-sm cursor-pointer transition-all ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-gray-200 hover:shadow-md'}`}
                  onClick={() => setSelectedBudget(isSelected ? null : b)}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">{b.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {b.year}{b.quarter ? ` Q${b.quarter}` : ' — Full Year'}
                        {b.artist ? ` • ${b.artist.stageName || b.artist.name}` : ' • Label-wide'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${statusBadge(b.status)}`}>
                        {b.status.replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                      <button onClick={e => { e.stopPropagation(); openEditBudget(b); }} className="p-1 text-gray-400 hover:text-indigo-600 rounded">
                        <Edit2 size={12} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); setDeleteTarget({ type: 'budget', id: b._id }); }} className="p-1 text-gray-400 hover:text-red-600 rounded">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-lg font-bold text-gray-900">{formatCurrency(spent)}</span>
                    <span className="text-xs text-gray-500">of {formatCurrency(b.totalBudget)}</span>
                    <span className={`text-xs font-medium ml-auto ${remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {remaining >= 0 ? `${formatCurrency(remaining)} left` : `${formatCurrency(Math.abs(remaining))} over`}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${utilizationColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <div className="text-xs text-gray-400 mt-1 text-right">{pct}% utilized</div>
                </div>
              );
            })}
            {budgets.length === 0 && (
              <div className="col-span-2 text-center py-12 text-gray-400 text-sm bg-white border border-gray-200 rounded-xl">
                No budgets found. Create one to get started.
              </div>
            )}
          </div>

          {/* Budget detail */}
          {selectedBudget && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-base font-bold text-gray-900">{selectedBudget.name} — Budget Items</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{selectedBudget.items.length} item(s) configured</p>
                </div>
                <button onClick={() => { resetBudgetItemForm(); setEditBudgetItem(null); setShowBudgetItemModal(true); }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs transition-all flex items-center gap-2">
                  <Plus size={12} />Add Item
                </button>
              </div>
              {selectedBudget.items.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['Category', 'Label', 'Budgeted', 'Spent', 'Remaining', 'Utilization', 'Actions'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBudget.items.map(item => {
                        const rem = item.budgeted - (item.spent || 0);
                        const pct = item.budgeted > 0 ? Math.round(((item.spent || 0) / item.budgeted) * 100) : 0;
                        return (
                          <tr key={item._id} className="hover:bg-gray-50 border-b border-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-600">{CATEGORY_LABELS[item.category] || item.category.replace(/_/g, ' ')}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{item.label}</td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatCurrency(item.budgeted)}</td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatCurrency(item.spent || 0)}</td>
                            <td className={`px-4 py-3 text-sm font-medium ${rem >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(rem)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden max-w-[100px]">
                                  <div className={`h-full rounded-full ${utilizationColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                </div>
                                <span className="text-xs text-gray-500 w-10 text-right">{pct}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button onClick={() => openEditBudgetItem(item)} className="p-1 text-gray-400 hover:text-indigo-600 rounded">
                                  <Edit2 size={12} />
                                </button>
                                <button onClick={() => setDeleteTarget({ type: 'item', id: item._id })} className="p-1 text-gray-400 hover:text-red-600 rounded">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 text-sm">No budget items yet. Add one to start tracking.</div>
              )}

              {/* Budget vs Actual chart */}
              {budgetComparison.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-bold text-gray-900 mb-3">Budget vs Actual</h4>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={budgetComparison.map(c => ({ name: (CATEGORY_LABELS[c.category] || c.category).slice(0, 15), Budgeted: c.budgeted, Actual: c.actual }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="Budgeted" fill="#6366F1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Actual" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============ REPORTS TAB ============ */}
      {!loading && activeTab === 'reports' && summary && (
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-gray-900">Financial Reports — {year}</h2>

          {/* Quarterly summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {summary.quarterBreakdown.map(q => (
              <div key={q.quarter} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Q{q.quarter}</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-600">Revenue</span><span className="font-bold text-emerald-600">{formatCurrency(q.revenue)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-600">Expenses</span><span className="font-bold text-red-600">{formatCurrency(q.expenses)}</span></div>
                  <div className="border-t border-gray-100 pt-2 flex justify-between text-sm"><span className="text-gray-600">Profit</span><span className={`font-bold ${q.profit >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>{formatCurrency(q.profit)}</span></div>
                </div>
              </div>
            ))}
          </div>

          {/* Category breakdown table */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 mb-4">Category Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Category', 'Type', 'Total', '%', 'Transactions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categoryBreakdown.map((c, i) => (
                    <tr key={i} className="hover:bg-gray-50 border-b border-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-700">{CATEGORY_LABELS[c.category] || c.category.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold capitalize ${c.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>{c.type}</span>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900">{formatCurrency(c.total)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.percentage}%</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{c.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top revenue artists */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-gray-900 mb-4">Top Revenue Artists</h3>
              {summary.topArtists.length > 0 ? (
                <div className="space-y-3">
                  {summary.topArtists.map((a, i) => {
                    const maxRev = summary.topArtists[0]?.total || 1;
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-700 font-medium">{a.name}</span>
                          <span className="text-gray-900 font-bold">{formatCurrency(a.total)}</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(a.total / maxRev) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 text-sm">No artist revenue data</div>
              )}
            </div>

            {/* Top expense categories */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-gray-900 mb-4">Top Expense Categories</h3>
              {summary.topExpenses.length > 0 ? (
                <div className="space-y-3">
                  {summary.topExpenses.map((e, i) => {
                    const maxExp = summary.topExpenses[0]?.total || 1;
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-700 font-medium">{CATEGORY_LABELS[e._id] || e._id.replace(/_/g, ' ')}</span>
                          <span className="text-gray-900 font-bold">{formatCurrency(e.total)}</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-red-500" style={{ width: `${(e.total / maxExp) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 text-sm">No expense data</div>
              )}
            </div>
          </div>

          {/* Cash flow chart */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 mb-5">Cash Flow — {year}</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={cashFlow}>
                <defs>
                  <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="gCashExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="income" name="Income" fill="url(#gIncome)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="url(#gCashExp)" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="balance" name="Running Balance" stroke="#6366F1" strokeWidth={2} dot={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ============ TAX CALENDAR TAB ============ */}
      {!loading && activeTab === 'tax_calendar' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Tax Calendar</h3>
              <p className="text-xs text-gray-500 mt-0.5">{taxEvents.length} events tracked</p>
            </div>
            <a href="/tax-calendar" className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
              Open Full Calendar
            </a>
          </div>
          {taxEvents.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <Calendar size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No tax events yet</p>
              <a href="/tax-calendar" className="text-sm text-indigo-600 hover:underline mt-2 inline-block">Create your first event</a>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Event</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Type</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Due Date</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {taxEvents.slice(0, 10).map((event: any) => {
                    const isOverdue = new Date(event.dueDate) < new Date() && event.status !== 'completed';
                    const statusColors: Record<string, string> = {
                      upcoming: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
                      completed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
                      overdue: 'bg-red-50 text-red-700 border border-red-200',
                      extended: 'bg-amber-50 text-amber-700 border border-amber-200',
                    };
                    return (
                      <tr key={event._id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50/50' : ''}`}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{event.title}</td>
                        <td className="px-4 py-3 text-xs text-gray-600 capitalize">{event.type?.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{new Date(event.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[event.status] || statusColors.upcoming}`}>
                            {event.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{event.amount ? `$${event.amount.toLocaleString()}` : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============ MODALS ============ */}

      {/* Transaction Modal */}
      {showTransactionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowTransactionModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">{editTransaction ? 'Edit Transaction' : 'New Transaction'}</h3>
              <button onClick={() => setShowTransactionModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Type</label>
                  <select value={txForm.type} onChange={e => setTxForm(p => ({ ...p, type: e.target.value as any, category: e.target.value === 'income' ? 'streaming_revenue' : 'production' }))}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10">
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
                  {tabsForCategories}
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Accounting Attribution</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-semibold text-gray-700 mb-1">Project</label><select value={txForm.project} onChange={e => setTxForm(p => ({ ...p, project: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"><option value="">None</option>{projects.map(project => <option key={project._id} value={project._id}>{project.name}</option>)}</select></div>
                  <div><label className="block text-xs font-semibold text-gray-700 mb-1">Release</label><select value={txForm.release} onChange={e => setTxForm(p => ({ ...p, release: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"><option value="">None</option>{releases.map(release => <option key={release._id} value={release._id}>{release.title}</option>)}</select></div>
                  <div><label className="block text-xs font-semibold text-gray-700 mb-1">Department</label><select value={txForm.department} onChange={e => setTxForm(p => ({ ...p, department: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"><option value="">None</option>{['executive','a_and_r','production','marketing','distribution','publishing','legal','finance','touring','merchandise','operations','other'].map(department => <option key={department} value={department}>{department.replace(/_/g, ' ')}</option>)}</select></div>
                  <div><label className="block text-xs font-semibold text-gray-700 mb-1">Vendor / Contractor / Payer</label><input value={txForm.counterparty} onChange={e => setTxForm(p => ({ ...p, counterparty: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" placeholder="Counterparty name" /></div>
                </div>
                {txForm.type === 'expense' && <p className="mt-2 text-[10px] text-gray-400">Every expense must be assigned to at least one artist, project, release, or department.</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Amount</label>
                  <input type="number" value={txForm.amount} onChange={e => setTxForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Date</label>
                  <input type="date" value={txForm.date} onChange={e => setTxForm(p => ({ ...p, date: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-xs font-semibold text-gray-700 mb-1">Payment Due</label><input type="date" value={txForm.paymentDue} onChange={e => setTxForm(p => ({ ...p, paymentDue: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" /></div>
                <div><label className="block text-xs font-semibold text-gray-700 mb-1">Business Account</label><input value={txForm.accountName} onChange={e => setTxForm(p => ({ ...p, accountName: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" placeholder="Operating account" /></div>
                <div><label className="block text-xs font-semibold text-gray-700 mb-1">Account Last 4</label><input maxLength={4} value={txForm.accountLast4} onChange={e => setTxForm(p => ({ ...p, accountLast4: e.target.value.replace(/\D/g, '').slice(0, 4) }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" placeholder="1234" /></div>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700"><input type="checkbox" checked={txForm.taxDeductible} onChange={e => setTxForm(p => ({ ...p, taxDeductible: e.target.checked }))} className="h-4 w-4 rounded" />Tax-deductible business expense</label>
              <div className="grid grid-cols-2 gap-4">
                <label className="cursor-pointer rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-600"><FileText size={14} className="mr-2 inline" />{receiptFile?.name || editTransaction?.receiptFileName || 'Upload receipt'}<input type="file" className="hidden" accept=".pdf,.doc,.docx,.txt,image/jpeg,image/png,image/webp" onChange={e => setReceiptFile(e.target.files?.[0] || null)} /></label>
                <label className="cursor-pointer rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-600"><FileText size={14} className="mr-2 inline" />{invoiceFile?.name || editTransaction?.invoiceFileName || 'Upload invoice'}<input type="file" className="hidden" accept=".pdf,.doc,.docx,.txt,image/jpeg,image/png,image/webp" onChange={e => setInvoiceFile(e.target.files?.[0] || null)} /></label>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
                <input type="text" value={txForm.description} onChange={e => setTxForm(p => ({ ...p, description: e.target.value }))} placeholder="Transaction description"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Artist</label>
                  <select value={txForm.artist} onChange={e => setTxForm(p => ({ ...p, artist: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10">
                    <option value="">None</option>
                    {artists.map(a => <option key={a._id} value={a._id}>{a.stageName || a.artistName || a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Invoice #</label>
                  <input type="text" value={txForm.invoiceNumber} onChange={e => setTxForm(p => ({ ...p, invoiceNumber: e.target.value }))} placeholder="INV-001"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Method</label>
                  <select value={txForm.paymentMethod} onChange={e => setTxForm(p => ({ ...p, paymentMethod: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10">
                    <option value="">None</option>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Status</label>
                  <select value={txForm.paymentStatus} onChange={e => setTxForm(p => ({ ...p, paymentStatus: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10">
                    {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
                <textarea value={txForm.notes} onChange={e => setTxForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Additional notes"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 resize-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowTransactionModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button onClick={handleSaveTransaction} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition-all">{editTransaction ? 'Update' : 'Create'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Budget Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowBudgetModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">{editBudget ? 'Edit Budget' : 'Create Budget'}</h3>
              <button onClick={() => setShowBudgetModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Budget Name</label>
                <input type="text" value={budgetForm.name} onChange={e => setBudgetForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Q1 Marketing Budget"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Year</label>
                  <input type="number" value={budgetForm.year} onChange={e => setBudgetForm(p => ({ ...p, year: parseInt(e.target.value) || currentYear }))}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Quarter (optional)</label>
                  <select value={budgetForm.quarter} onChange={e => setBudgetForm(p => ({ ...p, quarter: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10">
                    <option value="">Full Year</option>
                    <option value="1">Q1</option><option value="2">Q2</option><option value="3">Q3</option><option value="4">Q4</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Total Budget ($)</label>
                  <input type="number" value={budgetForm.totalBudget} onChange={e => setBudgetForm(p => ({ ...p, totalBudget: e.target.value }))} placeholder="0.00"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
                  <select value={budgetForm.status} onChange={e => setBudgetForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10">
                    {['draft', 'approved', 'active', 'closed'].map(s => <option key={s} value={s}>{s.replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Artist (optional, leave blank for label-wide)</label>
                <select value={budgetForm.artist} onChange={e => setBudgetForm(p => ({ ...p, artist: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10">
                  <option value="">Label-wide</option>
                  {artists.map(a => <option key={a._id} value={a._id}>{a.stageName || a.artistName || a.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-gray-700 mb-1">Project</label><select value={budgetForm.project} onChange={e => setBudgetForm(p => ({ ...p, project: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"><option value="">None</option>{projects.map(project => <option key={project._id} value={project._id}>{project.name}</option>)}</select></div>
                <div><label className="block text-xs font-semibold text-gray-700 mb-1">Release</label><select value={budgetForm.release} onChange={e => setBudgetForm(p => ({ ...p, release: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"><option value="">None</option>{releases.map(release => <option key={release._id} value={release._id}>{release.title}</option>)}</select></div>
              </div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Department</label><select value={budgetForm.department} onChange={e => setBudgetForm(p => ({ ...p, department: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"><option value="">None</option>{['executive','a_and_r','production','marketing','distribution','publishing','legal','finance','touring','merchandise','operations','other'].map(department => <option key={department} value={department}>{department.replace(/_/g, ' ')}</option>)}</select></div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
                <textarea value={budgetForm.notes} onChange={e => setBudgetForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Budget notes"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 resize-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowBudgetModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button onClick={handleSaveBudget} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition-all">{editBudget ? 'Update' : 'Create'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Budget Item Modal */}
      {showBudgetItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowBudgetItemModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">{editBudgetItem ? 'Edit Budget Item' : 'Add Budget Item'}</h3>
              <button onClick={() => setShowBudgetItemModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
                <select value={budgetItemForm.category} onChange={e => setBudgetItemForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10">
                  <optgroup label="Income">
                    {INCOME_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                  </optgroup>
                  <optgroup label="Expense">
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Label</label>
                <input type="text" value={budgetItemForm.label} onChange={e => setBudgetItemForm(p => ({ ...p, label: e.target.value }))} placeholder="e.g. Facebook Ads, Studio Time"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Budgeted Amount ($)</label>
                <input type="number" value={budgetItemForm.budgeted} onChange={e => setBudgetItemForm(p => ({ ...p, budgeted: e.target.value }))} placeholder="0.00"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
                <textarea value={budgetItemForm.notes} onChange={e => setBudgetItemForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Item notes"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 resize-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowBudgetItemModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button onClick={handleSaveBudgetItem} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition-all">{editBudgetItem ? 'Update' : 'Add Item'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={deleteTarget?.type === 'transaction' ? 'Delete Transaction' : deleteTarget?.type === 'budget' ? 'Delete Budget' : 'Remove Budget Item'}
        message={deleteTarget?.type === 'transaction'
          ? 'Are you sure you want to delete this transaction? This action cannot be undone.'
          : deleteTarget?.type === 'budget'
            ? 'Are you sure you want to delete this budget and all its items? This action cannot be undone.'
            : 'Are you sure you want to remove this budget item? This action cannot be undone.'}
        confirmLabel="Delete"
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.type === 'transaction') handleDeleteTransaction(deleteTarget.id);
          else if (deleteTarget.type === 'budget') handleDeleteBudget(deleteTarget.id);
          else handleDeleteBudgetItem(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default FinancePage;
