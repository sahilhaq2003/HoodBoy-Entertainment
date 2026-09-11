import React, { useState, useEffect } from 'react';
import {
  FileText, Plus, AlertTriangle, CheckCircle, Clock, DollarSign, Search,
  X, Calendar, Users, Upload, RefreshCw, Shield, TrendingUp, Eye,
  Edit3, Download, UserPlus, Trash2,
} from 'lucide-react';
import { contractsApi } from '../services/api';
import type { Contract, ContractStats, ExpiringContracts } from '../types';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  artist_agreement: 'Artist Agreement', producer_agreement: 'Producer Agreement',
  beat_license: 'Beat License', split_sheet: 'Split Sheet',
  featured_artist: 'Featured Artist', work_for_hire: 'Work for Hire',
  video_release: 'Video Release', photo_release: 'Photo Release',
  contractor: 'Contractor', nda: 'NDA', sync_license: 'Sync License',
  merchandise: 'Merchandise', recording: 'Recording', publishing: 'Publishing',
  distribution: 'Distribution', management: 'Management', licensing: 'Licensing', endorsement: 'Endorsement',
};

const STATUS_COLORS: Record<string, string> = {
  draft: '#6B7280', pending_signature: '#F59E0B', active: '#10B981',
  expired: '#EF4444', terminated: '#9CA3AF', renewed: '#8B5CF6',
};

