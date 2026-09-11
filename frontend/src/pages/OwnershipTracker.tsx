import React, { useState, useEffect } from 'react';
import {
  Shield, Plus, Trash2, AlertTriangle, CheckCircle, Music,
  Search, RefreshCw, ChevronDown, ChevronUp, Save, Award, FileSignature,
} from 'lucide-react';
import { ownershipApi, songsApi } from '../services/api';
import type { Ownership, OwnershipWriter, OwnershipPublisher, OwnershipFeaturedArtist, OwnershipSample, OwnershipSignature, BeatLicense, Song } from '../types';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const getApiError = (error: unknown, fallback: string) => {
  const response = (error as { response?: { data?: { message?: string; errors?: string[] } } })?.response?.data;
  return response?.errors?.[0] || response?.message || fallback;
};

const OwnershipTracker: React.FC = () => {
  const [ownerships, setOwnerships] = useState<Ownership[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [selectedSong, setSelectedSong] = useState('');
  const [form, setForm] = useState({
    masterOwner: '', producer: '', producerPercentage: 0,
    writers: [{ name: '', percentage: 0, role: 'songwriter' as const }] as OwnershipWriter[],
    publishers: [{ name: '', percentage: 0, type: 'admin' as const }] as OwnershipPublisher[],
    featuredArtists: [] as OwnershipFeaturedArtist[],
    samples: [] as OwnershipSample[],
    beatLicense: { type: 'none' as BeatLicense['type'], producer: '', cost: 0, terms: '', purchaseDate: '', expirationDate: '', licenseNumber: '', territory: '', usageLimit: '', documentUrl: '' },
    signatures: [] as OwnershipSignature[],
    copyrightStatus: 'not_registered' as Ownership['copyrightStatus'],
    copyrightNumber: '',
    proStatus: 'not_registered' as Ownership['proStatus'],
    proName: '',
    proIpi: '',
    distributionStatus: 'pending_metadata' as Ownership['distributionStatus'],
    notes: '',
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [ownRes, songRes] = await Promise.all([ownershipApi.getAll(), songsApi.getAll()]);
        setOwnerships(ownRes.data.data);
        setSongs(songRes.data.data);
      } catch { toast.error('Failed to load data'); }
      setLoading(false);
    })();
  }, []);

  const filteredOwnerships = ownerships.filter(o => {
    const matchesSearch = !searchQuery || o.songId?.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = !filterStatus ||
      (filterStatus === 'complete' && o.isComplete) ||
      (filterStatus === 'incomplete' && !o.isComplete) ||
      (filterStatus === 'approved' && o.releaseApproved) ||
      (filterStatus === 'pending' && o.isReadyForRelease && !o.releaseApproved);
    return matchesSearch && matchesFilter;
  });

  const loadForm = (o: Ownership) => {
    setForm({
      masterOwner: o.masterOwner, producer: o.producer, producerPercentage: o.producerPercentage,
      writers: o.writers.length ? o.writers : [{ name: '', percentage: 0, role: 'songwriter' }],
      publishers: o.publishers.length ? o.publishers : [{ name: '', percentage: 0, type: 'admin' }],
      featuredArtists: o.featuredArtists, samples: o.samples,
      beatLicense: {
        ...o.beatLicense,
        purchaseDate: o.beatLicense?.purchaseDate || '',
        expirationDate: o.beatLicense?.expirationDate || '',
        licenseNumber: o.beatLicense?.licenseNumber || '',
        territory: o.beatLicense?.territory || '',
        usageLimit: o.beatLicense?.usageLimit || '',
        documentUrl: o.beatLicense?.documentUrl || '',
      },
      signatures: o.signatures || [], copyrightStatus: o.copyrightStatus, copyrightNumber: o.copyrightNumber,
      proStatus: o.proStatus, proName: o.proName, proIpi: o.proIpi,
      distributionStatus: o.distributionStatus, notes: o.notes,
    });
  };

  const getWriterTotal = () => form.writers.reduce((s, w) => s + (w.percentage || 0), 0);
  const getPublisherTotal = () => form.publishers.reduce((s, p) => s + (p.percentage || 0), 0);
  const getFeaturedTotal = () => form.featuredArtists.reduce((s, f) => s + (f.percentage || 0), 0);
  const getSampleTotal = () => form.samples.reduce((s, s2) => s + (s2.percentage || 0), 0);
  const getTotal = () => getWriterTotal() + form.producerPercentage + getFeaturedTotal() + getPublisherTotal() + getSampleTotal();

  const handleSave = async (songId: string) => {
    try {
      const payload = {
        ...form,
        writers: form.writers.filter(writer => writer.name.trim()),
        publishers: form.publishers.filter(publisher => publisher.name.trim() || publisher.percentage > 0),
        featuredArtists: form.featuredArtists.filter(featured => featured.name.trim() || featured.percentage > 0),
        samples: form.samples.filter(sample => sample.title.trim() || sample.owner.trim()),
        signatures: form.signatures.filter(signature => signature.partyName.trim()),
      };
      const response = await ownershipApi.createOrUpdate({ songId, ...payload });
      const validation = response.data.validation as { valid: boolean; errors: string[] };
      toast.success(validation.valid ? 'Ownership saved and ready for approval' : `Saved — ${validation.errors.length} requirement(s) remain`);
      if (validation.valid) setEditing(null);
      const res = await ownershipApi.getAll();
      setOwnerships(res.data.data);
    } catch (error) { toast.error(getApiError(error, 'Failed to save')); }
  };

  const handleApprove = async (songId: string) => {
    try {
      await ownershipApi.approve(songId);
      toast.success('Ownership approved for release');
      const res = await ownershipApi.getAll();
      setOwnerships(res.data.data);
    } catch (error) { toast.error(getApiError(error, 'Cannot approve — validation failed')); }
  };

  const handleDelete = async (songId: string) => {
    try {
      await ownershipApi.delete(songId);
      toast.success('Deleted');
      setOwnerships(prev => prev.filter(o => o.songId?._id !== songId));
    } catch { toast.error('Failed to delete'); }
  };

  const addWriter = () => setForm(p => ({ ...p, writers: [...p.writers, { name: '', percentage: 0, role: 'songwriter' }] }));
  const removeWriter = (i: number) => setForm(p => ({ ...p, writers: p.writers.filter((_, idx) => idx !== i) }));
  const updateWriter = (i: number, field: string, val: any) => setForm(p => ({ ...p, writers: p.writers.map((w, idx) => idx === i ? { ...w, [field]: val } : w) }));

  const addPublisher = () => setForm(p => ({ ...p, publishers: [...p.publishers, { name: '', percentage: 0, type: 'admin' }] }));
  const removePublisher = (i: number) => setForm(p => ({ ...p, publishers: p.publishers.filter((_, idx) => idx !== i) }));
  const updatePublisher = (i: number, field: string, val: any) => setForm(p => ({ ...p, publishers: p.publishers.map((w, idx) => idx === i ? { ...w, [field]: val } : w) }));

  const addFeatured = () => setForm(p => ({ ...p, featuredArtists: [...p.featuredArtists, { name: '', percentage: 0 }] }));
  const removeFeatured = (i: number) => setForm(p => ({ ...p, featuredArtists: p.featuredArtists.filter((_, idx) => idx !== i) }));
  const updateFeatured = (i: number, field: string, val: any) => setForm(p => ({ ...p, featuredArtists: p.featuredArtists.map((f, idx) => idx === i ? { ...f, [field]: val } : f) }));

  const addSample = () => setForm(p => ({ ...p, samples: [...p.samples, { title: '', originalArtist: '', owner: '', percentage: 0, clearanceStatus: 'pending', notes: '' }] }));
  const removeSample = (i: number) => setForm(p => ({ ...p, samples: p.samples.filter((_, idx) => idx !== i) }));
  const updateSample = (i: number, field: string, val: any) => setForm(p => ({ ...p, samples: p.samples.map((s, idx) => idx === i ? { ...s, [field]: val } : s) }));
  const updateBeatLicense = (field: keyof BeatLicense, value: string | number) => setForm(previous => ({
    ...previous,
    beatLicense: { ...previous.beatLicense, [field]: value },
  }));

  const addSignature = () => setForm(p => ({ ...p, signatures: [...p.signatures, { partyName: '', role: 'other', status: 'pending', documentUrl: '', signedAt: '', notes: '' }] }));
  const removeSignature = (i: number) => setForm(p => ({ ...p, signatures: p.signatures.filter((_, idx) => idx !== i) }));
  const updateSignature = (i: number, field: string, val: string) => setForm(p => ({ ...p, signatures: p.signatures.map((signature, idx) => idx === i ? { ...signature, [field]: val } : signature) }));

  const total = getTotal();
  const getPercentageColor = (value: number) => value === 100 ? '#10B981' : value > 100 ? '#EF4444' : '#F59E0B';

  const addNewOwnership = async () => {
    if (!selectedSong) return toast.error('Select a song');
    try {
      const response = await ownershipApi.createOrUpdate({ songId: selectedSong });
      const created: Ownership = response.data.data;
      setOwnerships(previous => [...previous, created]);
      loadForm(created);
      setEditing(created._id);
      setShowCreate(false);
      setSelectedSong('');
      toast.success('Ownership draft created');
    } catch (error) {
      toast.error(getApiError(error, 'Failed to create ownership record'));
    }
  };

  if (loading) return <div className="flex justify-center py-20"><RefreshCw size={24} className="text-indigo-500 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Shield size={28} className="text-indigo-600" />
            Rights & Ownership
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track song ownership and validate before release</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center gap-2">
          <Plus size={15} /> Add Ownership
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total', value: ownerships.length, color: '#8B5CF6' },
          { label: 'Complete (100%)', value: ownerships.filter(o => o.isComplete).length, color: '#10B981' },
          { label: 'Incomplete', value: ownerships.filter(o => !o.isComplete).length, color: '#F59E0B' },
          { label: 'Ready to Approve', value: ownerships.filter(o => o.isReadyForRelease && !o.releaseApproved).length, color: '#14B8A6' },
          { label: 'Approved', value: ownerships.filter(o => o.releaseApproved).length, color: '#06B6D4' },
          { label: 'Avg %', value: `${(ownerships.reduce((s, o) => s + (o.totalPercentage || 0), 0) / Math.max(ownerships.length, 1)).toFixed(1)}%`, color: '#6366F1' },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search songs..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm">
          <option value="">All Status</option>
          <option value="complete">Complete (100%)</option>
          <option value="incomplete">Incomplete</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending Approval</option>
        </select>
      </div>

      {/* Ownership List */}
      <div className="space-y-3">
        {filteredOwnerships.map(o => (
          <div key={o._id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50"
              onClick={() => {
                if (editing === o._id) setEditing(null);
                else { loadForm(o); setEditing(o._id); }
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Music size={18} className="text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{o.songId?.title || 'Unknown Song'}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">Master: {o.masterOwner || '—'}</span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-500">Producer: {o.producer || '—'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Percentage badge */}
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(editing === o._id ? total : o.totalPercentage, 100)}%`, backgroundColor: getPercentageColor(editing === o._id ? total : o.totalPercentage) }} />
                  </div>
                  <span className="text-sm font-bold" style={{ color: getPercentageColor(editing === o._id ? total : o.totalPercentage) }}>
                    {editing === o._id ? total : o.totalPercentage || 0}%
                  </span>
                </div>
                {o.isReadyForRelease ? (
                  <CheckCircle size={16} className="text-green-500" />
                ) : (
                  <AlertTriangle size={16} className="text-amber-500" />
                )}
                {o.releaseApproved && <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">APPROVED</span>}
                {editing === o._id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </div>
            </div>

            {/* Edit Form */}
            {editing === o._id && (
              <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-5">
                {/* Master Owner + Producer */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Master Owner</label>
                    <input value={form.masterOwner} onChange={e => setForm(p => ({ ...p, masterOwner: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Producer</label>
                    <input value={form.producer} onChange={e => setForm(p => ({ ...p, producer: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Producer %</label>
                    <input type="number" min={0} max={100} value={form.producerPercentage} onChange={e => setForm(p => ({ ...p, producerPercentage: +e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500" />
                  </div>
                </div>

                {/* Writers */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-600">Writers ({getWriterTotal()}%)</label>
                    <button onClick={addWriter} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"><Plus size={12} /> Add</button>
                  </div>
                  <div className="space-y-2">
                    {form.writers.map((w, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input placeholder="Name" value={w.name} onChange={e => updateWriter(i, 'name', e.target.value)} className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                        <input type="number" min={0} max={100} placeholder="%" value={w.percentage} onChange={e => updateWriter(i, 'percentage', +e.target.value)} className="w-20 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                        <select value={w.role} onChange={e => updateWriter(i, 'role', e.target.value)} className="px-2 py-2 bg-white border border-gray-300 rounded-lg text-xs">
                          <option value="songwriter">Songwriter</option><option value="composer">Composer</option><option value="lyricist">Lyricist</option><option value="arranger">Arranger</option>
                        </select>
                        <button onClick={() => removeWriter(i)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Publishers */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-600">Publishers ({getPublisherTotal()}%)</label>
                    <button onClick={addPublisher} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"><Plus size={12} /> Add</button>
                  </div>
                  <div className="space-y-2">
                    {form.publishers.map((p, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input placeholder="Publisher name" value={p.name} onChange={e => updatePublisher(i, 'name', e.target.value)} className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                        <input type="number" min={0} max={100} placeholder="%" value={p.percentage} onChange={e => updatePublisher(i, 'percentage', +e.target.value)} className="w-20 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                        <select value={p.type} onChange={e => updatePublisher(i, 'type', e.target.value)} className="px-2 py-2 bg-white border border-gray-300 rounded-lg text-xs">
                          <option value="admin">Admin</option><option value="co_publishing">Co-Pub</option><option value="sub_publishing">Sub-Pub</option><option value="mechanical">Mechanical</option>
                        </select>
                        <button onClick={() => removePublisher(i)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Featured Artists */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-600">Featured Artists ({getFeaturedTotal()}%)</label>
                    <button onClick={addFeatured} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"><Plus size={12} /> Add</button>
                  </div>
                  <div className="space-y-2">
                    {form.featuredArtists.map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input placeholder="Artist name" value={f.name} onChange={e => updateFeatured(i, 'name', e.target.value)} className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                        <input type="number" min={0} max={100} placeholder="%" value={f.percentage} onChange={e => updateFeatured(i, 'percentage', +e.target.value)} className="w-20 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                        <button onClick={() => removeFeatured(i)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Beat license */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileSignature size={14} className="text-indigo-500" />
                    <label className="text-xs font-semibold text-gray-600">Beat-License Terms and Evidence</label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    <select value={form.beatLicense.type} onChange={e => updateBeatLicense('type', e.target.value)} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm">
                      <option value="none">No external beat</option><option value="exclusive">Exclusive</option><option value="non_exclusive">Non-exclusive</option><option value="lease">Lease</option><option value="work_for_hire">Work for hire</option>
                    </select>
                    <input placeholder="Beat producer" value={form.beatLicense.producer} onChange={e => updateBeatLicense('producer', e.target.value)} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                    <input type="number" min={0} placeholder="License cost" value={form.beatLicense.cost} onChange={e => updateBeatLicense('cost', +e.target.value)} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                    <input placeholder="License number" value={form.beatLicense.licenseNumber || ''} onChange={e => updateBeatLicense('licenseNumber', e.target.value)} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                    <label className="text-[10px] text-gray-500">Purchase date<input type="date" value={form.beatLicense.purchaseDate?.slice(0, 10) || ''} onChange={e => updateBeatLicense('purchaseDate', e.target.value)} className="mt-1 w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" /></label>
                    <label className="text-[10px] text-gray-500">Expiration date<input type="date" value={form.beatLicense.expirationDate?.slice(0, 10) || ''} onChange={e => updateBeatLicense('expirationDate', e.target.value)} className="mt-1 w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" /></label>
                    <input placeholder="Territory" value={form.beatLicense.territory || ''} onChange={e => updateBeatLicense('territory', e.target.value)} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm self-end" />
                    <input placeholder="Usage limits" value={form.beatLicense.usageLimit || ''} onChange={e => updateBeatLicense('usageLimit', e.target.value)} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm self-end" />
                    <input placeholder="Signed license file URL" value={form.beatLicense.documentUrl || ''} onChange={e => updateBeatLicense('documentUrl', e.target.value)} className="sm:col-span-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                    <textarea placeholder="License terms" value={form.beatLicense.terms} onChange={e => updateBeatLicense('terms', e.target.value)} rows={2} className="sm:col-span-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                  </div>
                </div>

                {/* Samples */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-600">Samples ({getSampleTotal()}%)</label>
                    <button onClick={addSample} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"><Plus size={12} /> Add</button>
                  </div>
                  <div className="space-y-2">
                    {form.samples.map((s, i) => (
                      <div key={i} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2 items-center rounded-lg bg-gray-50 p-2">
                        <input placeholder="Sample title" value={s.title} onChange={e => updateSample(i, 'title', e.target.value)} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                        <input placeholder="Original artist" value={s.originalArtist} onChange={e => updateSample(i, 'originalArtist', e.target.value)} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                        <input placeholder="Rights owner" value={s.owner} onChange={e => updateSample(i, 'owner', e.target.value)} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                        <input type="number" min={0} max={100} placeholder="%" value={s.percentage} onChange={e => updateSample(i, 'percentage', +e.target.value)} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                        <select value={s.clearanceStatus} onChange={e => updateSample(i, 'clearanceStatus', e.target.value)} className="px-2 py-2 bg-white border border-gray-300 rounded-lg text-xs">
                          <option value="pending">Pending</option><option value="cleared">Cleared</option><option value="denied">Denied</option><option value="not_applicable">N/A</option>
                        </select>
                        <input placeholder="Clearance file URL" value={s.clearanceDocumentUrl || ''} onChange={e => updateSample(i, 'clearanceDocumentUrl', e.target.value)} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                        <button onClick={() => removeSample(i)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                        <textarea placeholder="Sample notes" value={s.notes} onChange={e => updateSample(i, 'notes', e.target.value)} rows={2} className="sm:col-span-2 lg:col-span-7 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Required signatures */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-600">Required Signatures</label>
                    <button onClick={addSignature} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"><Plus size={12} /> Add</button>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-2">Add each master owner, writer, publisher, producer, featured artist, and sample owner who must sign. Signed entries require a date and document URL.</p>
                  <div className="space-y-2">
                    {form.signatures.map((signature, i) => (
                      <div key={signature._id || i} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 items-center rounded-lg bg-gray-50 p-2">
                        <input placeholder="Party name" value={signature.partyName} onChange={e => updateSignature(i, 'partyName', e.target.value)} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                        <select value={signature.role} onChange={e => updateSignature(i, 'role', e.target.value)} className="px-2 py-2 bg-white border border-gray-300 rounded-lg text-xs">
                          <option value="master_owner">Master owner</option><option value="songwriter">Songwriter</option><option value="publisher">Publisher</option><option value="producer">Producer</option><option value="featured_artist">Featured artist</option><option value="sample_owner">Sample owner</option><option value="other">Other</option>
                        </select>
                        <select value={signature.status} onChange={e => updateSignature(i, 'status', e.target.value)} className="px-2 py-2 bg-white border border-gray-300 rounded-lg text-xs">
                          <option value="pending">Pending</option><option value="signed">Signed</option>
                        </select>
                        <input type="date" value={signature.signedAt?.slice(0, 10) || ''} onChange={e => updateSignature(i, 'signedAt', e.target.value)} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                        <input placeholder="Signed document URL" value={signature.documentUrl} onChange={e => updateSignature(i, 'documentUrl', e.target.value)} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                        <button onClick={() => removeSignature(i)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                      </div>
                    ))}
                    {form.signatures.length === 0 && <p className="text-xs text-amber-600 rounded-lg bg-amber-50 px-3 py-2">No signatures recorded yet.</p>}
                  </div>
                </div>

                {/* Status fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Copyright</label>
                    <select value={form.copyrightStatus} onChange={e => setForm(p => ({ ...p, copyrightStatus: e.target.value as any }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm">
                      <option value="not_registered">Not Registered</option><option value="pending">Pending</option><option value="registered">Registered</option><option value="disputed">Disputed</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Copyright #</label>
                    <input value={form.copyrightNumber} onChange={e => setForm(p => ({ ...p, copyrightNumber: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">PRO Status</label>
                    <select value={form.proStatus} onChange={e => setForm(p => ({ ...p, proStatus: e.target.value as any }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm">
                      <option value="not_registered">Not Registered</option><option value="pending">Pending</option><option value="registered">Registered</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">PRO Name</label>
                    <input value={form.proName} onChange={e => setForm(p => ({ ...p, proName: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">PRO / IPI Number</label>
                    <input value={form.proIpi} onChange={e => setForm(p => ({ ...p, proIpi: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Distribution Status</label>
                    <select value={form.distributionStatus} onChange={e => setForm(p => ({ ...p, distributionStatus: e.target.value as Ownership['distributionStatus'] }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm">
                      <option value="pending_metadata">Pending metadata</option><option value="pending_approval">Pending approval</option><option value="ready">Ready</option><option value="distributed">Distributed</option><option value="on_hold">On hold</option>
                    </select>
                  </div>
                </div>
                <textarea placeholder="Rights and ownership notes" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />

                {o.validationErrors?.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold text-amber-800 mb-1">Outstanding release requirements</p>
                    <ul className="list-disc pl-5 space-y-0.5">
                      {o.validationErrors.map((error, index) => <li key={`${error}-${index}`} className="text-xs text-amber-700">{error}</li>)}
                    </ul>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setDeleteTarget(o.songId?._id)} className="px-3 py-2 bg-white border border-red-200 rounded-lg text-xs text-red-600 hover:bg-red-50">Delete</button>
                    {!o.releaseApproved && (
                      <button onClick={() => handleApprove(o.songId?._id)} disabled={!o.isReadyForRelease} className="px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
                        <Award size={12} /> Approve for Release
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(null)} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={() => handleSave(o.songId?._id)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1">
                      <Save size={12} /> Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {filteredOwnerships.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <Shield size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm">No ownership records found</p>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Add Ownership Record</h3>
            <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Song</label>
            <select value={selectedSong} onChange={e => setSelectedSong(e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm mb-4 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
              <option value="">Select a song...</option>
              {songs.filter(s => !ownerships.some(o => o.songId?._id === s._id)).map(s => (
                <option key={s._id} value={s._id}>{s.title}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowCreate(false); setSelectedSong(''); }} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={addNewOwnership} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">Create & Edit</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Ownership Record"
        message="Are you sure you want to delete this ownership record? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default OwnershipTracker;
