import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, AlertTriangle, CheckCircle2, Cpu, Database, Disc, Edit3, ExternalLink,
  HardDrive, RefreshCw, Search, Server, ShieldCheck, Wifi, WifiOff, XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { distributionApi } from '../../services/api';
import { useSocket } from '../../contexts/SocketContext';

type IssueItem = {
  category: 'metadata' | 'file' | 'sync' | 'qc';
  field: string;
  message: string;
  code: string;
};

type ReleaseHealthRow = {
  _id: string;
  title: string;
  type: string;
  distributionMode: 'new_release' | 'catalog_transfer';
  sourceDistributor?: string;
  status: string;
  qcStatus: string;
  syncStatus: string;
  upc?: string;
  providerReleaseId?: string;
  releaseDate?: string;
  originalReleaseDate?: string | null;
  tracksCount: number;
  artist: {
    _id: string;
    name: string;
    hasDistribeatsId: boolean;
    hasEmail: boolean;
  };
  coverOk: boolean;
  audioOk: boolean;
  metadataOk: boolean;
  syncOk: boolean;
  qcOk: boolean;
  readyToSubmit: boolean;
  issues: IssueItem[];
};

type Props = {
  embedded?: boolean;
  onEditRelease?: (releaseId: string) => void;
};

const formatUptime = (seconds = 0) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const SystemHealthPanel: React.FC<Props> = ({ embedded = false, onEditRelease }) => {
  const { connected } = useSocket();
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revalidatingId, setRevalidatingId] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'errors' | 'ready' | 'transfers'>('all');
  const [search, setSearch] = useState('');

  const loadHealth = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await distributionApi.getSystemHealth(force);
      setHealth(res.data.data);
      if (force) toast.success('System & distribution health check completed (read-only).');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load system health diagnostics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadHealth(false);
  }, []);

  const revalidateSingle = async (releaseId: string, title: string) => {
    setRevalidatingId(releaseId);
    try {
      const res = await distributionApi.validate(releaseId);
      const result = res.data.data;
      if (result.ready) {
        toast.success(`"${title}" passed all OpenAPI & on-disk file checks.`);
      } else {
        toast.error(`"${title}" has ${result.errors?.length || 1} validation issue(s).`);
      }
      await loadHealth(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Validation check failed');
    } finally {
      setRevalidatingId('');
    }
  };

  const releaseChecks: ReleaseHealthRow[] = health?.distributionAudit?.releaseChecks || [];

  const filteredReleases = useMemo(() => {
    return releaseChecks.filter(row => {
      if (filterMode === 'errors' && row.issues.length === 0) return false;
      if (filterMode === 'ready' && !row.readyToSubmit) return false;
      if (filterMode === 'transfers' && row.distributionMode !== 'catalog_transfer') return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return [
          row.title,
          row.artist?.name,
          row.upc,
          row.providerReleaseId,
          ...row.issues.map(i => `${i.field} ${i.message}`),
        ].some(val => val && val.toLowerCase().includes(q));
      }
      return true;
    });
  }, [releaseChecks, filterMode, search]);

  if (loading && !health) {
    return (
      <div className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-12 text-center text-sm text-[var(--hbe-muted)]">
        Running read-only system & distribution health diagnostics…
      </div>
    );
  }

  const infra = health?.infrastructure || {};
  const provider = health?.provider || {};
  const conn = provider?.connection || {};
  const cat = provider?.catalogue || {};
  const audit = health?.distributionAudit || {};
  const roster = health?.artistRosterAudit || {};
  const overall = health?.overallStatus || 'healthy';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className={`${embedded ? 'text-xl' : 'text-2xl'} font-extrabold text-[var(--hbe-text)] flex items-center gap-2`}>
                <Activity size={22} className="text-violet-500" />
                System & Distribution Health Monitor
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase ${
                  overall === 'healthy'
                    ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-500'
                    : overall === 'warning'
                      ? 'border border-amber-500/30 bg-amber-500/15 text-amber-500'
                      : 'border border-red-500/30 bg-red-500/15 text-red-500'
                }`}
              >
                {overall === 'healthy' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                {overall === 'healthy' ? 'All Systems Healthy' : overall === 'warning' ? 'Attention Needed' : 'System Degraded'}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[11px] font-bold text-sky-400">
                <ShieldCheck size={13} /> 100% Read-Only (No Demo Distribute)
              </span>
            </div>
            <p className="mt-1.5 text-xs text-[var(--hbe-muted)]">
              Live non-destructive inspection of backend runtime, MySQL database, disk storage, DistriBeats API & catalogue, webhooks, and per-release metadata/file integrity.
              {health?.checkedAt && (
                <span className="ml-2 font-semibold text-[var(--hbe-text-soft)]">
                  · Last checked {new Date(health.checkedAt).toLocaleTimeString()} ({health.checkDurationMs || 0} ms)
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${connected ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-zinc-700 text-zinc-500'}`}>
              {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
              {connected ? 'Live Socket Connected' : 'Socket Offline'}
            </div>
            {!embedded && (
              <Link to="/distribution" className="rounded-xl border border-[var(--hbe-line)] bg-[var(--hbe-fill-soft)] px-4 py-2 text-xs font-bold text-[var(--hbe-text)] hover:border-violet-500/40">
                Open Distribution →
              </Link>
            )}
            <button
              type="button"
              disabled={refreshing}
              onClick={() => loadHealth(true)}
              className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50 flex items-center gap-1.5"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Checking Health…' : 'Run Health Check'}
            </button>
          </div>
        </div>
      </div>

      {/* 4 Core Infrastructure & Provider Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Backend Server Runtime */}
        <div className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--hbe-muted)] flex items-center gap-1.5">
              <Server size={15} className="text-violet-500" /> Backend API Runtime
            </span>
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-500">ONLINE</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-[var(--hbe-muted)]">Uptime</span><strong className="text-[var(--hbe-text)]">{formatUptime(infra.server?.uptimeSeconds)}</strong></div>
            <div className="flex justify-between"><span className="text-[var(--hbe-muted)]">Memory (RSS / Heap)</span><strong className="text-[var(--hbe-text)]">{infra.server?.memoryRssMb || 0} MB / {infra.server?.memoryHeapMb || 0} MB</strong></div>
            <div className="flex justify-between"><span className="text-[var(--hbe-muted)]">Node.js Runtime</span><strong className="text-[var(--hbe-text)]">{infra.server?.nodeVersion || '—'}</strong></div>
            <div className="flex justify-between"><span className="text-[var(--hbe-muted)]">Environment</span><strong className="uppercase text-[var(--hbe-text)]">{infra.server?.env || 'production'}</strong></div>
          </div>
        </div>

        {/* Card 2: MySQL Database & Disk Storage */}
        <div className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--hbe-muted)] flex items-center gap-1.5">
              <Database size={15} className="text-sky-500" /> MySQL & Master Storage
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${infra.database?.status === 'healthy' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500'}`}>
              {infra.database?.status === 'healthy' ? 'HEALTHY' : 'ERROR'}
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-[var(--hbe-muted)]">Database Engine</span><strong className="text-[var(--hbe-text)]">{infra.database?.dialect || 'MySQL'}</strong></div>
            <div className="flex justify-between"><span className="text-[var(--hbe-muted)]">DB Ping Latency</span><strong className="text-emerald-500">{infra.database?.latencyMs ?? 0} ms</strong></div>
            <div className="flex justify-between"><span className="text-[var(--hbe-muted)]">Uploads Folder</span><strong className={infra.storage?.uploadDirExists ? 'text-emerald-500' : 'text-amber-500'}>{infra.storage?.uploadDirExists ? 'Ready & Writable' : 'Created on Upload'}</strong></div>
            <div className="flex justify-between"><span className="text-[var(--hbe-muted)]">Stored Media Files</span><strong className="text-[var(--hbe-text)]">{infra.storage?.totalFilesOnDisk || 0} files ({infra.storage?.totalMegabytesOnDisk || 0} MB)</strong></div>
          </div>
        </div>

        {/* Card 3: DistriBeats API & Live Catalogue */}
        <div className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--hbe-muted)] flex items-center gap-1.5">
              <Disc size={15} className="text-emerald-500" /> DistriBeats API ({conn.environment?.toUpperCase() || 'LIVE'})
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${conn.status === 'connected' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500'}`}>
              {conn.status === 'connected' ? 'CONNECTED' : conn.status || 'OFFLINE'}
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-[var(--hbe-muted)]">API Mode & Ping</span><strong className={conn.testMode ? 'text-amber-500' : 'text-emerald-500'}>{conn.testMode ? 'TEST (Sandbox)' : 'LIVE (Production)'} · {conn.latencyMs ?? '—'} ms</strong></div>
            <div className="flex justify-between"><span className="text-[var(--hbe-muted)]">Catalogue Genres / Langs</span><strong className="text-[var(--hbe-text)]">{cat.genresCount || 0} genres · {cat.languagesCount || 0} langs</strong></div>
            <div className="flex justify-between"><span className="text-[var(--hbe-muted)]">Active DSP Stores</span><strong className="text-[var(--hbe-text)]">{cat.activeStoresCount || 0} stores · {cat.performerRolesCount || 0} roles</strong></div>
            <div className="flex justify-between"><span className="text-[var(--hbe-muted)]">Min Release Date</span><strong className="text-[var(--hbe-text)]">{cat.earliestReleaseDate || '—'} ({cat.maxAudioMegabytes || 300} MB max)</strong></div>
          </div>
        </div>

        {/* Card 4: Webhooks & Artist Roster Readiness */}
        <div className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--hbe-muted)] flex items-center gap-1.5">
              <Cpu size={15} className="text-amber-500" /> Webhooks & Roster
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${infra.webhook?.configured ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'}`}>
              {infra.webhook?.configured ? 'HMAC ACTIVE' : 'NO SECRET'}
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-[var(--hbe-muted)]">Webhook Deliveries</span><strong className="text-[var(--hbe-text)]">{infra.webhook?.processedEvents || 0} ok / {infra.webhook?.failedEvents || 0} failed</strong></div>
            <div className="flex justify-between"><span className="text-[var(--hbe-muted)]">Workspace Artists</span><strong className="text-[var(--hbe-text)]">{roster.totalArtists || 0} total ({roster.linkedToDistribeatsCount || 0} linked)</strong></div>
            <div className="flex justify-between"><span className="text-[var(--hbe-muted)]">Artists with Email</span><strong className="text-[var(--hbe-text)]">{roster.withEmailCount || 0} / {roster.totalArtists || 0}</strong></div>
            <div className="flex justify-between"><span className="text-[var(--hbe-muted)]">Artists with Spotify URL</span><strong className="text-[var(--hbe-text)]">{roster.withSpotifyUrlCount || 0} / {roster.totalArtists || 0}</strong></div>
          </div>
        </div>
      </div>

      {/* Distribution Summary Counters */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[
          { label: 'Total Releases', value: audit.totalReleases || 0, color: 'text-[var(--hbe-text)]' },
          { label: 'Healthy (0 Errors)', value: audit.healthyReleasesCount || 0, color: 'text-emerald-500' },
          { label: 'Releases With Errors', value: audit.releasesWithErrorsCount || 0, color: (audit.releasesWithErrorsCount || 0) > 0 ? 'text-red-500' : 'text-emerald-500' },
          { label: 'Pending Admin QC', value: audit.qcPendingCount || 0, color: (audit.qcPendingCount || 0) > 0 ? 'text-amber-500' : 'text-[var(--hbe-text)]' },
          { label: 'Catalogue Transfers', value: audit.transferReleasesCount || 0, color: 'text-sky-500' },
          { label: 'Live / Delivered', value: (audit.byStatus?.live || 0) + (audit.byStatus?.delivered || 0) + (audit.byStatus?.submitted || 0), color: 'text-violet-500' },
        ].map(stat => (
          <div key={stat.label} className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-4">
            <p className="text-xs text-[var(--hbe-muted)]">{stat.label}</p>
            <p className={`mt-1 text-2xl font-extrabold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Per-Release Health & Error Inspector Table */}
      <div className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base font-bold text-[var(--hbe-text)] flex items-center gap-2">
              <HardDrive size={17} className="text-violet-500" />
              Distribution Release Error & File Integrity Audit
            </h3>
            <p className="text-xs text-[var(--hbe-muted)]">
              Checks every release against the live DistriBeats OpenAPI schema, verifies 3000×3000 px RGB covers and WAV/FLAC masters on disk, and surfaces any QC or sync errors.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {([
              ['all', `All (${releaseChecks.length})`],
              ['errors', `With Errors (${audit.releasesWithErrorsCount || 0})`],
              ['ready', `Ready to Submit (${releaseChecks.filter(r => r.readyToSubmit).length})`],
              ['transfers', `Transfers (${audit.transferReleasesCount || 0})`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilterMode(key)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                  filterMode === key
                    ? 'bg-violet-600 text-white'
                    : 'border border-[var(--hbe-line)] bg-[var(--hbe-fill-soft)] text-[var(--hbe-muted)] hover:text-[var(--hbe-text)]'
                }`}
              >
                {label}
              </button>
            ))}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-[var(--hbe-muted)]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search release or error…"
                className="rounded-xl border border-[var(--hbe-line)] bg-[var(--hbe-fill-soft)] pl-8 pr-3 py-1.5 text-xs text-[var(--hbe-text)] outline-none focus:border-violet-500"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--hbe-line)]">
          <table className="w-full min-w-[920px] text-left text-xs">
            <thead className="bg-[var(--hbe-fill-soft)] uppercase text-[var(--hbe-muted)]">
              <tr>
                <th className="p-3.5">Release</th>
                <th className="p-3.5">Artist</th>
                <th className="p-3.5">Status / QC</th>
                <th className="p-3.5">Metadata & OpenAPI</th>
                <th className="p-3.5">Cover Art (Disk)</th>
                <th className="p-3.5">Audio Masters (Disk)</th>
                <th className="p-3.5">Sync State</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--hbe-divide)]">
              {filteredReleases.map(row => (
                <React.Fragment key={row._id}>
                  <tr className={row.issues.length > 0 ? 'bg-red-500/[0.02]' : ''}>
                    <td className="p-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-sm text-[var(--hbe-text)]">{row.title}</span>
                        {row.distributionMode === 'catalog_transfer' && (
                          <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-400">
                            TRANSFER {row.sourceDistributor ? `(${row.sourceDistributor})` : ''}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[var(--hbe-muted)]">
                        {row.type.toUpperCase()} · {row.tracksCount} track{row.tracksCount === 1 ? '' : 's'}
                        {row.upc ? ` · UPC: ${row.upc}` : ''}
                        {row.providerReleaseId ? ` · ID: ${row.providerReleaseId}` : ''}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-[var(--hbe-text)]">{row.artist?.name}</div>
                      <div className="mt-0.5 text-[11px] text-[var(--hbe-muted)]">
                        {row.artist?.hasDistribeatsId ? (
                          <span className="text-emerald-500">Linked to DistriBeats</span>
                        ) : (
                          <span>Auto-matches on submit</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="font-bold capitalize text-[var(--hbe-text)]">{row.status.replace(/_/g, ' ')}</span>
                      <div className={`mt-0.5 text-[11px] font-semibold capitalize ${row.qcStatus === 'ready_for_distribution' ? 'text-emerald-500' : row.qcStatus === 'qc_failed' ? 'text-red-500' : 'text-amber-500'}`}>
                        QC: {row.qcStatus.replace(/_/g, ' ')}
                      </div>
                    </td>
                    <td className="p-3.5">
                      {row.metadataOk ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-500"><CheckCircle2 size={13} /> Valid</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-red-500">
                          <XCircle size={13} /> {row.issues.filter(i => i.category === 'metadata').length} issue(s)
                        </span>
                      )}
                    </td>
                    <td className="p-3.5">
                      {row.coverOk ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-500"><CheckCircle2 size={13} /> 3000×3000 OK</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-red-500"><XCircle size={13} /> Missing / Invalid</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      {row.audioOk ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-500"><CheckCircle2 size={13} /> WAV/FLAC OK</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-red-500"><XCircle size={13} /> Missing / Invalid</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      {row.syncOk ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-500"><CheckCircle2 size={13} /> Healthy</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-red-500"><AlertTriangle size={13} /> Sync Error</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={revalidatingId === row._id}
                          onClick={() => revalidateSingle(row._id, row.title)}
                          className="rounded-lg border border-[var(--hbe-line)] px-2.5 py-1.5 font-semibold text-[var(--hbe-text)] hover:border-violet-500/40 disabled:opacity-50"
                          title="Run read-only OpenAPI & disk file check"
                        >
                          {revalidatingId === row._id ? 'Checking…' : 'Check'}
                        </button>
                        {row.status === 'draft' && (
                          onEditRelease ? (
                            <button
                              type="button"
                              onClick={() => onEditRelease(row._id)}
                              className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-2.5 py-1.5 font-bold text-violet-400 flex items-center gap-1"
                            >
                              <Edit3 size={12} /> Fix / Edit
                            </button>
                          ) : (
                            <Link
                              to={`/distribution?edit=${row._id}`}
                              className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-2.5 py-1.5 font-bold text-violet-400 flex items-center gap-1"
                            >
                              <Edit3 size={12} /> Fix / Edit
                            </Link>
                          )
                        )}
                        <Link
                          to={`/distribution/${row._id}`}
                          className="rounded-lg border border-[var(--hbe-line)] px-2.5 py-1.5 font-semibold text-[var(--hbe-text)] flex items-center gap-1"
                        >
                          Details <ExternalLink size={11} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                  {row.issues.length > 0 && (
                    <tr className="bg-red-500/[0.04]">
                      <td colSpan={8} className="px-4 py-3">
                        <div className="text-[11px] font-bold text-red-400 mb-1 flex items-center gap-1.5">
                          <AlertTriangle size={13} /> {row.issues.length} diagnostic issue{row.issues.length === 1 ? '' : 's'} detected on &ldquo;{row.title}&rdquo;:
                        </div>
                        <ul className="grid gap-1 sm:grid-cols-2 pl-4 list-disc text-[11px] text-red-300">
                          {row.issues.map((issue, idx) => (
                            <li key={idx}>
                              <span className="uppercase font-mono text-[10px] rounded bg-red-500/20 px-1.5 py-0.5 mr-1.5 text-red-300">
                                {issue.category}
                              </span>
                              <strong className="font-mono text-red-200">{issue.field}:</strong> {issue.message}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {filteredReleases.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-sm text-[var(--hbe-muted)]">
                    {releaseChecks.length === 0
                      ? 'No distribution releases in the workspace yet. System infrastructure and DistriBeats API are ready.'
                      : 'No releases match the selected health filter.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SystemHealthPanel;