const Contracts: React.FC = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [stats, setStats] = useState<ContractStats | null>(null);
  const [expiring, setExpiring] = useState<ExpiringContracts | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewDetail, setViewDetail] = useState<Contract | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingTarget, setEditingTarget] = useState<Contract | null>(null);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'alerts'>('list');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '', artist: '', type: 'artist_agreement', status: 'draft',
    startDate: '', endDate: '', signedDate: '', renewalDate: '',
    renewalDeadline: '', renewalNoticeDays: 30, autoRenew: false,
    value: 0, royaltyRate: 0,
    recoupment: { type: 'none' as Contract['recoupment']['type'], advanceAmount: 0, advancePaid: false, recoupmentRate: 100, notes: '' },
    ownershipTerms: '', paymentObligations: { advanceAmount: 0, advancePaid: false, royaltyFrequency: 'quarterly' as Contract['paymentObligations']['royaltyFrequency'], minimumGuarantee: 0, notes: '' },
    terms: '', notes: '', tags: [] as string[],
    parties: [{ name: '', role: '', entity: '' }],
    optionPeriods: [] as Array<{ label: string; durationMonths: number; exerciseDeadline: string; exercised: boolean; notes: string }>,
  });

  const resetForm = () => {
    setForm({
      title: '', artist: '', type: 'artist_agreement', status: 'draft', startDate: '', endDate: '', signedDate: '', renewalDate: '',
      renewalDeadline: '', renewalNoticeDays: 30, autoRenew: false, value: 0, royaltyRate: 0,
      recoupment: { type: 'none', advanceAmount: 0, advancePaid: false, recoupmentRate: 100, notes: '' },
      ownershipTerms: '', paymentObligations: { advanceAmount: 0, advancePaid: false, royaltyFrequency: 'quarterly', minimumGuarantee: 0, notes: '' },
      terms: '', notes: '', tags: [], parties: [{ name: '', role: '', entity: '' }], optionPeriods: [],
    });
    setContractFile(null);
    setEditingTarget(null);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      if (searchQuery) params.search = searchQuery;
      const [contractRes, statsRes, expiringRes] = await Promise.all([
        contractsApi.getAll(params),
        contractsApi.getStats(),
        contractsApi.getExpiring(90),
      ]);
      setContracts(contractRes.data.data);
      setStats(statsRes.data.data);
      setExpiring(expiringRes.data.data);
    } catch { toast.error('Failed to load contracts'); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [statusFilter, typeFilter]);

  const handleSearch = () => { loadData(); };

  const daysUntil = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);

  const handleSave = async () => {
    if (!form.title || !form.startDate || !form.endDate) return toast.error('Title, start and end dates required');
    if (new Date(form.endDate) < new Date(form.startDate)) return toast.error('Expiration date must be after the start date');
    if (form.royaltyRate < 0 || form.royaltyRate > 100) return toast.error('Royalty percentage must be between 0 and 100');
    if (form.parties.some(p => !p.name.trim() || !p.role.trim())) return toast.error('Every party needs a name and role');
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (['parties', 'optionPeriods', 'recoupment', 'paymentObligations', 'tags'].includes(key)) payload.append(key, JSON.stringify(value));
        else if (value !== '') payload.append(key, String(value));
      });
      if (contractFile) payload.append('file', contractFile);
      if (editingTarget) await contractsApi.update(editingTarget._id, payload);
      else await contractsApi.create(payload);
      toast.success(editingTarget ? 'Contract updated' : 'Contract created');
      setShowCreate(false);
      resetForm();
      loadData();
    } catch (error: any) { toast.error(error.response?.data?.message || 'Failed to save contract'); }
  };

  const openCreate = () => { resetForm(); setShowCreate(true); };

  const openEdit = (contract: Contract) => {
    const dateValue = (value?: string) => value ? value.slice(0, 10) : '';
    setEditingTarget(contract);
    setContractFile(null);
    setForm({
      title: contract.title, artist: contract.artist?._id || '', type: contract.type, status: contract.status,
      startDate: dateValue(contract.startDate), endDate: dateValue(contract.endDate), signedDate: dateValue(contract.signedDate), renewalDate: dateValue(contract.renewalDate),
      renewalDeadline: dateValue(contract.renewalDeadline), renewalNoticeDays: contract.renewalNoticeDays ?? 30, autoRenew: !!contract.autoRenew,
      value: contract.value || 0, royaltyRate: contract.royaltyRate || 0,
      recoupment: contract.recoupment || { type: 'none', advanceAmount: 0, advancePaid: false, recoupmentRate: 100, notes: '' },
      ownershipTerms: contract.ownershipTerms || '', paymentObligations: contract.paymentObligations || { advanceAmount: 0, advancePaid: false, royaltyFrequency: 'quarterly', minimumGuarantee: 0, notes: '' },
      terms: contract.terms || '', notes: contract.notes || '', tags: contract.tags || [],
      parties: contract.parties?.length ? contract.parties : [{ name: '', role: '', entity: '' }],
      optionPeriods: (contract.optionPeriods || []).map(option => ({ ...option, exerciseDeadline: dateValue(option.exerciseDeadline), notes: option.notes || '' })),
    });
    setViewDetail(null);
    setShowCreate(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await contractsApi.delete(id);
      toast.success('Contract deleted');
      setContracts(prev => prev.filter(c => c._id !== id));
      setViewDetail(null);
    } catch { toast.error('Failed to delete'); }
  };

  if (loading) return <div className="flex justify-center py-20"><RefreshCw size={24} className="text-indigo-500 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <FileText size={28} className="text-indigo-600" />
            Contracts
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track and manage all legal agreements</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center gap-2">
          <Plus size={15} /> New Contract
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: 'Total', value: stats.total, color: '#8B5CF6', icon: <FileText size={16} /> },
            { label: 'Active', value: stats.byStatus['active'] || 0, color: '#10B981', icon: <CheckCircle size={16} /> },
            { label: 'Expiring Soon', value: stats.expiringSoon, color: '#F59E0B', icon: <Clock size={16} /> },
            { label: 'Expired', value: stats.byStatus['expired'] || 0, color: '#EF4444', icon: <AlertTriangle size={16} /> },
            { label: 'Total Value', value: `$${(stats.totalValue / 1000).toFixed(0)}K`, color: '#6366F1', icon: <DollarSign size={16} /> },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 hover:shadow-md transition-all">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15` }}>
                <span style={{ color: s.color }}>{s.icon}</span>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => setActiveTab('list')} className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
          All Contracts
        </button>
        <button onClick={() => setActiveTab('alerts')} className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${activeTab === 'alerts' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
          <AlertTriangle size={14} /> Expiry Alerts
          {expiring && (expiring.expiringCount + expiring.expiredCount + (expiring.renewalDueCount || 0)) > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full">{expiring.expiringCount + expiring.expiredCount + (expiring.renewalDueCount || 0)}</span>
          )}
        </button>
      </div>

      {/* List Tab */}
      {activeTab === 'list' && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search contracts..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm">
              <option value="">All Status</option>
              {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm">
              <option value="">All Types</option>
              {Object.entries(CONTRACT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Title', 'Type', 'Parties', 'Value', 'Royalty', 'Start', 'Expires', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contracts.map(c => {
                  const days = daysUntil(c.endDate);
                  const isExpiringSoon = days >= 0 && days <= 90;
                  const isExpired = days < 0;
                  return (
                    <tr key={c._id} onClick={() => setViewDetail(c)}
                      className={`hover:bg-gray-50 cursor-pointer border-b border-gray-50 transition-colors ${isExpiringSoon ? 'bg-amber-50/50' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900 max-w-xs truncate">{c.title}</p>
                        {c.artist && <p className="text-xs text-gray-500">{c.artist.stageName || c.artist.name}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-600 capitalize">{(CONTRACT_TYPE_LABELS[c.type] || c.type)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Users size={12} className="text-gray-400" />
                          <span className="text-sm text-gray-600">{c.parties?.length || 0}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-indigo-600">${(c.value || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.royaltyRate}%</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{new Date(c.startDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-600">{new Date(c.endDate).toLocaleDateString()}</div>
                        {isExpiringSoon && <div className="text-xs text-amber-600 flex items-center gap-1 mt-0.5"><AlertTriangle size={10} />{days}d left</div>}
                        {isExpired && <div className="text-xs text-red-600">Expired</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{ background: `${STATUS_COLORS[c.status]}15`, color: STATUS_COLORS[c.status] }}>
                          {c.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {contracts.length === 0 && <div className="text-center py-12 text-gray-500 text-sm">No contracts found</div>}
          </div>
        </>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && expiring && (
        <div className="space-y-6">
          {(expiring.renewalDue || []).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-indigo-500 mb-3 flex items-center gap-2"><Calendar size={16} /> Renewal Decisions Due ({expiring.renewalDueCount})</h3>
              <div className="space-y-2">{expiring.renewalDue.map(c => (
                <div key={c._id} className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between">
                  <div><p className="text-sm font-bold text-gray-900">{c.title}</p><p className="text-xs text-gray-500">{c.artist?.stageName || c.artist?.name || 'No artist'} · Decision due {c.renewalDeadline ? new Date(c.renewalDeadline).toLocaleDateString() : '—'}</p></div>
                  <button onClick={() => setViewDetail(c)} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50">Review</button>
                </div>
              ))}</div>
            </div>
          )}
          {expiring.expired.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-red-600 mb-3 flex items-center gap-2">
                <AlertTriangle size={16} /> Expired Contracts ({expiring.expiredCount})
              </h3>
              <div className="space-y-2">
                {expiring.expired.map(c => (
                  <div key={c._id} className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{c.title}</p>
                      <p className="text-xs text-gray-500">{c.artist?.stageName || c.artist?.name} · Expired {new Date(c.endDate).toLocaleDateString()}</p>
                    </div>
                    <button onClick={() => setViewDetail(c)} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50">View</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {expiring.expiring.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-amber-600 mb-3 flex items-center gap-2">
                <Clock size={16} /> Expiring Within 90 Days ({expiring.expiringCount})
              </h3>
              <div className="space-y-2">
                {expiring.expiring.map(c => {
                  const days = daysUntil(c.endDate);
                  return (
                    <div key={c._id} className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{c.title}</p>
                        <p className="text-xs text-gray-500">{c.artist?.stageName || c.artist?.name} · Expires in {days} days</p>
                      </div>
                      <button onClick={() => setViewDetail(c)} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50">View</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {expiring.expired.length === 0 && expiring.expiring.length === 0 && (expiring.renewalDue || []).length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <CheckCircle size={40} className="mx-auto text-green-400 mb-3" />
              <p className="text-sm font-semibold">All contracts are current</p>
            </div>
          )}
        </div>
      )}

      {/* Contract Detail Modal */}
      {viewDetail && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setViewDetail(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl overflow-hidden flex flex-col dark:bg-gray-900 dark:border dark:border-gray-700" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{viewDetail.title}</h3>
                <p className="text-xs text-gray-500 capitalize dark:text-gray-400">{CONTRACT_TYPE_LABELS[viewDetail.type] || viewDetail.type}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{ background: `${STATUS_COLORS[viewDetail.status]}15`, color: STATUS_COLORS[viewDetail.status] }}>
                  {viewDetail.status.replace(/_/g, ' ')}
                </span>
                <button onClick={() => setViewDetail(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 dark:text-gray-500 dark:hover:bg-gray-800"><X size={18} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['Artist', viewDetail.artist?.stageName || viewDetail.artist?.name || '—'],
                  ['Value', `$${(viewDetail.value || 0).toLocaleString()}`],
                  ['Start Date', new Date(viewDetail.startDate).toLocaleDateString()],
                  ['End Date', new Date(viewDetail.endDate).toLocaleDateString()],
                  ['Signed Date', viewDetail.signedDate ? new Date(viewDetail.signedDate).toLocaleDateString() : '—'],
                  ['Renewal Date', viewDetail.renewalDate ? new Date(viewDetail.renewalDate).toLocaleDateString() : '—'],
                  ['Renewal Deadline', viewDetail.renewalDeadline ? new Date(viewDetail.renewalDeadline).toLocaleDateString() : '—'],
                  ['Renewal Notice', `${viewDetail.renewalNoticeDays || 0} days`],
                  ['Royalty Rate', `${viewDetail.royaltyRate}%`],
                  ['Auto-Renew', viewDetail.autoRenew ? 'Yes' : 'No'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</p>
                  </div>
                ))}
              </div>

              {/* Parties */}
              {viewDetail.parties && viewDetail.parties.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 dark:text-gray-400">Parties Involved</h4>
                  <div className="bg-gray-50 rounded-lg p-3 dark:bg-gray-800 space-y-2">
                    {viewDetail.parties.map((p, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{p.name}</span>
                        <span className="text-gray-400 dark:text-gray-500">·</span>
                        <span className="text-gray-600 dark:text-gray-300">{p.role}</span>
                        {p.entity && <><span className="text-gray-400 dark:text-gray-500">·</span><span className="text-gray-500 text-xs dark:text-gray-400">{p.entity}</span></>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recoupment */}
              {viewDetail.recoupment && viewDetail.recoupment.type !== 'none' && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 dark:text-gray-400">Recoupment</h4>
                  <div className="bg-gray-50 rounded-lg p-3 dark:bg-gray-800 grid grid-cols-3 gap-3 text-sm">
                    <div><p className="text-xs text-gray-400 dark:text-gray-500">Type</p><p className="font-medium capitalize dark:text-gray-100">{viewDetail.recoupment.type.replace(/_/g, ' ')}</p></div>
                    <div><p className="text-xs text-gray-400 dark:text-gray-500">Advance</p><p className="font-medium dark:text-gray-100">${(viewDetail.recoupment.advanceAmount || 0).toLocaleString()}</p></div>
                    <div><p className="text-xs text-gray-400 dark:text-gray-500">Rate</p><p className="font-medium dark:text-gray-100">{viewDetail.recoupment.recoupmentRate}%</p></div>
                  </div>
                </div>
              )}

              {/* Payment */}
              {viewDetail.paymentObligations && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 dark:text-gray-400">Payment Obligations</h4>
                  <div className="bg-gray-50 rounded-lg p-3 dark:bg-gray-800 grid grid-cols-3 gap-3 text-sm">
                    <div><p className="text-xs text-gray-400 dark:text-gray-500">Advance</p><p className="font-medium dark:text-gray-100">${(viewDetail.paymentObligations.advanceAmount || 0).toLocaleString()}</p></div>
                    <div><p className="text-xs text-gray-400 dark:text-gray-500">Frequency</p><p className="font-medium capitalize dark:text-gray-100">{(viewDetail.paymentObligations.royaltyFrequency || '').replace(/_/g, ' ')}</p></div>
                    <div><p className="text-xs text-gray-400 dark:text-gray-500">Min Guarantee</p><p className="font-medium dark:text-gray-100">${(viewDetail.paymentObligations.minimumGuarantee || 0).toLocaleString()}</p></div>
                  </div>
                </div>
              )}

              {/* Terms / Ownership */}
              {viewDetail.ownershipTerms && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 dark:text-gray-400">Ownership Terms</h4>
                   <p className="text-sm text-gray-700 dark:text-gray-200 bg-gray-50 rounded-lg p-3 dark:bg-gray-800">{viewDetail.ownershipTerms}</p>
                 </div>
               )}

               {/* Notes */}
               {viewDetail.notes && (
                 <div>
                   <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 dark:text-gray-400">Notes</h4>
                   <p className="text-sm text-gray-700 dark:text-gray-200 bg-gray-50 rounded-lg p-3 dark:bg-gray-800">{viewDetail.notes}</p>
                </div>
              )}
              {viewDetail.optionPeriods?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 dark:text-gray-400">Option Periods</h4>
                  <div className="space-y-2">{viewDetail.optionPeriods.map((option, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-3 dark:bg-gray-800 flex items-center justify-between gap-3 text-sm">
                      <div><p className="font-medium text-gray-900 dark:text-gray-100">{option.label || `Option ${index + 1}`}</p><p className="text-xs text-gray-500 dark:text-gray-400">{option.durationMonths} months{option.exerciseDeadline ? ` · Exercise by ${new Date(option.exerciseDeadline).toLocaleDateString()}` : ''}</p></div>
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${option.exercised ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>{option.exercised ? 'Exercised' : 'Open'}</span>
                    </div>
                  ))}</div>
                </div>
              )}
              {viewDetail.fileUrl && (
                <a href={viewDetail.fileUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm font-medium text-indigo-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-indigo-400 dark:hover:bg-gray-700">
                  <span className="flex items-center gap-2"><FileText size={15} />{viewDetail.fileName || 'Contract document'}</span><Download size={15} />
                </a>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setDeleteTarget(viewDetail._id)} className="px-3 py-2 bg-white border border-red-200 rounded-lg text-xs text-red-600 hover:bg-red-50 dark:bg-gray-800 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-500/10">Delete</button>
              <button onClick={() => openEdit(viewDetail)} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"><Edit3 size={13} />Edit</button>
              <button onClick={() => setViewDetail(null)} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[85vh] shadow-2xl overflow-y-auto p-6 dark:bg-gray-900 dark:border dark:border-gray-700" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{editingTarget ? 'Edit Contract' : 'New Contract'}</h3>
              <button onClick={() => { setShowCreate(false); resetForm(); }} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 dark:text-gray-500 dark:hover:bg-gray-800"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Title</label>
                  <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Type</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                    {Object.entries(CONTRACT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Status</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                    {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Start Date</label>
                  <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">End Date</label>
                  <input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Renewal Date</label>
                  <input type="date" value={form.renewalDate} onChange={e => setForm(p => ({ ...p, renewalDate: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Date Signed</label>
                  <input type="date" value={form.signedDate} onChange={e => setForm(p => ({ ...p, signedDate: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Renewal Deadline</label>
                  <input type="date" value={form.renewalDeadline} onChange={e => setForm(p => ({ ...p, renewalDeadline: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Notice (days)</label>
                  <input type="number" min="0" value={form.renewalNoticeDays} onChange={e => setForm(p => ({ ...p, renewalNoticeDays: +e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-600"><input type="checkbox" checked={form.autoRenew} onChange={e => setForm(p => ({ ...p, autoRenew: e.target.checked }))} className="h-4 w-4 rounded" />Automatically renew under the recorded terms</label>

              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <div className="mb-3 flex items-center justify-between"><div><h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Parties involved</h4><p className="text-[10px] text-gray-500 dark:text-gray-400">Record every person or entity bound by this agreement.</p></div><button type="button" onClick={() => setForm(p => ({ ...p, parties: [...p.parties, { name: '', role: '', entity: '' }] }))} className="flex items-center gap-1 text-xs font-semibold text-indigo-600"><UserPlus size={13} />Add party</button></div>
                <div className="space-y-2">{form.parties.map((party, index) => <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2"><input placeholder="Name *" value={party.name} onChange={e => setForm(p => ({ ...p, parties: p.parties.map((item, i) => i === index ? { ...item, name: e.target.value } : item) }))} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /><input placeholder="Role *" value={party.role} onChange={e => setForm(p => ({ ...p, parties: p.parties.map((item, i) => i === index ? { ...item, role: e.target.value } : item) }))} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /><input placeholder="Company / entity" value={party.entity} onChange={e => setForm(p => ({ ...p, parties: p.parties.map((item, i) => i === index ? { ...item, entity: e.target.value } : item) }))} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /><button type="button" disabled={form.parties.length === 1} onClick={() => setForm(p => ({ ...p, parties: p.parties.filter((_, i) => i !== index) }))} className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30"><Trash2 size={15} /></button></div>)}</div>
              </div>

              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <div className="mb-3 flex items-center justify-between"><div><h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Option periods</h4><p className="text-[10px] text-gray-500 dark:text-gray-400">Track each extension and its exercise deadline.</p></div><button type="button" onClick={() => setForm(p => ({ ...p, optionPeriods: [...p.optionPeriods, { label: `Option ${p.optionPeriods.length + 1}`, durationMonths: 12, exerciseDeadline: '', exercised: false, notes: '' }] }))} className="text-xs font-semibold text-indigo-600">+ Add option</button></div>
                {form.optionPeriods.length === 0 ? <p className="py-2 text-center text-xs text-gray-400 dark:text-gray-500">No option periods</p> : <div className="space-y-3">{form.optionPeriods.map((option, index) => <div key={index} className="grid grid-cols-[1fr_100px_1fr_auto] gap-2"><input placeholder="Option label" value={option.label} onChange={e => setForm(p => ({ ...p, optionPeriods: p.optionPeriods.map((item, i) => i === index ? { ...item, label: e.target.value } : item) }))} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /><input type="number" min="1" title="Duration in months" value={option.durationMonths} onChange={e => setForm(p => ({ ...p, optionPeriods: p.optionPeriods.map((item, i) => i === index ? { ...item, durationMonths: +e.target.value } : item) }))} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /><input type="date" title="Exercise deadline" value={option.exerciseDeadline} onChange={e => setForm(p => ({ ...p, optionPeriods: p.optionPeriods.map((item, i) => i === index ? { ...item, exerciseDeadline: e.target.value } : item) }))} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /><button type="button" onClick={() => setForm(p => ({ ...p, optionPeriods: p.optionPeriods.filter((_, i) => i !== index) }))} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={15} /></button></div>)}</div>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Contract Value ($)</label>
                  <input type="number" value={form.value} onChange={e => setForm(p => ({ ...p, value: +e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Royalty Rate (%)</label>
                  <input type="number" value={form.royaltyRate} onChange={e => setForm(p => ({ ...p, royaltyRate: +e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700 space-y-3">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recoupment terms</h4>
                <div className="grid grid-cols-3 gap-3"><select value={form.recoupment.type} onChange={e => setForm(p => ({ ...p, recoupment: { ...p.recoupment, type: e.target.value as any } }))} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"><option value="none">Not recoupable</option><option value="recoupable">Recoupable</option><option value="partially_recoupable">Partially recoupable</option><option value="cross_collateralized">Cross-collateralized</option></select><input type="number" min="0" placeholder="Advance" value={form.recoupment.advanceAmount} onChange={e => setForm(p => ({ ...p, recoupment: { ...p.recoupment, advanceAmount: +e.target.value } }))} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /><input type="number" min="0" max="100" placeholder="Recoupment %" value={form.recoupment.recoupmentRate} onChange={e => setForm(p => ({ ...p, recoupment: { ...p.recoupment, recoupmentRate: +e.target.value } }))} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /></div>
                <textarea placeholder="Recoupment notes" value={form.recoupment.notes} onChange={e => setForm(p => ({ ...p, recoupment: { ...p.recoupment, notes: e.target.value } }))} rows={2} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
              </div>
              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700 space-y-3">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Payment obligations</h4>
                <div className="grid grid-cols-3 gap-3"><input type="number" min="0" placeholder="Advance amount" value={form.paymentObligations.advanceAmount} onChange={e => setForm(p => ({ ...p, paymentObligations: { ...p.paymentObligations, advanceAmount: +e.target.value } }))} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /><select value={form.paymentObligations.royaltyFrequency} onChange={e => setForm(p => ({ ...p, paymentObligations: { ...p.paymentObligations, royaltyFrequency: e.target.value as any } }))} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="semi_annual">Semi-annual</option><option value="annual">Annual</option></select><input type="number" min="0" placeholder="Minimum guarantee" value={form.paymentObligations.minimumGuarantee} onChange={e => setForm(p => ({ ...p, paymentObligations: { ...p.paymentObligations, minimumGuarantee: +e.target.value } }))} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /></div>
                <textarea placeholder="Payment notes and obligations" value={form.paymentObligations.notes} onChange={e => setForm(p => ({ ...p, paymentObligations: { ...p.paymentObligations, notes: e.target.value } }))} rows={2} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Ownership Terms</label>
                <textarea value={form.ownershipTerms} onChange={e => setForm(p => ({ ...p, ownershipTerms: e.target.value }))} rows={2} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">General Contract Terms</label>
                <textarea value={form.terms} onChange={e => setForm(p => ({ ...p, terms: e.target.value }))} rows={3} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Contract File</label>
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600 hover:border-indigo-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"><span className="flex items-center gap-2"><Upload size={15} />{contractFile?.name || (editingTarget?.fileName ? `Replace ${editingTarget.fileName}` : 'Upload PDF, DOC, DOCX, image, or TXT')}</span><input type="file" className="hidden" accept=".pdf,.doc,.docx,.txt,image/jpeg,image/png,image/webp" onChange={e => setContractFile(e.target.files?.[0] || null)} /></label>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => { setShowCreate(false); resetForm(); }} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={handleSave} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">{editingTarget ? 'Save Changes' : 'Create Contract'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Contract"
        message="Are you sure you want to delete this contract? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default Contracts;
