import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, Edit3, Music2, RefreshCw, Send, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { distributionApi } from '../services/api';
import type { DistributionRelease } from '../types';
import { useAuth } from '../contexts/AuthContext';

const stages = ['draft', 'submitted', 'processing', 'approved', 'delivered', 'live'];

const DistributionDetail: React.FC = () => {
  const { id = '' } = useParams();
  const { canAccess } = useAuth();
  const [release, setRelease] = useState<DistributionRelease | null>(null);
  const [connection, setConnection] = useState<any>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [r, c] = await Promise.all([distributionApi.getById(id), distributionApi.getConnection()]);
      setRelease(r.data.data);
      setConnection(c.data.data);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load release');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [id]);

  const action = async (type: 'submit' | 'distribute' | 'sync' | 'validate') => {
    setBusy(true);
    try {
      if (type === 'validate') {
        const res = await distributionApi.validate(id);
        const report = res.data.data;
        setRelease(prev => prev ? { ...prev, validationResult: report } : prev);
        if (report.ready) toast.success('Release passes all DistriBeats validation checks.');
        else toast.error(`Found ${report.errors?.length || 1} validation issue(s).`);
        return;
      }
      const r = type === 'submit' ? await distributionApi.submit(id) : type === 'distribute' ? await distributionApi.distribute(id) : await distributionApi.sync(id);
      setRelease(r.data.data);
      toast.success(type === 'submit' ? `Release submitted to DistriBeats${connection?.testMode ? ' (TEST MODE)' : ''}.` : 'DistriBeats status synchronized.');
    } catch (e: any) {
      toast.error(e.response?.data?.errors?.map((x: any) => x.message || x).join(', ') || e.response?.data?.message || 'Action failed');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const downloadDdex = async (version: '3.8.2' | '4.2' = '4.2') => {
    setBusy(true);
    try {
      const res = await distributionApi.getDdex(id, { format: 'xml', version });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ern-${release?.distribeatsReleaseId || release?._id}-${version}.xml`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`DDEX ERN ${version} downloaded`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'DDEX feed is not ready yet');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="grid min-h-64 place-items-center"><RefreshCw className="animate-spin text-violet-500" /></div>;
  if (!release) return <p className="text-[var(--hbe-muted)]">Release not found.</p>;
  const active = stages.indexOf(release.status);
  const isTestMode = connection?.testMode !== false;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to="/distribution" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-500"><ArrowLeft size={14} /> Distribution catalog</Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-[var(--hbe-text)]">{release.title}</h1>
            {isTestMode && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-500"><ShieldAlert size={12} /> TEST MODE</span>
            )}
          </div>
          <p className="text-sm text-[var(--hbe-muted)]">{release.artist?.stageName || release.artist?.name} · {release.type.toUpperCase()} · {release.genre}{release.subGenre ? ` / ${release.subGenre}` : ''}</p>
        </div>
        {canAccess('distribution', 'write') && (
          <div className="flex flex-wrap gap-2">
            {release.status === 'draft' && (
              <>
                <Link to={`/distribution?edit=${release._id}`} className="rounded-xl border border-[var(--hbe-line)] px-4 py-2.5 text-sm font-bold text-[var(--hbe-text)] flex items-center gap-2"><Edit3 size={15} /> Edit Draft</Link>
                <button disabled={busy} onClick={() => action('validate')} className="rounded-xl border border-[var(--hbe-line)] px-4 py-2.5 text-sm font-bold text-[var(--hbe-text)] flex items-center gap-2"><CheckCircle2 size={15} /> Validate</button>
                <button disabled={busy || release.qcStatus !== 'ready_for_distribution'} onClick={() => action('submit')} className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white flex items-center gap-2 ${release.qcStatus === 'ready_for_distribution' ? 'bg-violet-600' : 'bg-zinc-600 cursor-not-allowed opacity-50'}`} title={release.qcStatus !== 'ready_for_distribution' ? 'Cannot submit until Content/QC passes.' : ''}><Send size={15} /> {isTestMode ? 'Submit (TEST)' : 'Submit'}</button>
              </>
            )}
            {!['draft', 'live', 'rejected'].includes(release.status) && release.distribeatsReleaseId && (
              <button disabled={busy} onClick={() => action('sync')} className="rounded-xl border border-[var(--hbe-line)] px-4 py-2.5 text-sm font-bold text-[var(--hbe-text)] flex items-center gap-2"><RefreshCw size={15} className={busy ? 'animate-spin' : ''} /> Sync status</button>
            )}
            {['approved', 'delivered', 'live'].includes(release.status) && release.distribeatsReleaseId && (
              <button disabled={busy} onClick={() => downloadDdex('4.2')} className="rounded-xl border border-[var(--hbe-line)] px-4 py-2.5 text-sm font-bold text-[var(--hbe-text)] flex items-center gap-2"><Download size={15} /> DDEX ERN 4.2</button>
            )}
          </div>
        )}
      </div>

      {connection?.status !== 'connected' && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-500"><strong>DistriBeats unavailable:</strong> {connection?.message || 'configure the server-side integration before submitting.'}</div>
      )}

      {release.distributionMode === 'catalog_transfer' && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-[var(--hbe-text-soft)]">
          <div className="flex items-start gap-3"><RefreshCw size={17} className="mt-0.5 shrink-0 text-sky-500"/><div><strong className="text-sky-500">Catalogue transfer from {release.sourceDistributor || 'another distributor'}</strong><p className="mt-1">Keep the existing release live until this release reaches <strong>Live</strong> in every selected store. Removing it early can interrupt availability and store matching.</p>{release.sourceReleaseUrl && <a href={release.sourceReleaseUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block break-all text-xs font-semibold text-sky-500 underline">Open existing release</a>}</div></div>
        </div>
      )}

      {release.validationResult && !release.validationResult.ready && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-400 space-y-1.5">
          <div className="font-bold text-sm flex items-center gap-1.5 text-amber-500"><AlertTriangle size={15} /> Pre-submission validation issues ({release.validationResult.errors?.length || 0}):</div>
          <ul className="list-disc pl-5 space-y-0.5">
            {(release.validationResult.errors || []).map((errItem, idx) => <li key={idx}><strong className="font-mono">{errItem.field}:</strong> {errItem.message}</li>)}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5 overflow-x-auto">
        <div className="flex min-w-[680px] items-center">
          {stages.map((stage, index) => (
            <React.Fragment key={stage}>
              <div className="flex flex-col items-center gap-2">
                <div className={`grid h-9 w-9 place-items-center rounded-full border-2 ${index <= active ? 'border-violet-500 bg-violet-500 text-white' : 'border-[var(--hbe-line)] text-[var(--hbe-muted)]'}`}>
                  {index < active ? <CheckCircle2 size={17} /> : index + 1}
                </div>
                <span className="text-[10px] font-bold uppercase text-[var(--hbe-muted)]">{stage}</span>
              </div>
              {index < stages.length - 1 && <div className={`mb-5 h-0.5 flex-1 ${index < active ? 'bg-violet-500' : 'bg-[var(--hbe-line)]'}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {(release.status === 'rejected' || release.status === 'error' || release.syncErrors?.length) && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
          <h2 className="flex items-center gap-2 font-bold text-red-500"><AlertTriangle size={17} /> Distribution issue</h2>
          <p className="mt-2 text-sm text-[var(--hbe-text-soft)]">{release.rejectionReason || release.syncErrors?.at(-1)?.message || 'The provider reported an error.'}</p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.6fr]">
        <div className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5">
          {release.coverArtUrl ? <img src={release.coverArtUrl} className="aspect-square w-full rounded-xl object-cover" /> : <div className="aspect-square rounded-xl bg-violet-500/10 grid place-items-center"><Music2 size={42} className="text-violet-500" /></div>}
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-xs text-[var(--hbe-muted)]">Release date</dt><dd className="font-semibold text-[var(--hbe-text)]">{new Date(release.releaseDate).toLocaleDateString()}</dd></div>
            <div><dt className="text-xs text-[var(--hbe-muted)]">UPC / EAN</dt><dd className="font-semibold text-[var(--hbe-text)]">{release.upc || 'Assigned on approval'}</dd></div>
            {release.distributionMode === 'catalog_transfer' && <div><dt className="text-xs text-[var(--hbe-muted)]">Original release date</dt><dd className="font-semibold text-[var(--hbe-text)]">{release.originalReleaseDate ? new Date(release.originalReleaseDate).toLocaleDateString() : 'Required'}</dd></div>}
            {release.distributionMode === 'catalog_transfer' && <div><dt className="text-xs text-[var(--hbe-muted)]">Transfer source</dt><dd className="font-semibold text-[var(--hbe-text)]">{release.sourceDistributor || '—'}</dd></div>}
            <div><dt className="text-xs text-[var(--hbe-muted)]">Territories</dt><dd className="font-semibold text-[var(--hbe-text)]">{release.worldwide !== false ? `Worldwide${release.excludedTerritories?.length ? ` (excl. ${release.excludedTerritories.join(', ')})` : ''}` : release.territories.join(', ')}</dd></div>
            <div><dt className="text-xs text-[var(--hbe-muted)]">Provider ID</dt><dd className="break-all font-semibold text-[var(--hbe-text)]">{release.distribeatsReleaseId || release.providerReleaseId || 'Not submitted'}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-[var(--hbe-muted)]">Selected Stores ({release.dspOutletIds?.length || 0})</dt><dd className="font-semibold text-[var(--hbe-text)] text-xs mt-1">{(release.dspOutletIds || []).join(', ') || '—'}</dd></div>
          </dl>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5">
            <h2 className="mb-4 font-bold text-[var(--hbe-text)]">Content & Quality Review</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--hbe-muted)]">Overall QC Status:</span>
                <span className={`font-bold capitalize ${release.qcStatus === 'ready_for_distribution' ? 'text-emerald-500' : release.qcStatus === 'qc_failed' ? 'text-red-500' : release.qcStatus === 'action_required' ? 'text-amber-500' : 'text-blue-500'}`}>
                  {(release.qcStatus || 'pending_qc').replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--hbe-muted)]">Rights Verification:</span>
                <span className={`font-bold capitalize ${release.rightsStatus === 'approved' ? 'text-emerald-500' : release.rightsStatus === 'rejected' ? 'text-red-500' : 'text-amber-500'}`}>
                  {(release.rightsStatus || 'not_reviewed').replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5">
            <h2 className="mb-4 font-bold text-[var(--hbe-text)]">Tracks ({release.tracks.length})</h2>
            <div className="space-y-3">
              {release.tracks.map((track, index) => (
                <div key={track._id || index} className="rounded-xl border border-[var(--hbe-line)] p-4 space-y-2">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[var(--hbe-text)]">{index + 1}. {track.title} {track.version && track.version !== 'Original' ? `(${track.version})` : ''}</p>
                      <p className="text-xs text-[var(--hbe-muted)]">
                        {track.audioFileName || 'Audio attached'} · ISRC: {track.isrc || 'Pending'} {track.iswc ? `· ISWC: ${track.iswc}` : ''} · {track.language}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold">
                      {track.instrumental && <span className="rounded bg-sky-500/15 px-2 py-0.5 text-sky-400">Instrumental</span>}
                      {track.explicit && <span className="rounded bg-amber-500/15 px-2 py-0.5 text-amber-500">Explicit</span>}
                      <span className="rounded bg-violet-500/15 px-2 py-0.5 text-violet-400">{track.compositionType || 'Original'} / {track.copyrightType || 'Original'}</span>
                      {track.aiUsage && track.aiUsage !== 'None' && <span className="rounded bg-purple-500/15 px-2 py-0.5 text-purple-400">AI: {track.aiUsage}</span>}
                    </div>
                  </div>
                  <div className="grid gap-1 text-xs text-[var(--hbe-muted)] sm:grid-cols-2">
                    <div><strong className="text-[var(--hbe-text-soft)]">Composers:</strong> {track.composers?.join(', ') || '—'}</div>
                    <div><strong className="text-[var(--hbe-text-soft)]">Writers:</strong> {track.instrumental ? 'Instrumental' : (track.writers?.join(', ') || '—')}</div>
                    <div><strong className="text-[var(--hbe-text-soft)]">Producers:</strong> {track.producers?.join(', ') || '—'}</div>
                    <div><strong className="text-[var(--hbe-text-soft)]">Mix / Master:</strong> {[...(track.mixingEngineers || []), ...(track.masteringEngineers || [])].join(', ') || '—'}</div>
                  </div>
                  {track.performers && track.performers.length > 0 && (
                    <p className="text-xs text-[var(--hbe-muted)]"><strong className="text-[var(--hbe-text-soft)]">Performers:</strong> {track.performers.map(p => `${p.name} (${p.role})`).join(' · ')}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DistributionDetail;
