import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BarChart3, Download, Music2, Plus, RefreshCw, Search, Send, Upload, Wifi, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { artistsApi, distributionApi } from '../services/api';
import type { Artist, DistributionRelease } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSocket, type LabelGridReleaseUpdate } from '../contexts/SocketContext';
import { formatCurrency } from '../utils/helpers';

const statusColors: Record<string, string> = {
  draft: '#64748B', submitted: '#8B5CF6', processing: '#0EA5E9', approved: '#16A34A',
  delivered: '#14B8A6', live: '#10B981', rejected: '#DC2626', error: '#DC2626',
  takedown_requested: '#F59E0B', removed: '#64748B',
};
const input = 'w-full rounded-xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] px-3 py-2.5 text-sm text-[var(--hbe-text)] outline-none focus:border-violet-500';
type TrackDraft = { title: string; isrc: string; explicit: boolean; language: string; audio?: File; audioUrl?: string; audioFileName?: string };
const emptyTrack = (): TrackDraft => ({ title: '', isrc: '', explicit: false, language: 'English' });

const Distribution: React.FC = () => {
  const { user, canAccess } = useAuth();
  const { connected, joinRelease, leaveRelease, syncProgress } = useSocket();
  const [tab, setTab] = useState<'catalog' | 'new' | 'royalties' | 'qc'>('catalog');
  const [releases, setReleases] = useState<DistributionRelease[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [connection, setConnection] = useState<any>(null);
  const [royalties, setRoyalties] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState('');
  const [references, setReferences] = useState<any>(null);
  const [editing, setEditing] = useState<DistributionRelease | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [form, setForm] = useState({ title: '', artist: '', type: 'single', genre: '', language: 'English', releaseDate: '', explicit: false, upc: '', copyright: '', territories: 'WORLDWIDE', featuringArtists: '', producer: '', songwriters: '', composers: '', catalogNumber: '', publishingCopyright: '', artworkAiUsage: 'none', dspOutletIds: 'all_dsps' });
  const [cover, setCover] = useState<File>();
  const [tracks, setTracks] = useState<TrackDraft[]>([emptyTrack()]);
  const joinedReleases = useRef<Set<string>>(new Set());

  const load = async () => {
    try {
      const [releaseRes, connectionRes, royaltyRes] = await Promise.all([
        distributionApi.getAll(), distributionApi.getConnection(), distributionApi.getRoyaltySummary(),
      ]);
      setReleases(releaseRes.data.data); setConnection(connectionRes.data.data); setRoyalties(royaltyRes.data.data);
      if (connectionRes.data.data?.configured) setReferences((await distributionApi.getReferenceData()).data.data);
      if (user?.role !== 'artist') setArtists((await artistsApi.getAll()).data.data);
    } catch (error: any) { toast.error(error.response?.data?.message || 'Failed to load distribution'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // ── Join per-release Socket.IO rooms for live updates ──────────────────────
  useEffect(() => {
    if (!connected || releases.length === 0) return;
    releases.forEach(r => {
      if (!joinedReleases.current.has(r._id)) {
        joinRelease(r._id);
        joinedReleases.current.add(r._id);
      }
    });
  }, [connected, releases, joinRelease]);

  // ── Handle real-time release updates via global DOM event ──────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const update = (e as CustomEvent<LabelGridReleaseUpdate>).detail;
      setReleases(prev =>
        prev.map(r =>
          r._id === update.releaseId
            ? { ...r, status: update.status as any, qcStatus: update.qcStatus as any, storeStatuses: (update.storeStatuses ?? r.storeStatuses) as any, labelgridRawStatus: update.labelgridRawStatus, lastSyncedAt: update.lastSyncedAt }
            : r
        )
      );
      // Also refresh connection status in case it changed.
      distributionApi.getConnection().then(res => setConnection(res.data.data)).catch(() => {});
    };
    window.addEventListener('hbe:labelgrid_release_updated', handler);
    return () => {
      window.removeEventListener('hbe:labelgrid_release_updated', handler);
      // Leave all release rooms on unmount.
      joinedReleases.current.forEach(id => leaveRelease(id));
      joinedReleases.current.clear();
    };
  }, [leaveRelease]);

  const filtered = useMemo(() => releases.filter(release => {
    const q = query.toLowerCase();
    return (!status || release.status === status) && (!q || [release.title, release.artist?.stageName, release.artist?.name, release.upc, release.providerReleaseId].some(v => v?.toLowerCase().includes(q)));
  }), [releases, query, status]);

  const reset = () => { setEditing(null); setForm({ title: '', artist: '', type: 'single', genre: '', language: 'English', releaseDate: '', explicit: false, upc: '', copyright: '', territories: 'WORLDWIDE', featuringArtists: '', producer: '', songwriters: '', composers: '', catalogNumber: '', publishingCopyright: '', artworkAiUsage: 'none', dspOutletIds: 'all_dsps' }); setCover(undefined); setTracks([emptyTrack()]); };
  const editDraft = (release: DistributionRelease) => {
    setEditing(release);
    setForm({ title: release.title, artist: release.artist?._id || '', type: release.type, genre: release.genre, language: release.language, releaseDate: release.releaseDate.slice(0, 10), explicit: release.explicit, upc: release.upc || '', copyright: release.copyright, territories: release.territories.join(','), featuringArtists: '', producer: '', songwriters: '', composers: '', catalogNumber: (release as any).catalogNumber || '', publishingCopyright: (release as any).publishingCopyright || '', artworkAiUsage: (release as any).artworkAiUsage || 'none', dspOutletIds: (release as any).dspOutletIds?.join(',') || 'all_dsps' });
    setCover(undefined);
    setTracks(release.tracks.map(t => ({ title: t.title, isrc: t.isrc || '', explicit: t.explicit, language: t.language, audioUrl: t.audioUrl, audioFileName: t.audioFileName })));
    setTab('new');
  };
  const createRelease = async () => {
    if (!form.title || (!form.artist && user?.role !== 'artist') || !form.genre || !form.releaseDate || !form.copyright || (!cover && !editing?.coverArtUrl) || tracks.some(t => !t.title || (!t.audio && !t.audioUrl))) return toast.error('Complete the release fields, cover, and every track audio file');
    setSaving(true);
    try {
      const data = new FormData(); Object.entries(form).forEach(([k, v]) => data.append(k, String(v))); if (cover) data.append('cover', cover);
      data.append('tracks', JSON.stringify(tracks.map(t => ({ title: t.title, isrc: t.isrc, explicit: t.explicit, language: t.language, genre: form.genre, copyright: form.copyright, audioUrl: t.audioUrl, audioFileName: t.audioFileName, contributors: [
        { name: artists.find(a => a._id === form.artist)?.stageName || artists.find(a => a._id === form.artist)?.name || user?.name || 'Artist', role: 'primary_artist' },
        ...form.featuringArtists.split(',').map(n => n.trim()).filter(Boolean).map(n => ({ name: n, role: 'featured_artist' })),
        ...form.producer.split(',').map(n => n.trim()).filter(Boolean).map(n => ({ name: n, role: 'producer' })),
        ...form.songwriters.split(',').map(n => n.trim()).filter(Boolean).map(n => ({ name: n, role: 'songwriter' })),
        ...form.composers.split(',').map(n => n.trim()).filter(Boolean).map(n => ({ name: n, role: 'composer' })),
      ] }))));
      tracks.forEach((t, i) => t.audio && data.append(`audio_${i}`, t.audio));
      if (editing) await distributionApi.update(editing._id, data); else await distributionApi.create(data);
      toast.success(editing ? 'Distribution draft updated' : 'Distribution draft created'); reset(); setTab('catalog'); await load();
    } catch (error: any) { toast.error(error.response?.data?.message || 'Could not create release'); }
    finally { setSaving(false); }
  };
  const submit = async (id: string) => {
    setActionBusy(id);
    try {
      const res = await distributionApi.submit(id);
      // Optimistic update — real update arrives via Socket.IO shortly after.
      setReleases(items => items.map(item => item._id === id ? { ...item, ...res.data.data } : item));
      toast.success('Release submitted to LabelGrid. Tracking updates in real time…');
    }
    catch (error: any) { toast.error(error.response?.data?.errors?.join(', ') || error.response?.data?.message || 'Submission failed'); }
    finally { setActionBusy(''); }
  };
  const syncRelease = async (id: string) => {
    setActionBusy(`sync_${id}`);
    try { await distributionApi.sync(id); toast.success('Status refresh requested'); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Sync failed'); }
    finally { setActionBusy(''); }
  };
  const download = async () => { const res = await distributionApi.exportRoyalties(); const url = URL.createObjectURL(res.data); const a = document.createElement('a'); a.href = url; a.download = 'royalty-report.csv'; a.click(); URL.revokeObjectURL(url); };

  if (loading) return <div className="flex min-h-64 items-center justify-center"><RefreshCw className="animate-spin text-violet-500" /></div>;
  return <div className="space-y-6 pb-12">
    {/* Header */}
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-2xl font-bold text-[var(--hbe-text)] flex items-center gap-2"><Music2 className="text-violet-500" /> Distribution</h1><p className="mt-1 text-sm text-[var(--hbe-muted)]">Catalog delivery and royalty reporting through LabelGrid</p></div>
      <div className="flex items-center gap-3">
        {/* Real-time connection indicator */}
        <div className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${connected ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-zinc-700 text-zinc-500'}`}>
          {connected ? <Wifi size={12} /> : <WifiOff size={12} />}{connected ? 'Live' : 'Offline'}
        </div>
        <div className={`rounded-xl border px-3 py-2 text-xs font-semibold ${connection?.status === 'connected' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : 'border-amber-500/30 bg-amber-500/10 text-amber-500'}`}>{connection?.status === 'connected' ? 'LabelGrid connected' : connection?.message || 'LabelGrid unavailable'}</div>
      </div>
    </div>

    {/* Bulk sync progress bar */}
    {syncProgress && syncProgress.type?.includes('release') && (
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
        <div className="flex items-center justify-between mb-2 text-xs font-semibold text-violet-400">
          <span>{syncProgress.phase === 'completed' ? '✓ Sync complete' : `Syncing releases… ${syncProgress.current ?? 0}/${syncProgress.total ?? '?'}`}</span>
          {syncProgress.successCount !== undefined && <span>{syncProgress.successCount} succeeded</span>}
        </div>
        {syncProgress.total && <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden"><div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${Math.min(100, ((syncProgress.current ?? 0) / syncProgress.total) * 100)}%` }} /></div>}
      </div>
    )}

    <div className="flex flex-wrap gap-1 rounded-xl bg-[var(--hbe-fill-soft)] p-1 w-fit">
      {([...(['catalog', 'royalties', 'new'] as const), ...(user?.role === 'admin' ? ['qc' as const] : [])]).map(key => <button key={key} onClick={() => setTab(key)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === key ? 'bg-[var(--hbe-surface)] text-[var(--hbe-text)] shadow-sm' : 'text-[var(--hbe-muted)]'}`}>{key === 'catalog' ? 'Catalog' : key === 'royalties' ? 'Revenue & Royalties' : key === 'qc' ? 'Admin QC' : 'New Release'}</button>)}
    </div>

    {tab === 'catalog' && <>
      <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search size={15} className="absolute left-3 top-3 text-[var(--hbe-muted)]"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search title, artist, UPC or provider ID" className={`${input} pl-9`} /></div><select value={status} onChange={e => setStatus(e.target.value)} className={`${input} sm:w-48`}><option value="">All statuses</option>{Object.keys(statusColors).map(s => <option key={s}>{s}</option>)}</select>{canAccess('distribution', 'write') && <button onClick={() => setTab('new')} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white flex items-center gap-2"><Plus size={16}/> New Release</button>}</div>
      <div className="overflow-hidden rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)]"><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left"><thead className="bg-[var(--hbe-fill-soft)] text-xs uppercase text-[var(--hbe-muted)]"><tr><th className="p-4">Release</th><th>Artist</th><th>Status</th><th>QC Status</th><th>Date</th><th className="pr-4 text-right">Action</th></tr></thead><tbody className="divide-y divide-[var(--hbe-divide)]">{filtered.map(release => <tr key={release._id}>
        <td className="p-4"><div className="flex items-center gap-3">{release.coverArtUrl ? <img src={release.coverArtUrl} loading="lazy" className="h-11 w-11 rounded-lg object-cover"/> : <div className="h-11 w-11 rounded-lg bg-violet-500/10 grid place-items-center"><Music2 size={17}/></div>}<div><p className="font-semibold text-[var(--hbe-text)]">{release.title}</p><p className="text-xs text-[var(--hbe-muted)]">{release.tracks.length} track{release.tracks.length === 1 ? '' : 's'} · {release.type}</p></div></div></td>
        <td className="text-sm text-[var(--hbe-text-soft)]">{release.artist?.stageName || release.artist?.name}</td>
        <td><span className="rounded-full px-2.5 py-1 text-xs font-bold capitalize" style={{ color: statusColors[release.status], background: `${statusColors[release.status]}18` }}>{release.status.replaceAll('_', ' ')}</span></td>
        <td className="text-xs">
          <span className={`font-bold capitalize ${release.qcStatus === 'ready_for_labelgrid' ? 'text-emerald-500' : release.qcStatus === 'qc_failed' ? 'text-red-500' : release.qcStatus === 'action_required' ? 'text-amber-500' : 'text-[var(--hbe-muted)]'}`}>
            {(release.qcStatus || 'pending_qc').replace(/_/g, ' ')}
          </span>
        </td>
        <td className="text-sm text-[var(--hbe-text-soft)]">{new Date(release.releaseDate).toLocaleDateString()}</td>
        <td className="pr-4 text-right"><div className="flex justify-end gap-2">
          {release.status === 'draft' && canAccess('distribution', 'write') && <button disabled={actionBusy === release._id || connection?.status !== 'connected' || release.qcStatus !== 'ready_for_labelgrid'} onClick={() => submit(release._id)} className={`rounded-lg px-3 py-2 text-xs font-bold text-white flex items-center gap-1 disabled:opacity-50 ${release.qcStatus === 'ready_for_labelgrid' ? 'bg-violet-600' : 'bg-zinc-600 cursor-not-allowed'}`} title={release.qcStatus !== 'ready_for_labelgrid' ? 'Cannot submit until Content/QC passes.' : ''}><Send size={13}/>{actionBusy === release._id ? 'Submitting…' : 'Submit'}</button>}
          {(release as any).labelgridReleaseId && <button disabled={actionBusy === `sync_${release._id}`} onClick={() => syncRelease(release._id)} className="rounded-lg border border-[var(--hbe-line)] px-3 py-2 text-xs font-semibold text-[var(--hbe-muted)] flex items-center gap-1 disabled:opacity-50"><RefreshCw size={12} className={actionBusy === `sync_${release._id}` ? 'animate-spin' : ''}/> Sync</button>}
          <Link to={`/distribution/${release._id}`} className="rounded-lg border border-[var(--hbe-line)] px-3 py-2 text-xs font-semibold text-[var(--hbe-text)]">Details</Link>
        </div></td>
      </tr>)}</tbody></table></div>{filtered.length === 0 && <p className="p-10 text-center text-sm text-[var(--hbe-muted)]">No distribution releases found.</p>}</div>
      <div className="rounded-2xl border border-dashed border-[var(--hbe-line)] p-5 text-sm text-[var(--hbe-muted)]"><strong className="text-[var(--hbe-text)]">LabelGrid workflow:</strong> Drafts stay local until submission. Status updates arrive in real time via Socket.IO webhooks — no refresh needed.</div>
    </>}

    {tab === 'new' && <div className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5 sm:p-7 space-y-6"><div><h2 className="text-lg font-bold text-[var(--hbe-text)]">Create distribution draft</h2><p className="text-xs text-[var(--hbe-muted)]">Saved internally until you explicitly submit it to LabelGrid.</p></div><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <label className="text-xs font-semibold text-[var(--hbe-muted)]">Release title<input className={`${input} mt-1`} value={form.title} onChange={e => setForm({...form,title:e.target.value})}/></label>
      {user?.role !== 'artist' && <label className="text-xs font-semibold text-[var(--hbe-muted)]">Artist<select className={`${input} mt-1`} value={form.artist} onChange={e=>setForm({...form,artist:e.target.value})}><option value="">Select artist</option>{artists.map(a=><option key={a._id} value={a._id}>{a.stageName||a.name}</option>)}</select></label>}
      <label className="text-xs font-semibold text-[var(--hbe-muted)]">Release type<select className={`${input} mt-1`} value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option>single</option><option>ep</option><option>album</option></select></label>
      <label className="text-xs font-semibold text-[var(--hbe-muted)]">Genre{references?.genres ? <select className={`${input} mt-1`} value={form.genre} onChange={e=>setForm({...form,genre:e.target.value})}><option value="">Select LabelGrid genre</option>{references.genres.map((g:any)=><option key={g.id} value={g.name}>{g.name}</option>)}</select> : <input className={`${input} mt-1`} value={form.genre} onChange={e=>setForm({...form,genre:e.target.value})}/>}</label><label className="text-xs font-semibold text-[var(--hbe-muted)]">Language<input className={`${input} mt-1`} value={form.language} onChange={e=>setForm({...form,language:e.target.value})}/></label><label className="text-xs font-semibold text-[var(--hbe-muted)]">Release date<input type="date" className={`${input} mt-1`} value={form.releaseDate} onChange={e=>setForm({...form,releaseDate:e.target.value})}/></label>
      <label className="text-xs font-semibold text-[var(--hbe-muted)]">Catalog number<input className={`${input} mt-1`} value={form.catalogNumber} onChange={e=>setForm({...form,catalogNumber:e.target.value})} placeholder="Auto-generated if blank"/></label><label className="text-xs font-semibold text-[var(--hbe-muted)]">Publishing copyright<input className={`${input} mt-1`} value={form.publishingCopyright} onChange={e=>setForm({...form,publishingCopyright:e.target.value})} placeholder="℗ owner"/></label><label className="text-xs font-semibold text-[var(--hbe-muted)]">Artwork AI usage<select className={`${input} mt-1`} value={form.artworkAiUsage} onChange={e=>setForm({...form,artworkAiUsage:e.target.value})}><option value="none">None</option><option value="some">Some</option><option value="material">Material</option><option value="all">All</option></select></label>
      <label className="text-xs font-semibold text-[var(--hbe-muted)]">UPC / EAN (optional)<input className={`${input} mt-1`} value={form.upc} onChange={e=>setForm({...form,upc:e.target.value})}/></label><label className="text-xs font-semibold text-[var(--hbe-muted)]">Territories<input className={`${input} mt-1`} value={form.territories} onChange={e=>setForm({...form,territories:e.target.value})}/></label><label className="text-xs font-semibold text-[var(--hbe-muted)]">Copyright<input className={`${input} mt-1`} placeholder="© 2026 Label Name" value={form.copyright} onChange={e=>setForm({...form,copyright:e.target.value})}/></label>
      <label className="text-xs font-semibold text-[var(--hbe-muted)]">Featuring artists<input className={`${input} mt-1`} placeholder="Comma separated" value={form.featuringArtists} onChange={e=>setForm({...form,featuringArtists:e.target.value})}/></label><label className="text-xs font-semibold text-[var(--hbe-muted)]">Producer(s)<input className={`${input} mt-1`} value={form.producer} onChange={e=>setForm({...form,producer:e.target.value})}/></label><label className="text-xs font-semibold text-[var(--hbe-muted)]">Songwriters / composers<input className={`${input} mt-1`} value={form.songwriters} onChange={e=>setForm({...form,songwriters:e.target.value})}/></label>
      <label className="text-xs font-semibold text-[var(--hbe-muted)]">Cover artwork<input type="file" accept="image/jpeg,image/png,image/webp" className={`${input} mt-1`} onChange={e=>setCover(e.target.files?.[0])}/></label><label className="flex items-center gap-2 pt-7 text-sm text-[var(--hbe-text)]"><input type="checkbox" checked={form.explicit} onChange={e=>setForm({...form,explicit:e.target.checked})}/> Explicit content</label></div>
      <div className="space-y-3"><div className="flex justify-between"><h3 className="font-bold text-[var(--hbe-text)]">Tracks</h3><button onClick={()=>setTracks([...tracks,emptyTrack()])} className="text-sm font-semibold text-violet-500">+ Add track</button></div>{tracks.map((t,i)=><div key={i} className="grid gap-3 rounded-xl border border-[var(--hbe-line)] p-4 md:grid-cols-[1fr_1fr_1.4fr_auto]"><input className={input} placeholder="Track title" value={t.title} onChange={e=>setTracks(items=>items.map((item,j)=>j===i?{...item,title:e.target.value}:item))}/><input className={input} placeholder="ISRC (optional)" value={t.isrc} onChange={e=>setTracks(items=>items.map((item,j)=>j===i?{...item,isrc:e.target.value}:item))}/><input type="file" accept="audio/*,.wav,.flac,.aif,.aiff" className={input} onChange={e=>setTracks(items=>items.map((item,j)=>j===i?{...item,audio:e.target.files?.[0]}:item))}/><button disabled={tracks.length===1} onClick={()=>setTracks(items=>items.filter((_,j)=>j!==i))} className="px-2 text-red-500 disabled:opacity-30">×</button></div>)}</div>
      <div className="flex justify-end"><button disabled={saving} onClick={createRelease} className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50 flex items-center gap-2"><Upload size={16}/>{saving?'Uploading…':'Save Draft'}</button></div></div>}

    {tab === 'royalties' && <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5"><p className="text-xs text-[var(--hbe-muted)]">Total Revenue</p><p className="mt-2 text-2xl font-bold text-[var(--hbe-text)]">{formatCurrency(royalties?.totalRevenue||0)}</p></div><div className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5"><p className="text-xs text-[var(--hbe-muted)]">Artist Earnings</p><p className="mt-2 text-2xl font-bold text-emerald-500">{formatCurrency(royalties?.artistEarnings||0)}</p></div><div className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5"><p className="text-xs text-[var(--hbe-muted)]">Statements</p><p className="mt-2 text-2xl font-bold text-[var(--hbe-text)]">{royalties?.entries?.length||0}</p></div></div><div className="flex justify-between"><div><h2 className="font-bold text-[var(--hbe-text)]">Royalty history</h2><p className="text-xs text-[var(--hbe-muted)]">Internal royalty ledger. LabelGrid royalty data is available through the secured backend endpoint when connected.</p></div><button onClick={download} className="rounded-xl border border-[var(--hbe-line)] px-4 py-2 text-sm font-semibold text-[var(--hbe-text)] flex items-center gap-2"><Download size={15}/> CSV</button></div><div className="grid gap-4 lg:grid-cols-3">{[['Platform / source',royalties?.byPlatform],['Release',royalties?.byRelease],['Track',royalties?.byTrack]].map(([label,data]:any)=><div key={label} className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5"><h3 className="mb-4 text-sm font-bold text-[var(--hbe-text)] flex items-center gap-2"><BarChart3 size={15}/>{label}</h3><div className="space-y-3">{Object.entries(data||{}).map(([name,value]:any)=><div key={name} className="flex justify-between text-sm"><span className="capitalize text-[var(--hbe-muted)]">{name.replace(/_/g,' ')}</span><strong className="text-[var(--hbe-text)]">{formatCurrency(value)}</strong></div>)}{Object.keys(data||{}).length===0&&<p className="text-xs text-[var(--hbe-muted)]">No reporting data yet</p>}</div></div>)}</div></div>}
    
    {tab === 'qc' && user?.role === 'admin' && (
      <div className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5 space-y-4">
        <div><h2 className="text-lg font-bold text-[var(--hbe-text)]">Content & QC Review Dashboard</h2><p className="text-xs text-[var(--hbe-muted)]">Manage releases needing manual review for rights, samples, and high-risk content.</p></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--hbe-divide)] text-xs text-[var(--hbe-muted)]">
            <tr><th className="pb-3">Release</th><th className="pb-3">Rights</th><th className="pb-3">QC Status</th><th className="pb-3">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-[var(--hbe-divide)]">
            {releases.filter(r => ['action_required', 'manual_review', 'pending_qc'].includes(r.qcStatus || 'pending_qc')).map(r => (
              <tr key={r._id}>
                <td className="py-3 font-semibold text-[var(--hbe-text)]"><Link to={`/distribution/${r._id}`} className="hover:underline">{r.title}</Link></td>
                <td className="py-3 capitalize text-[var(--hbe-muted)]">{(r.rightsStatus || 'not_reviewed').replace('_', ' ')}</td>
                <td className="py-3 capitalize font-bold text-amber-500">{(r.qcStatus || 'pending_qc').replace('_', ' ')}</td>
                <td className="py-3">
                  <div className="flex gap-2">
                    <button onClick={async () => { await fetch(`/api/distribution/${r._id}/qc`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ qcStatus: 'ready_for_labelgrid', rightsStatus: 'approved' }) }); load(); toast.success('Approved') }} className="rounded bg-emerald-500/20 text-emerald-500 px-3 py-1 text-xs font-bold hover:bg-emerald-500/30">Approve</button>
                    <button onClick={async () => { await fetch(`/api/distribution/${r._id}/qc`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ qcStatus: 'qc_failed', rightsStatus: 'rejected' }) }); load(); toast.error('Rejected') }} className="rounded bg-red-500/20 text-red-500 px-3 py-1 text-xs font-bold hover:bg-red-500/30">Reject</button>
                  </div>
                </td>
              </tr>
            ))}
            {releases.filter(r => ['action_required', 'manual_review', 'pending_qc'].includes(r.qcStatus || 'pending_qc')).length === 0 && (
              <tr><td colSpan={4} className="py-8 text-center text-[var(--hbe-muted)]">No releases pending review.</td></tr>
            )}
          </tbody>
        </table></div>
      </div>
    )}
  </div>;
};

export default Distribution;
