import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Music2, RefreshCw, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { distributionApi } from '../services/api';
import type { DistributionRelease } from '../types';
import { useAuth } from '../contexts/AuthContext';

const stages = ['draft', 'submitted', 'processing', 'approved', 'delivered', 'live'];
const DistributionDetail: React.FC = () => {
  const { id = '' } = useParams(); const { canAccess } = useAuth();
  const [release, setRelease] = useState<DistributionRelease | null>(null); const [connection, setConnection] = useState<any>(); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const load = async () => { try { const [r,c]=await Promise.all([distributionApi.getById(id),distributionApi.getConnection()]); setRelease(r.data.data);setConnection(c.data.data); } catch(e:any){toast.error(e.response?.data?.message||'Failed to load release');} finally{setLoading(false);} };
  useEffect(()=>{load();},[id]);
  const action=async(type:'submit'|'sync')=>{setBusy(true);try{const r=type==='submit'?await distributionApi.submit(id):await distributionApi.sync(id);setRelease(r.data.data);toast.success(type==='submit'?'Release submitted successfully to LabelGrid.':'LabelGrid status synchronized');}catch(e:any){toast.error(e.response?.data?.errors?.map((x:any)=>x.message||x).join(', ')||e.response?.data?.message||'Action failed');await load();}finally{setBusy(false);}};
  if(loading)return <div className="grid min-h-64 place-items-center"><RefreshCw className="animate-spin text-violet-500"/></div>;
  if(!release)return <p className="text-[var(--hbe-muted)]">Release not found.</p>;
  const active=stages.indexOf(release.status);
  return <div className="space-y-6 pb-12"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><Link to="/distribution" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-500"><ArrowLeft size={14}/> Distribution catalog</Link><h1 className="text-2xl font-bold text-[var(--hbe-text)]">{release.title}</h1><p className="text-sm text-[var(--hbe-muted)]">{release.artist?.stageName||release.artist?.name} · {release.type}</p></div>{canAccess('distribution','write')&&<div className="flex gap-2">{release.status==='draft'&&<button disabled={busy || release.qcStatus !== 'ready_for_labelgrid'} onClick={()=>action('submit')} className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white flex items-center gap-2 ${release.qcStatus === 'ready_for_labelgrid' ? 'bg-violet-600' : 'bg-zinc-600 cursor-not-allowed opacity-50'}`} title={release.qcStatus !== 'ready_for_labelgrid' ? 'Cannot submit until Content/QC passes.' : ''}><Send size={15}/> Submit</button>}{!['draft','live','rejected'].includes(release.status)&&<button disabled={busy} onClick={()=>action('sync')} className="rounded-xl border border-[var(--hbe-line)] px-4 py-2.5 text-sm font-bold text-[var(--hbe-text)] flex items-center gap-2"><RefreshCw size={15} className={busy?'animate-spin':''}/> Sync status</button>}</div>}</div>
    {connection?.status!=='connected'&&<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-500"><strong>LabelGrid unavailable:</strong> {connection?.message||'configure the server-side integration before submitting.'}</div>}
    <div className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5 overflow-x-auto"><div className="flex min-w-[680px] items-center">{stages.map((stage,index)=><React.Fragment key={stage}><div className="flex flex-col items-center gap-2"><div className={`grid h-9 w-9 place-items-center rounded-full border-2 ${index<=active?'border-violet-500 bg-violet-500 text-white':'border-[var(--hbe-line)] text-[var(--hbe-muted)]'}`}>{index<active?<CheckCircle2 size={17}/>:index+1}</div><span className="text-[10px] font-bold uppercase text-[var(--hbe-muted)]">{stage}</span></div>{index<stages.length-1&&<div className={`mb-5 h-0.5 flex-1 ${index<active?'bg-violet-500':'bg-[var(--hbe-line)]'}`}/>}</React.Fragment>)}</div></div>
    {(release.status==='rejected'||release.status==='error'||release.syncErrors?.length)&&<div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5"><h2 className="flex items-center gap-2 font-bold text-red-500"><AlertTriangle size={17}/> Distribution issue</h2><p className="mt-2 text-sm text-[var(--hbe-text-soft)]">{release.rejectionReason||release.syncErrors?.at(-1)?.message||'The provider reported an error.'}</p></div>}
    <div className="grid gap-5 lg:grid-cols-[1fr_1.6fr]"><div className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5">{release.coverArtUrl?<img src={release.coverArtUrl} className="aspect-square w-full rounded-xl object-cover"/>:<div className="aspect-square rounded-xl bg-violet-500/10 grid place-items-center"><Music2 size={42} className="text-violet-500"/></div>}<dl className="mt-5 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-xs text-[var(--hbe-muted)]">Release date</dt><dd className="font-semibold text-[var(--hbe-text)]">{new Date(release.releaseDate).toLocaleDateString()}</dd></div><div><dt className="text-xs text-[var(--hbe-muted)]">UPC / EAN</dt><dd className="font-semibold text-[var(--hbe-text)]">{release.upc||'Pending'}</dd></div><div><dt className="text-xs text-[var(--hbe-muted)]">Territories</dt><dd className="font-semibold text-[var(--hbe-text)]">{release.territories.join(', ')}</dd></div><div><dt className="text-xs text-[var(--hbe-muted)]">Provider ID</dt><dd className="break-all font-semibold text-[var(--hbe-text)]">{release.providerReleaseId||'Not submitted'}</dd></div></dl></div><div className="space-y-4">
      
      {/* Content & QC Review Section */}
      <div className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5">
        <h2 className="mb-4 font-bold text-[var(--hbe-text)]">Content & Quality Review</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--hbe-muted)]">Overall QC Status:</span>
            <span className={`font-bold capitalize ${release.qcStatus === 'ready_for_labelgrid' ? 'text-emerald-500' : release.qcStatus === 'qc_failed' ? 'text-red-500' : release.qcStatus === 'action_required' ? 'text-amber-500' : 'text-blue-500'}`}>
              {(release.qcStatus || 'pending_qc').replace(/_/g, ' ')}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--hbe-muted)]">Rights Verification:</span>
            <span className={`font-bold capitalize ${release.rightsStatus === 'approved' ? 'text-emerald-500' : release.rightsStatus === 'rejected' ? 'text-red-500' : 'text-amber-500'}`}>
              {(release.rightsStatus || 'not_reviewed').replace(/_/g, ' ')}
            </span>
          </div>
          <div className="mt-4 border-t border-[var(--hbe-divide)] pt-3 text-xs text-[var(--hbe-muted)]">
            HoodBoy Entertainment performs internal catalog fingerprint matching and pre-delivery QC before distribution. LabelGrid submission is blocked until these checks pass.
          </div>
        </div>
      </div>
      
      <div className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5"><h2 className="mb-4 font-bold text-[var(--hbe-text)]">Tracks</h2><div className="space-y-3">{release.tracks.map((track,index)=><div key={track._id||index} className="rounded-xl border border-[var(--hbe-line)] p-4"><div className="flex justify-between"><div><p className="font-semibold text-[var(--hbe-text)]">{index+1}. {track.title}</p><p className="text-xs text-[var(--hbe-muted)]">{track.audioFileName||'Audio attached'} · ISRC: {track.isrc||'Pending'}</p></div>{track.explicit&&<span className="text-xs font-bold text-amber-500">Explicit</span>}</div><p className="mt-2 text-xs text-[var(--hbe-muted)]">{track.contributors.map(item=>`${item.name} (${item.role.replace('_',' ')})`).join(' · ')}</p>
      
      {/* Track QC Results */}
      {track.audioQcResult && (
        <div className="mt-3 bg-[var(--hbe-fill-soft)] rounded p-2 text-xs flex flex-wrap gap-x-4 gap-y-1">
          <div><strong className="text-[var(--hbe-text-soft)]">Audio QC:</strong> <span className={track.audioQcResult.status === 'PASS' ? 'text-emerald-500' : track.audioQcResult.status === 'WARNING' ? 'text-amber-500' : 'text-red-500'}>{track.audioQcResult.status}</span></div>
          <div><strong className="text-[var(--hbe-text-soft)]">Duplicate Check:</strong> <span className={track.duplicateQcResult?.status === 'PASS' ? 'text-emerald-500' : 'text-amber-500'}>{track.duplicateQcResult?.status || 'PASS'}</span></div>
          {track.audioQcResult.messages && track.audioQcResult.messages.length > 0 && <div className="w-full mt-1 text-red-400">{track.audioQcResult.messages.join(' ')}</div>}
          {track.duplicateQcResult?.messages && track.duplicateQcResult.messages.length > 0 && <div className="w-full mt-1 text-amber-400">{track.duplicateQcResult.messages.join(' ')}</div>}
        </div>
      )}
      </div>)}</div></div>{release.storeStatuses&&release.storeStatuses.length>0&&<div className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5"><h2 className="mb-3 font-bold text-[var(--hbe-text)]">Stores</h2>{release.storeStatuses.map(item=><div key={item.store} className="flex justify-between border-b border-[var(--hbe-divide)] py-2 text-sm"><span className="text-[var(--hbe-text)]">{item.store}</span><span className="font-bold capitalize text-emerald-500">{item.status}</span></div>)}</div>}</div></div>
  </div>;
};
export default DistributionDetail;
