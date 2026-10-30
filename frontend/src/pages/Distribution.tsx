import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, BarChart3, CheckCircle2, Download, Edit3, FolderDown, Music2, Plus, RefreshCw, Search, Send, ShieldAlert, Trash2, Upload, Wifi, WifiOff, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { artistsApi, distribeatsApi, distributionApi, songsApi } from '../services/api';
import type { Artist, DistributionRelease, DistributionTrack, Song } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSocket, type DistribeatsReleaseUpdate } from '../contexts/SocketContext';
import { formatCurrency } from '../utils/helpers';

const statusColors: Record<string, string> = {
  draft: '#64748B', submitted: '#8B5CF6', processing: '#0EA5E9', approved: '#16A34A',
  delivered: '#14B8A6', live: '#10B981', rejected: '#DC2626', error: '#DC2626',
  takedown_requested: '#F59E0B', removed: '#64748B',
};
const input = 'w-full rounded-xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] px-3 py-2 text-sm text-[var(--hbe-text)] outline-none focus:border-violet-500';
const errInput = 'w-full rounded-xl border border-red-500 bg-[var(--hbe-surface)] px-3 py-2 text-sm text-[var(--hbe-text)] outline-none focus:border-red-500';

type PerformerDraft = { name: string; role: string };
type TrackDraft = {
  _id?: string;
  title: string;
  version: string;
  isrc: string;
  iswc: string;
  explicit: boolean;
  instrumental: boolean;
  language: string;
  compositionType: 'Original' | 'Cover';
  copyrightType: 'Original' | 'Licensed';
  rightsProofUrl: string;
  aiUsage: 'None' | 'Partial' | 'Full';
  writers: string;
  composers: string;
  producers: string;
  mixingEngineers: string;
  masteringEngineers: string;
  featuredArtists: string;
  performers: PerformerDraft[];
  previewStart: string;
  durationSeconds: number;
  sourceSong?: string;
  audio?: File;
  audioUrl?: string;
  audioFileName?: string;
  audioSizeBytes?: number;
  suggestedRightsUrls?: Array<{ label: string; url: string }>;
};

const emptyTrack = (artistName = ''): TrackDraft => ({
  title: '',
  version: 'Original',
  isrc: '',
  iswc: '',
  explicit: false,
  instrumental: false,
  language: 'English',
  compositionType: 'Original',
  copyrightType: 'Original',
  rightsProofUrl: '',
  aiUsage: 'None',
  writers: '',
  composers: '',
  producers: '',
  mixingEngineers: '',
  masteringEngineers: '',
  featuredArtists: '',
  performers: [{ name: artistName, role: 'Lead Vocals' }],
  previewStart: '',
  durationSeconds: 0,
});

const defaultEarliestDate = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 9);
  return d.toISOString().slice(0, 10);
};

const splitCsv = (value: string) => value.split(',').map(s => s.trim()).filter(Boolean);
const joinCsv = (value?: string[] | string) => Array.isArray(value) ? value.filter(Boolean).join(', ') : String(value || '');

const inspectCoverFile = (file: File): Promise<{ width: number; height: number } | null> =>
  new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });

const Distribution: React.FC = () => {
  const { user, canAccess } = useAuth();
  const [searchParams] = useSearchParams();
  const { connected, joinRelease, leaveRelease, syncProgress, webhookFeed } = useSocket();
  const requestedTab = searchParams.get('tab');
  const editParam = searchParams.get('edit');
  const [tab, setTab] = useState<'catalog' | 'provider' | 'new' | 'royalties' | 'qc' | 'webhooks'>(
    requestedTab === 'webhooks' && user?.role === 'admin' ? 'webhooks' : requestedTab === 'provider' && user?.role === 'admin' ? 'provider' : 'catalog'
  );
  const [releases, setReleases] = useState<DistributionRelease[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [catalogSongs, setCatalogSongs] = useState<Song[]>([]);
  const [selectedImportSong, setSelectedImportSong] = useState('');
  const [importingSong, setImportingSong] = useState(false);
  const [connection, setConnection] = useState<any>(null);
  const [royalties, setRoyalties] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState('');
  const [references, setReferences] = useState<any>(null);
  const [webhookEvents, setWebhookEvents] = useState<any[]>([]);
  const [webhookTotal, setWebhookTotal] = useState(0);
  const [webhooksLoading, setWebhooksLoading] = useState(false);
  const [remoteReleases, setRemoteReleases] = useState<any[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [editing, setEditing] = useState<DistributionRelease | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [storeSearch, setStoreSearch] = useState('');
  const [territorySearch, setTerritorySearch] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errorList, setErrorList] = useState<Array<{ field: string; message: string }>>([]);
  const [coverPreviewInfo, setCoverPreviewInfo] = useState<string>('');

  const [form, setForm] = useState({
    title: '',
    artist: '',
    type: 'single' as 'single' | 'ep' | 'album',
    genre: '',
    subGenre: '',
    language: 'English',
    releaseDate: '',
    originalReleaseDate: '',
    explicit: false,
    upc: '',
    copyright: '',
    publishingCopyright: '',
    catalogNumber: '',
    artworkAiUsage: 'none',
    worldwide: true,
    territories: [] as string[],
    excludedTerritories: [] as string[],
    dspOutletIds: ['Spotify'] as string[],
    featuringArtists: '',
    producer: '',
    songwriters: '',
    composers: '',
    mixingEngineers: '',
    masteringEngineers: '',
    spotifyArtistUrl: '',
    aiDocumentUrl: '',
    attestAge: false,
    attestRights: false,
  });
  const [cover, setCover] = useState<File>();
  const [tracks, setTracks] = useState<TrackDraft[]>([emptyTrack()]);
  const joinedReleases = useRef<Set<string>>(new Set());

  const load = async () => {
    try {
      const [releaseRes, connectionRes, royaltyRes] = await Promise.all([
        distributionApi.getAll(), distributionApi.getConnection(), distributionApi.getRoyaltySummary(),
      ]);
      setReleases(releaseRes.data.data);
      setConnection(connectionRes.data.data);
      setRoyalties(royaltyRes.data.data);
      distributionApi.getReferenceData().then(res => setReferences(res.data.data)).catch(() => {});
      songsApi.getAll({ limit: 200 }).then(res => setCatalogSongs(res.data.data || [])).catch(() => {});
      if (user?.role !== 'artist') setArtists((await artistsApi.getAll()).data.data);
    } catch (error: any) { toast.error(error.response?.data?.message || 'Failed to load distribution'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (editParam && releases.length > 0 && !editing) {
      const target = releases.find(r => r._id === editParam && r.status === 'draft');
      if (target) editDraft(target);
    }
  }, [editParam, releases]);

  const loadWebhookEvents = async () => {
    if (user?.role !== 'admin') return;
    setWebhooksLoading(true);
    try {
      const response = await distribeatsApi.getWebhookEvents({ limit: 100 });
      setWebhookEvents(response.data.data.events || []);
      setWebhookTotal(response.data.data.total || 0);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load webhook history');
    } finally { setWebhooksLoading(false); }
  };
  useEffect(() => { if (tab === 'webhooks') loadWebhookEvents(); }, [tab]);
  useEffect(() => { if (tab === 'webhooks' && webhookFeed.length) loadWebhookEvents(); }, [webhookFeed.length]);

  const loadRemoteReleases = async () => {
    if (user?.role !== 'admin') return;
    setRemoteLoading(true);
    try {
      const response = await distribeatsApi.listReleases({ limit: 100 });
      const payload = response.data.data;
      setRemoteReleases(Array.isArray(payload) ? payload : payload?.data || payload?.releases || []);
    } catch (error: any) { toast.error(error.response?.data?.message || 'Failed to load Distribeats catalogue'); }
    finally { setRemoteLoading(false); }
  };
  useEffect(() => { if (tab === 'provider') loadRemoteReleases(); }, [tab]);

  useEffect(() => {
    if (!connected || releases.length === 0) return;
    releases.forEach(r => {
      if (!joinedReleases.current.has(r._id)) {
        joinRelease(r._id);
        joinedReleases.current.add(r._id);
      }
    });
  }, [connected, releases, joinRelease]);

  useEffect(() => {
    const handler = (e: Event) => {
      const update = (e as CustomEvent<DistribeatsReleaseUpdate>).detail;
      setReleases(prev =>
        prev.map(r =>
          r._id === update.releaseId
            ? { ...r, status: update.status as any, qcStatus: update.qcStatus as any, storeStatuses: (update.storeStatuses ?? r.storeStatuses) as any, distribeatsRawStatus: update.distribeatsRawStatus, lastSyncedAt: update.lastSyncedAt }
            : r
        )
      );
      distributionApi.getConnection().then(res => setConnection(res.data.data)).catch(() => {});
    };
    window.addEventListener('hbe:distribeats_release_updated', handler);
    return () => {
      window.removeEventListener('hbe:distribeats_release_updated', handler);
      joinedReleases.current.forEach(id => leaveRelease(id));
      joinedReleases.current.clear();
    };
  }, [leaveRelease]);

  // Catalogue-derived options (all from GET /catalogue via /distribution/reference-data).
  const catalogueGenres: string[] = useMemo(() => (references?.genres || []).map((g: any) => typeof g === 'string' ? g : g.name || g.value), [references]);
  const catalogueLanguages: Array<{ value: string; label: string }> = useMemo(
    () => (references?.languages || [{ value: 'English', label: 'English' }]).map((l: any) => typeof l === 'string' ? { value: l, label: l } : { value: l.value, label: l.label || l.value }),
    [references]
  );
  const catalogueStores: string[] = useMemo(() => (references?.stores || ['Spotify', 'Apple Music', 'YouTube Music']).map((s: any) => typeof s === 'string' ? s : s.name), [references]);
  const generalStores: string[] = useMemo(() => references?.generalStores || catalogueStores.filter((s: string) => s !== 'YouTube Content ID'), [references, catalogueStores]);
  const performerRoles: string[] = useMemo(() => references?.performerRoles || ['Lead Vocals', 'Vocals', 'Programming', 'Guitar', 'Drums', 'Bass', 'Keyboards', 'Synthesizer'], [references]);
  const releaseTypes: Array<{ value: 'single' | 'ep' | 'album'; label: string }> = useMemo(() => {
    const raw: string[] = references?.releaseTypes || ['Single', 'EP', 'Album'];
    return raw.map(r => ({ value: r.toLowerCase() as 'single' | 'ep' | 'album', label: r }));
  }, [references]);
  const aiOptions: Array<'None' | 'Partial' | 'Full'> = useMemo(() => references?.aiUsage || ['None', 'Partial', 'Full'], [references]);
  const compositionOptions: Array<'Original' | 'Cover'> = useMemo(() => references?.compositionTypes || ['Original', 'Cover'], [references]);
  const recordingRightsOptions: Array<'Original' | 'Licensed'> = useMemo(() => references?.recordingRights || ['Original', 'Licensed'], [references]);
  const isoTerritories: Array<{ code: string; name: string }> = useMemo(() => references?.territories || [], [references]);
  const earliestReleaseDate: string = references?.policy?.earliestReleaseDate || defaultEarliestDate();
  const leadTimeDays: number = references?.policy?.leadTime?.days || 9;
  const leadTimeUnit: string = references?.policy?.leadTime?.unit || 'calendar';
  const maxAudioBytes: number = references?.policy?.maxAudioBytes || 150_000_000;

  const hasAiTrack = useMemo(() => tracks.some(t => t.aiUsage === 'Partial' || t.aiUsage === 'Full'), [tracks]);

  // Automatically deselect YouTube Content ID when any track uses Partial or Full AI.
  useEffect(() => {
    if (hasAiTrack && form.dspOutletIds.includes('YouTube Content ID')) {
      setForm(prev => ({ ...prev, dspOutletIds: prev.dspOutletIds.filter(s => s !== 'YouTube Content ID') }));
      toast('YouTube Content ID was deselected because a track uses AI.', { icon: 'ℹ️' });
    }
  }, [hasAiTrack]);

  // Keep Single track[0].title synchronized when user edits release title and track[0].title was empty or matching.
  const handleReleaseTitleChange = (nextTitle: string) => {
    setForm(prev => {
      if (prev.type === 'single' && tracks.length === 1 && (!tracks[0].title || tracks[0].title === prev.title)) {
        setTracks(items => items.map((item, idx) => idx === 0 ? { ...item, title: nextTitle } : item));
      }
      return { ...prev, title: nextTitle };
    });
  };

  const selectedArtistName = useMemo(() => {
    const found = artists.find(a => a._id === form.artist);
    return found?. artistName || found?.stageName || found?.name || (user?.role === 'artist' ? user.name : '') || '';
  }, [artists, form.artist, user]);

  const filtered = useMemo(() => releases.filter(release => {
    const q = query.toLowerCase();
    return (!status || release.status === status) && (!q || [release.title, release.artist?.stageName, release.artist?.name, release.upc, release.providerReleaseId].some(v => v?.toLowerCase().includes(q)));
  }), [releases, query, status]);

  const applyErrors = (errs: Array<{ field: string; message: string }>) => {
    const map: Record<string, string> = {};
    errs.forEach(e => { if (e.field && !map[e.field]) map[e.field] = e.message; });
    setFieldErrors(map);
    setErrorList(errs);
  };

  const clearErrors = () => { setFieldErrors({}); setErrorList([]); };

  const reset = () => {
    setEditing(null);
    clearErrors();
    setCoverPreviewInfo('');
    setForm({
      title: '', artist: '', type: 'single', genre: '', subGenre: '', language: 'English',
      releaseDate: '', originalReleaseDate: '', explicit: false, upc: '', copyright: '',
      publishingCopyright: '', catalogNumber: '', artworkAiUsage: 'none',
      worldwide: true, territories: [], excludedTerritories: [], dspOutletIds: ['Spotify'],
      featuringArtists: '', producer: '', songwriters: '', composers: '',
      mixingEngineers: '', masteringEngineers: '', spotifyArtistUrl: '', aiDocumentUrl: '',
      attestAge: false, attestRights: false,
    });
    setCover(undefined);
    setTracks([emptyTrack()]);
  };

  /** Restore EVERY saved release & track field when editing a draft. */
  const editDraft = (release: DistributionRelease) => {
    if (release.status !== 'draft') {
      toast.error('Only draft releases can be edited.');
      return;
    }
    clearErrors();
    setEditing(release);
    const rawTerritories = (release.territories || []).filter(t => t && t !== 'WORLDWIDE');
    const worldwide = typeof release.worldwide === 'boolean' ? release.worldwide : rawTerritories.length === 0;
    const artistName = release.artist?.artistName || release.artist?.stageName || release.artist?.name || '';
    setForm({
      title: release.title || '',
      artist: release.artist?._id || (typeof release.artist === 'string' ? release.artist : ''),
      type: release.type || 'single',
      genre: release.genre || '',
      subGenre: release.subGenre || '',
      language: release.language || 'English',
      releaseDate: release.releaseDate ? release.releaseDate.slice(0, 10) : '',
      originalReleaseDate: release.originalReleaseDate ? release.originalReleaseDate.slice(0, 10) : '',
      explicit: Boolean(release.explicit),
      upc: release.upc || '',
      copyright: release.copyright || '',
      publishingCopyright: release.publishingCopyright || '',
      catalogNumber: release.catalogNumber || '',
      artworkAiUsage: release.artworkAiUsage || 'none',
      worldwide,
      territories: rawTerritories,
      excludedTerritories: release.excludedTerritories || [],
      dspOutletIds: (release.dspOutletIds || []).filter(s => s && s !== 'all_dsps').length
        ? (release.dspOutletIds || []).filter(s => s && s !== 'all_dsps')
        : ['Spotify'],
      featuringArtists: joinCsv(release.featuringArtists),
      producer: release.producer || '',
      songwriters: joinCsv(release.songwriters),
      composers: joinCsv(release.composers),
      mixingEngineers: joinCsv(release.mixingEngineers),
      masteringEngineers: joinCsv(release.masteringEngineers),
      spotifyArtistUrl: release.spotifyArtistUrl || '',
      aiDocumentUrl: release.aiDocumentUrl || '',
      attestAge: Boolean(release.attestations?.age),
      attestRights: Boolean(release.attestations?.rights),
    });
    setCover(undefined);
    setCoverPreviewInfo(release.coverArtFileName ? `Saved cover: ${release.coverArtFileName}` : release.coverArtUrl ? 'Saved cover artwork attached' : '');
    setTracks((release.tracks || []).map((t: DistributionTrack) => {
      const legacyPerformers: PerformerDraft[] = (t.performers && t.performers.length)
        ? t.performers.map(p => ({ name: p.name, role: p.role }))
        : (t.contributors || [])
            .filter(c => c.role === 'primary_artist' || c.role === 'featured_artist' || performerRoles.includes(c.role))
            .map(c => ({ name: c.name, role: c.role === 'primary_artist' ? 'Lead Vocals' : c.role === 'featured_artist' ? 'Vocals' : c.role }));
      const normComp: 'Original' | 'Cover' = t.compositionType === 'Cover' || t.compositionType === 'cover_song' ? 'Cover' : 'Original';
      const normAi: 'None' | 'Partial' | 'Full' = t.aiUsage === 'Partial' || t.aiUsage === 'Full' ? t.aiUsage : 'None';
      return {
        _id: t._id,
        title: t.title || '',
        version: t.version || 'Original',
        isrc: t.isrc || '',
        iswc: t.iswc || '',
        explicit: Boolean(t.explicit),
        instrumental: Boolean(t.instrumental),
        language: t.language || release.language || 'English',
        compositionType: normComp,
        copyrightType: t.copyrightType === 'Licensed' ? 'Licensed' : 'Original',
        rightsProofUrl: t.rightsProofUrl || '',
        aiUsage: normAi,
        writers: joinCsv(t.writers?.length ? t.writers : release.songwriters),
        composers: joinCsv(t.composers?.length ? t.composers : release.composers?.length ? release.composers : release.songwriters),
        producers: joinCsv(t.producers?.length ? t.producers : release.producer ? [release.producer] : []),
        mixingEngineers: joinCsv(t.mixingEngineers?.length ? t.mixingEngineers : release.mixingEngineers),
        masteringEngineers: joinCsv(t.masteringEngineers?.length ? t.masteringEngineers : release.masteringEngineers),
        featuredArtists: joinCsv(t.featuredArtists?.length ? t.featuredArtists : release.featuringArtists),
        performers: legacyPerformers.length ? legacyPerformers : [{ name: artistName, role: 'Lead Vocals' }],
        previewStart: t.previewStart || '',
        durationSeconds: Number(t.durationSeconds) || 0,
        sourceSong: t.sourceSong ? String(t.sourceSong) : undefined,
        audioUrl: t.audioUrl,
        audioFileName: t.audioFileName,
        audioSizeBytes: t.audioSizeBytes,
      };
    }));
    setTab('new');
  };

  const handleCoverSelect = async (file?: File) => {
    if (!file) { setCover(undefined); return; }
    const ext = file.name.toLowerCase().split('.').pop() || '';
    if (!['jpg', 'jpeg', 'png'].includes(ext) || !['image/jpeg', 'image/png'].includes(file.type)) {
      toast.error('Cover artwork must be a JPG or PNG image.');
      setFieldErrors(prev => ({ ...prev, cover: 'Artwork must be JPG or PNG.' }));
      return;
    }
    const dims = await inspectCoverFile(file);
    if (!dims || dims.width !== 3000 || dims.height !== 3000) {
      const got = dims ? `${dims.width}×${dims.height} px` : 'unreadable image';
      toast.error(`Cover artwork must be exactly 3000×3000 px (selected: ${got}).`);
      setFieldErrors(prev => ({ ...prev, cover: `Cover artwork must be 3000×3000 px (received ${got}).` }));
      return;
    }
    setFieldErrors(prev => { const next = { ...prev }; delete next.cover; return next; });
    setCover(file);
    setCoverPreviewInfo(`${file.name} (${dims.width}×${dims.height} px, ${(file.size / 1048576).toFixed(2)} MiB)`);
  };

  const handleAudioSelect = (index: number, file?: File) => {
    if (!file) return;
    const ext = file.name.toLowerCase().split('.').pop() || '';
    if (!['wav', 'flac'].includes(ext)) {
      toast.error(`Track ${index + 1}: only WAV or FLAC files are supported (rejected .${ext}).`);
      setFieldErrors(prev => ({ ...prev, [`tracks[${index}].audio`]: `Audio must be WAV or FLAC (.${ext} is not accepted).` }));
      return;
    }
    if (file.size > maxAudioBytes) {
      toast.error(`Track ${index + 1}: audio exceeds the ${(maxAudioBytes / 1_000_000).toFixed(0)} MB limit.`);
      setFieldErrors(prev => ({ ...prev, [`tracks[${index}].audio`]: `Audio exceeds ${(maxAudioBytes / 1_000_000).toFixed(0)} MB limit.` }));
      return;
    }
    setFieldErrors(prev => { const next = { ...prev }; delete next[`tracks[${index}].audio`]; return next; });
    setTracks(items => items.map((item, j) => j === index ? { ...item, audio: file, audioFileName: file.name, audioSizeBytes: file.size } : item));
  };

  const handleImportFromCatalog = async (targetTrackIndex?: number) => {
    if (!selectedImportSong) return toast.error('Choose a song from the Music Catalog first.');
    setImportingSong(true);
    try {
      const res = await distributionApi.importSong(selectedImportSong);
      const data = res.data.data;
      const t = data.track || {};
      const r = data.release || {};
      const importedTrack: TrackDraft = {
        title: form.type === 'single' && form.title ? form.title : (t.title || ''),
        version: t.version || 'Original',
        isrc: t.isrc || '',
        iswc: t.iswc || '',
        explicit: Boolean(t.explicit),
        instrumental: Boolean(t.instrumental),
        language: t.language || form.language || 'English',
        compositionType: t.compositionType === 'Cover' ? 'Cover' : 'Original',
        copyrightType: t.copyrightType === 'Licensed' ? 'Licensed' : 'Original',
        rightsProofUrl: data.suggestions?.rightsProofUrls?.[0]?.url || '',
        aiUsage: 'None',
        writers: joinCsv(t.writers),
        composers: joinCsv(t.composers),
        producers: joinCsv(t.producers),
        mixingEngineers: joinCsv(t.mixingEngineers),
        masteringEngineers: joinCsv(t.masteringEngineers),
        featuredArtists: joinCsv(t.featuredArtists),
        performers: Array.isArray(t.performers) && t.performers.length ? t.performers : [{ name: selectedArtistName || 'Artist', role: 'Lead Vocals' }],
        previewStart: '',
        durationSeconds: Number(t.durationSeconds) || 0,
        sourceSong: t.sourceSong || selectedImportSong,
        audioUrl: t.audioUrl,
        audioFileName: t.audioFileName,
        audioSizeBytes: t.audioSizeBytes,
        suggestedRightsUrls: data.suggestions?.rightsProofUrls || [],
      };

      setForm(prev => ({
        ...prev,
        title: prev.title || t.title || '',
        artist: prev.artist || r.artist || '',
        genre: prev.genre || r.genre || '',
        subGenre: prev.subGenre || r.subGenre || r.genre || '',
        language: prev.language || r.language || 'English',
        explicit: prev.explicit || Boolean(r.explicit),
        copyright: prev.copyright || r.copyright || '',
        publishingCopyright: prev.publishingCopyright || r.publishingCopyright || '',
        upc: prev.upc || r.upc || '',
        producer: prev.producer || joinCsv(t.producers),
        songwriters: prev.songwriters || joinCsv(t.writers),
        composers: prev.composers || joinCsv(t.composers),
        mixingEngineers: prev.mixingEngineers || joinCsv(t.mixingEngineers),
        masteringEngineers: prev.masteringEngineers || joinCsv(t.masteringEngineers),
        featuringArtists: prev.featuringArtists || joinCsv(t.featuredArtists),
      }));

      setTracks(items => {
        if (typeof targetTrackIndex === 'number') {
          return items.map((item, idx) => idx === targetTrackIndex ? { ...importedTrack, _id: item._id } : item);
        }
        if (items.length === 1 && !items[0].title && !items[0].audio && !items[0].audioUrl) {
          return [importedTrack];
        }
        if (form.type === 'single') {
          return [{ ...importedTrack, _id: items[0]?._id }];
        }
        return [...items, importedTrack];
      });

      if (data.warnings?.length) {
        toast(`Imported "${t.title}". Note: ${data.warnings[0]}`, { icon: '⚠️' });
      } else {
        toast.success(`Imported "${t.title}" from Music Catalog.`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Could not import song from Music Catalog');
    } finally {
      setImportingSong(false);
    }
  };

  /** Validate form client-side before sending so every missing/invalid field is highlighted clearly. */
  const validateClientForm = (): Array<{ field: string; message: string }> => {
    const errs: Array<{ field: string; message: string }> = [];
    if (!form.title.trim()) errs.push({ field: 'title', message: 'Release title is required.' });
    if (!form.artist && user?.role !== 'artist') errs.push({ field: 'artist', message: 'Select an artist.' });
    if (!form.genre) errs.push({ field: 'genre', message: 'Select a DistriBeats genre.' });
    if (!form.subGenre) errs.push({ field: 'subGenre', message: 'Select a DistriBeats sub-genre.' });
    if (!form.language) errs.push({ field: 'language', message: 'Select a release language.' });
    if (!form.releaseDate) errs.push({ field: 'releaseDate', message: 'Release date is required.' });
    else if (form.releaseDate < earliestReleaseDate) {
      errs.push({ field: 'releaseDate', message: `Release date must be at least ${leadTimeDays} ${leadTimeUnit} days from today (earliest ${earliestReleaseDate}).` });
    }
    if (!form.copyright.trim()) errs.push({ field: 'copyright', message: 'Copyright owner (© line) is required.' });
    if (!form.dspOutletIds.length) errs.push({ field: 'dspOutletIds', message: 'Select at least one store.' });
    if (!form.worldwide && form.territories.length === 0) errs.push({ field: 'territories', message: 'Select at least one ISO territory or enable worldwide distribution.' });
    if (!form.attestAge) errs.push({ field: 'attestations.age', message: 'Confirm the artist age attestation.' });
    if (!form.attestRights) errs.push({ field: 'attestations.rights', message: 'Confirm the distribution rights attestation.' });
    if (!cover && !editing?.coverArtUrl) errs.push({ field: 'cover', message: 'Upload 3000×3000 px JPG or PNG cover artwork.' });
    if (hasAiTrack) {
      if (!/^https:\/\/.*\.pdf(?:\?|$)/i.test(form.aiDocumentUrl.trim())) {
        errs.push({ field: 'aiDocumentUrl', message: 'An HTTPS PDF URL documenting AI commercial-use rights is required when any track uses Partial or Full AI.' });
      }
      if (form.dspOutletIds.includes('YouTube Content ID')) {
        errs.push({ field: 'dspOutletIds', message: 'YouTube Content ID cannot be selected when any track uses AI.' });
      }
    }
    if (form.type === 'single') {
      if (tracks.length !== 1) errs.push({ field: 'tracks', message: 'A Single release must have exactly 1 track.' });
      else if (tracks[0].title.trim() && form.title.trim() && tracks[0].title.trim() !== form.title.trim()) {
        errs.push({ field: 'tracks[0].title', message: `For a Single, the track title must match the release title ("${form.title.trim()}").` });
      }
    }
    tracks.forEach((t, i) => {
      const p = `tracks[${i}]`;
      if (!t.title.trim()) errs.push({ field: `${p}.title`, message: `Track ${i + 1}: title is required.` });
      if (!t.language) errs.push({ field: `${p}.language`, message: `Track ${i + 1}: language is required.` });
      if (!splitCsv(t.composers).length) errs.push({ field: `${p}.composers`, message: `Track ${i + 1}: composer(s) (full legal names) are required.` });
      if (!t.instrumental && !splitCsv(t.writers).length) errs.push({ field: `${p}.writers`, message: `Track ${i + 1}: writer(s) are required unless the track is instrumental.` });
      if (!splitCsv(t.producers).length) errs.push({ field: `${p}.producers`, message: `Track ${i + 1}: producer(s) are required.` });
      if (!splitCsv(t.mixingEngineers).length) errs.push({ field: `${p}.mixingEngineers`, message: `Track ${i + 1}: mixing engineer(s) are required.` });
      if (!splitCsv(t.masteringEngineers).length) errs.push({ field: `${p}.masteringEngineers`, message: `Track ${i + 1}: mastering engineer(s) are required.` });
      const validPerformers = t.performers.filter(pf => pf.name.trim() && pf.role.trim());
      if (!validPerformers.length) errs.push({ field: `${p}.performers`, message: `Track ${i + 1}: add at least one performer with a DistriBeats performer role.` });
      if ((t.compositionType === 'Cover' || t.copyrightType === 'Licensed') && !/^https:\/\//i.test(t.rightsProofUrl.trim())) {
        errs.push({ field: `${p}.rightsProofUrl`, message: `Track ${i + 1}: an HTTPS rights-proof URL is required for Cover or Licensed tracks.` });
      }
      if (t.previewStart.trim() && !/^\d{1,2}:[0-5]\d$/.test(t.previewStart.trim())) {
        errs.push({ field: `${p}.previewStart`, message: `Track ${i + 1}: preview start must be formatted like 0:45.` });
      }
      if (!t.audio && !t.audioUrl) errs.push({ field: `${p}.audio`, message: `Track ${i + 1}: upload a WAV or FLAC master audio file.` });
    });
    return errs;
  };

  const saveRelease = async () => {
    clearErrors();
    const clientErrs = validateClientForm();
    if (clientErrs.length) {
      applyErrors(clientErrs);
      toast.error(clientErrs[0].message);
      return;
    }
    setSaving(true);
    try {
      const data = new FormData();
      data.append('title', form.title.trim());
      if (form.artist) data.append('artist', form.artist);
      data.append('type', form.type);
      data.append('genre', form.genre);
      data.append('subGenre', form.subGenre);
      data.append('language', form.language);
      data.append('releaseDate', form.releaseDate);
      if (form.originalReleaseDate) data.append('originalReleaseDate', form.originalReleaseDate);
      data.append('explicit', String(form.explicit));
      data.append('upc', form.upc.trim());
      data.append('copyright', form.copyright.trim());
      data.append('publishingCopyright', form.publishingCopyright.trim());
      data.append('catalogNumber', form.catalogNumber.trim());
      data.append('artworkAiUsage', form.artworkAiUsage);
      data.append('worldwide', String(form.worldwide));
      data.append('territories', JSON.stringify(form.worldwide ? ['WORLDWIDE'] : form.territories));
      data.append('excludedTerritories', JSON.stringify(form.worldwide ? form.excludedTerritories : []));
      data.append('dspOutletIds', JSON.stringify(form.dspOutletIds));
      data.append('featuringArtists', JSON.stringify(splitCsv(form.featuringArtists)));
      data.append('producer', form.producer.trim());
      data.append('songwriters', JSON.stringify(splitCsv(form.songwriters)));
      data.append('composers', JSON.stringify(splitCsv(form.composers)));
      data.append('mixingEngineers', JSON.stringify(splitCsv(form.mixingEngineers)));
      data.append('masteringEngineers', JSON.stringify(splitCsv(form.masteringEngineers)));
      data.append('spotifyArtistUrl', form.spotifyArtistUrl.trim());
      data.append('aiDocumentUrl', form.aiDocumentUrl.trim());
      data.append('attestations', JSON.stringify({ age: form.attestAge, rights: form.attestRights }));
      if (cover) data.append('cover', cover);

      const tracksPayload = tracks.map(t => ({
        ...(t._id ? { _id: t._id } : {}),
        title: form.type === 'single' ? form.title.trim() : t.title.trim(),
        version: t.version.trim() || 'Original',
        isrc: t.isrc.trim(),
        iswc: t.iswc.trim(),
        explicit: t.explicit,
        instrumental: t.instrumental,
        language: t.language || form.language || 'English',
        genre: form.genre,
        copyright: form.copyright.trim(),
        compositionType: t.compositionType,
        copyrightType: t.copyrightType,
        rightsProofUrl: t.rightsProofUrl.trim(),
        aiUsage: t.aiUsage,
        writers: t.instrumental ? [] : splitCsv(t.writers),
        composers: splitCsv(t.composers),
        producers: splitCsv(t.producers),
        mixingEngineers: splitCsv(t.mixingEngineers),
        masteringEngineers: splitCsv(t.masteringEngineers),
        featuredArtists: splitCsv(t.featuredArtists),
        performers: t.performers.filter(pf => pf.name.trim() && pf.role.trim()),
        previewStart: t.previewStart.trim(),
        durationSeconds: Number(t.durationSeconds) || 0,
        ...(t.sourceSong ? { sourceSong: t.sourceSong } : {}),
      }));
      data.append('tracks', JSON.stringify(tracksPayload));
      tracks.forEach((t, i) => { if (t.audio) data.append(`audio_${i}`, t.audio); });

      if (editing) await distributionApi.update(editing._id, data);
      else await distributionApi.create(data);

      toast.success(editing ? 'Distribution draft updated without data loss' : 'Distribution draft created');
      reset();
      setTab('catalog');
      await load();
    } catch (error: any) {
      const apiErrs = error.response?.data?.errors;
      if (Array.isArray(apiErrs) && apiErrs.length) {
        applyErrors(apiErrs.map((e: any) => typeof e === 'string' ? { field: 'release', message: e } : e));
      }
      toast.error(error.response?.data?.message || 'Could not save distribution draft');
    } finally {
      setSaving(false);
    }
  };

  const submit = async (id: string) => {
    setActionBusy(id);
    try {
      const res = await distributionApi.submit(id);
      setReleases(items => items.map(item => item._id === id ? { ...item, ...res.data.data } : item));
      toast.success('Release submitted to DistriBeats (TEST MODE). Tracking updates in real time…');
    } catch (error: any) {
      const apiErrs = error.response?.data?.errors;
      const msg = Array.isArray(apiErrs) ? apiErrs.map((e: any) => e.message || e).join('; ') : error.response?.data?.message;
      toast.error(msg || 'Submission failed');
    } finally { setActionBusy(''); }
  };

  const syncRelease = async (id: string) => {
    setActionBusy(`sync_${id}`);
    try { await distributionApi.sync(id); toast.success('Status refresh requested'); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Sync failed'); }
    finally { setActionBusy(''); }
  };

  const download = async () => {
    const res = await distributionApi.exportRoyalties();
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'royalty-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateTrack = (index: number, patch: Partial<TrackDraft>) => {
    setTracks(items => items.map((item, j) => j === index ? { ...item, ...patch } : item));
  };

  const toggleStore = (store: string) => {
    if (hasAiTrack && store === 'YouTube Content ID') return;
    setForm(prev => ({
      ...prev,
      dspOutletIds: prev.dspOutletIds.includes(store)
        ? prev.dspOutletIds.filter(s => s !== store)
        : [...prev.dspOutletIds, store],
    }));
  };

  const toggleTerritory = (code: string, listKey: 'territories' | 'excludedTerritories') => {
    setForm(prev => ({
      ...prev,
      [listKey]: prev[listKey].includes(code)
        ? prev[listKey].filter(c => c !== code)
        : [...prev[listKey], code],
    }));
  };

  if (loading) return <div className="flex min-h-64 items-center justify-center"><RefreshCw className="animate-spin text-violet-500" /></div>;

  const isTestMode = connection?.testMode !== false;
  const isLiveBlocked = Boolean(connection?.liveBlocked || connection?.status === 'live_key_blocked');

  return <div className="space-y-6 pb-12">
    {/* Header */}
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold text-[var(--hbe-text)] flex items-center gap-2"><Music2 className="text-violet-500" /> Distribution</h1>
          {isTestMode && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-extrabold tracking-wide text-amber-500">
              <ShieldAlert size={13} /> TEST MODE (db_test_)
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-[var(--hbe-muted)]">Catalog delivery through DistriBeats with full OpenAPI validation & internal royalty reporting</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${connected ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-zinc-700 text-zinc-500'}`}>
          {connected ? <Wifi size={12} /> : <WifiOff size={12} />}{connected ? 'Live Socket' : 'Offline'}
        </div>
        <div className={`rounded-xl border px-3 py-2 text-xs font-semibold ${connection?.status === 'connected' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : isLiveBlocked ? 'border-red-500/40 bg-red-500/10 text-red-500' : 'border-amber-500/30 bg-amber-500/10 text-amber-500'}`}>
          {connection?.status === 'connected' ? `DistriBeats connected (${connection?.environment?.toUpperCase() || 'TEST'})` : connection?.message || 'DistriBeats unavailable'}
        </div>
      </div>
    </div>

    {isLiveBlocked && (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-500 flex items-start gap-3">
        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
        <div>
          <strong>Live API key blocked by TEST-mode safety policy:</strong> A <code>db_live_</code> key is configured, but this server is locked to TEST mode. Replace it with a <code>db_test_</code> key in <code>backend/.env</code>. No live API calls will be made.
        </div>
      </div>
    )}

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
      {([...(['catalog', 'royalties', 'new'] as const), ...(user?.role === 'admin' ? ['provider' as const, 'qc' as const, 'webhooks' as const] : [])]).map(key => (
        <button key={key} onClick={() => setTab(key)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === key ? 'bg-[var(--hbe-surface)] text-[var(--hbe-text)] shadow-sm' : 'text-[var(--hbe-muted)]'}`}>
          {key === 'catalog' ? 'Catalog' : key === 'provider' ? 'Provider Catalogue' : key === 'royalties' ? 'Revenue & Royalties' : key === 'qc' ? 'Admin QC' : key === 'webhooks' ? 'Webhook History' : editing ? 'Edit Draft' : 'New Release'}
        </button>
      ))}
    </div>

    {tab === 'catalog' && <>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1"><Search size={15} className="absolute left-3 top-3 text-[var(--hbe-muted)]"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search title, artist, UPC or provider ID" className={`${input} pl-9`} /></div>
        <select value={status} onChange={e => setStatus(e.target.value)} className={`${input} sm:w-48`}><option value="">All statuses</option>{Object.keys(statusColors).map(s => <option key={s}>{s}</option>)}</select>
        {canAccess('distribution', 'write') && <button onClick={() => { reset(); setTab('new'); }} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white flex items-center gap-2"><Plus size={16}/> New Release</button>}
      </div>
      <div className="overflow-hidden rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)]"><div className="overflow-x-auto"><table className="w-full min-w-[840px] text-left"><thead className="bg-[var(--hbe-fill-soft)] text-xs uppercase text-[var(--hbe-muted)]"><tr><th className="p-4">Release</th><th>Artist</th><th>Status</th><th>QC Status</th><th>Validation</th><th>Date</th><th className="pr-4 text-right">Action</th></tr></thead><tbody className="divide-y divide-[var(--hbe-divide)]">{filtered.map(release => <tr key={release._id}>
        <td className="p-4"><div className="flex items-center gap-3">{release.coverArtUrl ? <img src={release.coverArtUrl} loading="lazy" className="h-11 w-11 rounded-lg object-cover"/> : <div className="h-11 w-11 rounded-lg bg-violet-500/10 grid place-items-center"><Music2 size={17}/></div>}<div><p className="font-semibold text-[var(--hbe-text)]">{release.title}</p><p className="text-xs text-[var(--hbe-muted)]">{release.tracks.length} track{release.tracks.length === 1 ? '' : 's'} · {release.type.toUpperCase()}</p></div></div></td>
        <td className="text-sm text-[var(--hbe-text-soft)]">{release.artist?.stageName || release.artist?.name}</td>
        <td><span className="rounded-full px-2.5 py-1 text-xs font-bold capitalize" style={{ color: statusColors[release.status], background: `${statusColors[release.status]}18` }}>{release.status.replaceAll('_', ' ')}</span></td>
        <td className="text-xs">
          <span className={`font-bold capitalize ${release.qcStatus === 'ready_for_distribution' ? 'text-emerald-500' : release.qcStatus === 'qc_failed' ? 'text-red-500' : release.qcStatus === 'action_required' ? 'text-amber-500' : 'text-[var(--hbe-muted)]'}`}>
            {(release.qcStatus || 'pending_qc').replace(/_/g, ' ')}
          </span>
        </td>
        <td className="text-xs">
          {release.validationResult ? (
            release.validationResult.ready ? <span className="inline-flex items-center gap-1 font-bold text-emerald-500"><CheckCircle2 size={13}/> Ready</span> : <span className="inline-flex items-center gap-1 font-bold text-amber-500" title={release.validationResult.errors?.map(e => e.message).join('\n')}><AlertTriangle size={13}/> {release.validationResult.errors?.length || 1} issue(s)</span>
          ) : <span className="text-[var(--hbe-muted)]">—</span>}
        </td>
        <td className="text-sm text-[var(--hbe-text-soft)]">{new Date(release.releaseDate).toLocaleDateString()}</td>
        <td className="pr-4 text-right"><div className="flex justify-end gap-2">
          {release.status === 'draft' && canAccess('distribution', 'write') && (
            <button onClick={() => editDraft(release)} className="rounded-lg border border-[var(--hbe-line)] px-3 py-2 text-xs font-semibold text-[var(--hbe-text)] flex items-center gap-1"><Edit3 size={12}/> Edit</button>
          )}
          {release.status === 'draft' && canAccess('distribution', 'write') && (
            <button disabled={actionBusy === release._id || connection?.status !== 'connected' || release.qcStatus !== 'ready_for_distribution'} onClick={() => submit(release._id)} className={`rounded-lg px-3 py-2 text-xs font-bold text-white flex items-center gap-1 disabled:opacity-50 ${release.qcStatus === 'ready_for_distribution' ? 'bg-violet-600' : 'bg-zinc-600 cursor-not-allowed'}`} title={release.qcStatus !== 'ready_for_distribution' ? 'Cannot submit until Content/QC passes.' : ''}><Send size={13}/>{actionBusy === release._id ? 'Submitting…' : 'Submit'}</button>
          )}
          {release.distribeatsReleaseId && <button disabled={actionBusy === `sync_${release._id}`} onClick={() => syncRelease(release._id)} className="rounded-lg border border-[var(--hbe-line)] px-3 py-2 text-xs font-semibold text-[var(--hbe-muted)] flex items-center gap-1 disabled:opacity-50"><RefreshCw size={12} className={actionBusy === `sync_${release._id}` ? 'animate-spin' : ''}/> Sync</button>}
          <Link to={`/distribution/${release._id}`} className="rounded-lg border border-[var(--hbe-line)] px-3 py-2 text-xs font-semibold text-[var(--hbe-text)]">Details</Link>
        </div></td>
      </tr>)}</tbody></table></div>{filtered.length === 0 && <p className="p-10 text-center text-sm text-[var(--hbe-muted)]">No distribution releases found.</p>}</div>
    </>}

    {tab === 'new' && (
      <div className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5 sm:p-7 space-y-7">
        {/* Form header & Music Catalog import bar */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-[var(--hbe-divide)] pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-[var(--hbe-text)]">{editing ? `Edit Draft: ${editing.title}` : 'Create Distribution Release Draft'}</h2>
              <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-500">TEST MODE</span>
            </div>
            <p className="text-xs text-[var(--hbe-muted)] mt-0.5">
              All selections come from the live DistriBeats catalogue. Artwork: 3000×3000 px RGB JPG/PNG · Audio: WAV/FLAC · Lead time: ≥ {leadTimeDays} {leadTimeUnit} days (earliest {earliestReleaseDate}).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={selectedImportSong} onChange={e => setSelectedImportSong(e.target.value)} className={`${input} sm:w-64 text-xs`}>
              <option value="">Import track from Music Catalog…</option>
              {catalogSongs.map(s => (
                <option key={s._id} value={s._id}>{s.title} {typeof s.artist === 'object' ? `— ${s.artist.stageName || s.artist.name}` : ''}</option>
              ))}
            </select>
            <button type="button" disabled={!selectedImportSong || importingSong} onClick={() => handleImportFromCatalog()} className="rounded-xl border border-violet-500/40 bg-violet-500/10 px-3.5 py-2 text-xs font-bold text-violet-400 hover:bg-violet-500/20 disabled:opacity-50 flex items-center gap-1.5">
              <FolderDown size={14}/>{importingSong ? 'Importing…' : 'Prefill from Catalog'}
            </button>
            {editing && <button type="button" onClick={reset} className="rounded-xl border border-[var(--hbe-line)] px-3 py-2 text-xs font-semibold text-[var(--hbe-muted)]">Cancel Edit</button>}
          </div>
        </div>

        {/* Validation Error Summary */}
        {errorList.length > 0 && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-400 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-sm text-red-500"><AlertTriangle size={15}/> Please resolve {errorList.length} validation issue{errorList.length === 1 ? '' : 's'}:</div>
            <ul className="list-disc pl-5 space-y-0.5">
              {errorList.map((errItem, idx) => <li key={idx}><strong className="font-mono">{errItem.field}:</strong> {errItem.message}</li>)}
            </ul>
          </div>
        )}

        {/* Section 1: Release Metadata */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--hbe-muted)]">1. Release Metadata & Rights</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs font-semibold text-[var(--hbe-muted)]">
              Release title *
              <input className={`${fieldErrors.title ? errInput : input} mt-1`} value={form.title} onChange={e => handleReleaseTitleChange(e.target.value)} placeholder="For a Single, must match Track 1 title"/>
              {fieldErrors.title && <span className="mt-1 block text-[11px] text-red-500">{fieldErrors.title}</span>}
            </label>

            {user?.role !== 'artist' && (
              <label className="text-xs font-semibold text-[var(--hbe-muted)]">
                Primary artist *
                <select className={`${fieldErrors.artist ? errInput : input} mt-1`} value={form.artist} onChange={e => setForm({ ...form, artist: e.target.value })}>
                  <option value="">Select artist</option>
                  {artists.map(a => <option key={a._id} value={a._id}>{a.artistName || a.stageName || a.name}</option>)}
                </select>
                {fieldErrors.artist && <span className="mt-1 block text-[11px] text-red-500">{fieldErrors.artist}</span>}
              </label>
            )}

            <label className="text-xs font-semibold text-[var(--hbe-muted)]">
              Release type *
              <select className={`${input} mt-1`} value={form.type} onChange={e => {
                const nextType = e.target.value as 'single' | 'ep' | 'album';
                setForm(prev => ({ ...prev, type: nextType }));
                if (nextType === 'single' && tracks.length > 1) setTracks(items => [{ ...items[0], title: form.title || items[0].title }]);
              }}>
                {releaseTypes.map(rt => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
              </select>
            </label>

            <label className="text-xs font-semibold text-[var(--hbe-muted)]">
              Genre (DistriBeats catalogue) *
              <select className={`${fieldErrors.genre ? errInput : input} mt-1`} value={form.genre} onChange={e => setForm({ ...form, genre: e.target.value, subGenre: form.subGenre || e.target.value })}>
                <option value="">Select genre ({catalogueGenres.length} supported)</option>
                {catalogueGenres.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              {fieldErrors.genre && <span className="mt-1 block text-[11px] text-red-500">{fieldErrors.genre}</span>}
            </label>

            <label className="text-xs font-semibold text-[var(--hbe-muted)]">
              Sub-genre (DistriBeats catalogue) *
              <select className={`${fieldErrors.subGenre ? errInput : input} mt-1`} value={form.subGenre} onChange={e => setForm({ ...form, subGenre: e.target.value })}>
                <option value="">Select sub-genre</option>
                {catalogueGenres.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              {fieldErrors.subGenre && <span className="mt-1 block text-[11px] text-red-500">{fieldErrors.subGenre}</span>}
            </label>

            <label className="text-xs font-semibold text-[var(--hbe-muted)]">
              Language *
              <select className={`${fieldErrors.language ? errInput : input} mt-1`} value={form.language} onChange={e => setForm({ ...form, language: e.target.value })}>
                {catalogueLanguages.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
              {fieldErrors.language && <span className="mt-1 block text-[11px] text-red-500">{fieldErrors.language}</span>}
            </label>

            <label className="text-xs font-semibold text-[var(--hbe-muted)]">
              Release date * <span className="font-normal text-[11px]">(min {earliestReleaseDate})</span>
              <input type="date" min={earliestReleaseDate} className={`${fieldErrors.releaseDate ? errInput : input} mt-1`} value={form.releaseDate} onChange={e => setForm({ ...form, releaseDate: e.target.value })}/>
              {fieldErrors.releaseDate && <span className="mt-1 block text-[11px] text-red-500">{fieldErrors.releaseDate}</span>}
            </label>

            <label className="text-xs font-semibold text-[var(--hbe-muted)]">
              Original release date (optional)
              <input type="date" className={`${input} mt-1`} value={form.originalReleaseDate} onChange={e => setForm({ ...form, originalReleaseDate: e.target.value })}/>
            </label>

            <label className="text-xs font-semibold text-[var(--hbe-muted)]">
              UPC / EAN (optional, 12–14 digits)
              <input className={`${fieldErrors.upc ? errInput : input} mt-1`} value={form.upc} onChange={e => setForm({ ...form, upc: e.target.value })} placeholder="Leave blank for free assignment"/>
              {fieldErrors.upc && <span className="mt-1 block text-[11px] text-red-500">{fieldErrors.upc}</span>}
            </label>

            <label className="text-xs font-semibold text-[var(--hbe-muted)]">
              Copyright owner (© cLine) *
              <input className={`${fieldErrors.copyright ? errInput : input} mt-1`} placeholder="2026 HoodBoy Entertainment" value={form.copyright} onChange={e => setForm({ ...form, copyright: e.target.value })}/>
              {fieldErrors.copyright && <span className="mt-1 block text-[11px] text-red-500">{fieldErrors.copyright}</span>}
            </label>

            <label className="text-xs font-semibold text-[var(--hbe-muted)]">
              Publishing / Master owner (℗ pLine)
              <input className={`${input} mt-1`} placeholder="Defaults to © owner if blank" value={form.publishingCopyright} onChange={e => setForm({ ...form, publishingCopyright: e.target.value })}/>
            </label>

            <label className="text-xs font-semibold text-[var(--hbe-muted)]">
              Catalog number (optional)
              <input className={`${input} mt-1`} value={form.catalogNumber} onChange={e => setForm({ ...form, catalogNumber: e.target.value })} placeholder="e.g. HBE-001"/>
            </label>

            <label className="text-xs font-semibold text-[var(--hbe-muted)]">
              Spotify artist URL (or leave blank for new artist)
              <input className={`${fieldErrors.spotifyArtistUrl ? errInput : input} mt-1`} value={form.spotifyArtistUrl} onChange={e => setForm({ ...form, spotifyArtistUrl: e.target.value })} placeholder="https://open.spotify.com/artist/..."/>
              {fieldErrors.spotifyArtistUrl && <span className="mt-1 block text-[11px] text-red-500">{fieldErrors.spotifyArtistUrl}</span>}
            </label>

            <label className="text-xs font-semibold text-[var(--hbe-muted)]">
              Artwork AI usage
              <select className={`${input} mt-1`} value={form.artworkAiUsage} onChange={e => setForm({ ...form, artworkAiUsage: e.target.value })}>
                <option value="none">None</option><option value="some">Some</option><option value="material">Material</option><option value="all">All</option>
              </select>
            </label>

            <label className="text-xs font-semibold text-[var(--hbe-muted)]">
              AI rights PDF URL {hasAiTrack ? '* (required because a track uses AI)' : '(HTTPS .pdf)'}
              <input className={`${fieldErrors.aiDocumentUrl ? errInput : input} mt-1`} value={form.aiDocumentUrl} onChange={e => setForm({ ...form, aiDocumentUrl: e.target.value })} placeholder="https://.../ai-commercial-rights.pdf"/>
              {fieldErrors.aiDocumentUrl && <span className="mt-1 block text-[11px] text-red-500">{fieldErrors.aiDocumentUrl}</span>}
            </label>

            <div className="md:col-span-2 lg:col-span-3 grid gap-4 md:grid-cols-2">
              <label className="text-xs font-semibold text-[var(--hbe-muted)]">
                Cover artwork * (JPG or PNG, RGB, exactly 3000×3000 px)
                <input type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" className={`${fieldErrors.cover ? errInput : input} mt-1`} onChange={e => handleCoverSelect(e.target.files?.[0])}/>
                {coverPreviewInfo && <span className="mt-1 block text-[11px] text-emerald-500">{coverPreviewInfo}</span>}
                {fieldErrors.cover && <span className="mt-1 block text-[11px] text-red-500">{fieldErrors.cover}</span>}
              </label>
              <div className="flex flex-col justify-center gap-2 pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--hbe-text)]"><input type="checkbox" checked={form.explicit} onChange={e => setForm({ ...form, explicit: e.target.checked })}/> Release contains explicit content</label>
                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--hbe-text)]"><input type="checkbox" checked={form.attestAge} onChange={e => setForm({ ...form, attestAge: e.target.checked })}/> I confirm the artist meets the minimum age requirement *</label>
                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--hbe-text)]"><input type="checkbox" checked={form.attestRights} onChange={e => setForm({ ...form, attestRights: e.target.checked })}/> I confirm all distribution & master/publishing rights are owned or licensed *</label>
                {(fieldErrors['attestations.age'] || fieldErrors['attestations.rights']) && (
                  <span className="text-[11px] text-red-500">{fieldErrors['attestations.age'] || fieldErrors['attestations.rights']}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Stores & Territories */}
        <div className="grid gap-6 lg:grid-cols-2 border-t border-[var(--hbe-divide)] pt-6">
          {/* Searchable Multi-select Stores */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--hbe-muted)]">2. Stores ({form.dspOutletIds.length} selected) *</h3>
                <p className="text-[11px] text-[var(--hbe-muted)]">Provider-controlled from GET /catalogue. {hasAiTrack && <strong className="text-amber-500">YouTube Content ID is disabled when AI is used.</strong>}</p>
              </div>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setForm(prev => ({ ...prev, dspOutletIds: [...generalStores] }))} className="rounded-lg border border-[var(--hbe-line)] px-2.5 py-1 text-[11px] font-semibold text-[var(--hbe-text)]">All General ({generalStores.length})</button>
                <button type="button" onClick={() => setForm(prev => ({ ...prev, dspOutletIds: catalogueStores.filter(s => !(hasAiTrack && s === 'YouTube Content ID')) }))} className="rounded-lg border border-[var(--hbe-line)] px-2.5 py-1 text-[11px] font-semibold text-[var(--hbe-text)]">Select All</button>
                <button type="button" onClick={() => setForm(prev => ({ ...prev, dspOutletIds: [] }))} className="rounded-lg border border-[var(--hbe-line)] px-2.5 py-1 text-[11px] font-semibold text-[var(--hbe-muted)]">Clear</button>
              </div>
            </div>
            <input value={storeSearch} onChange={e => setStoreSearch(e.target.value)} placeholder="Search DistriBeats stores…" className={input}/>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-[var(--hbe-line)] p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {catalogueStores.filter(s => !storeSearch || s.toLowerCase().includes(storeSearch.toLowerCase())).map(store => {
                const disabled = hasAiTrack && store === 'YouTube Content ID';
                const checked = form.dspOutletIds.includes(store);
                return (
                  <label key={store} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-[var(--hbe-fill-soft)]'} ${checked ? 'bg-violet-500/10 font-semibold text-[var(--hbe-text)]' : 'text-[var(--hbe-text-soft)]'}`}>
                    <input type="checkbox" disabled={disabled} checked={checked} onChange={() => toggleStore(store)}/>
                    <span className="truncate" title={store}>{store}</span>
                  </label>
                );
              })}
            </div>
            {fieldErrors.dspOutletIds && <span className="block text-[11px] text-red-500">{fieldErrors.dspOutletIds}</span>}
          </div>

          {/* Worldwide & ISO Territories */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--hbe-muted)]">3. Territories (ISO 3166-1)</h3>
                <p className="text-[11px] text-[var(--hbe-muted)]">{form.worldwide ? `Worldwide distribution (${form.excludedTerritories.length} excluded)` : `Selected territories only (${form.territories.length} included)`}</p>
              </div>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setForm(prev => ({ ...prev, worldwide: true, territories: [] }))} className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${form.worldwide ? 'bg-violet-600 text-white' : 'border border-[var(--hbe-line)] text-[var(--hbe-muted)]'}`}>Worldwide</button>
                <button type="button" onClick={() => setForm(prev => ({ ...prev, worldwide: false, excludedTerritories: [] }))} className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${!form.worldwide ? 'bg-violet-600 text-white' : 'border border-[var(--hbe-line)] text-[var(--hbe-muted)]'}`}>Specific Territories</button>
              </div>
            </div>
            <input value={territorySearch} onChange={e => setTerritorySearch(e.target.value)} placeholder={form.worldwide ? 'Search ISO territories to exclude…' : 'Search ISO territories to include…'} className={input}/>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-[var(--hbe-line)] p-3 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {isoTerritories
                .filter(t => !territorySearch || t.code.toLowerCase().includes(territorySearch.toLowerCase()) || t.name.toLowerCase().includes(territorySearch.toLowerCase()))
                .slice(0, 90)
                .map(t => {
                  const targetKey = form.worldwide ? 'excludedTerritories' : 'territories';
                  const checked = form[targetKey].includes(t.code);
                  return (
                    <label key={t.code} className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs cursor-pointer hover:bg-[var(--hbe-fill-soft)] ${checked ? 'bg-violet-500/10 font-semibold text-[var(--hbe-text)]' : 'text-[var(--hbe-text-soft)]'}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleTerritory(t.code, targetKey)}/>
                      <span className="font-mono text-[11px]">{t.code}</span>
                      <span className="truncate" title={t.name}>{t.name}</span>
                    </label>
                  );
                })}
            </div>
            {(fieldErrors.territories || fieldErrors.excludedTerritories) && (
              <span className="block text-[11px] text-red-500">{fieldErrors.territories || fieldErrors.excludedTerritories}</span>
            )}
          </div>
        </div>

        {/* Section 3: Complete Per-Track Form */}
        <div className="space-y-4 border-t border-[var(--hbe-divide)] pt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--hbe-muted)]">4. Tracks ({tracks.length})</h3>
              <p className="text-[11px] text-[var(--hbe-muted)]">Every track requires full legal names for composers, writers (unless instrumental), producers, mixing & mastering engineers, and at least one performer role.</p>
            </div>
            {form.type !== 'single' && (
              <button type="button" onClick={() => setTracks([...tracks, emptyTrack(selectedArtistName)])} className="rounded-xl bg-violet-600/15 px-3.5 py-2 text-xs font-bold text-violet-400 hover:bg-violet-600/25 flex items-center gap-1">
                <Plus size={14}/> Add Track
              </button>
            )}
          </div>

          {tracks.map((t, i) => {
            const p = `tracks[${i}]`;
            const needsRightsProof = t.compositionType === 'Cover' || t.copyrightType === 'Licensed';
            return (
              <div key={t._id || i} className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-fill-soft)]/40 p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hbe-divide)] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-bold text-white">Track {i + 1}</span>
                    {t.sourceSong && <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">Imported from Catalog</span>}
                    {t.audioFileName && <span className="text-xs text-[var(--hbe-muted)]">Master: <strong className="text-[var(--hbe-text)]">{t.audioFileName}</strong></span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedImportSong && (
                      <button type="button" onClick={() => handleImportFromCatalog(i)} className="rounded-lg border border-[var(--hbe-line)] px-2.5 py-1 text-xs font-semibold text-violet-400 hover:bg-violet-500/10">
                        Import selected song into Track {i + 1}
                      </button>
                    )}
                    {tracks.length > 1 && (
                      <button type="button" onClick={() => setTracks(items => items.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-red-500 hover:bg-red-500/10" title="Remove track"><Trash2 size={15}/></button>
                    )}
                  </div>
                </div>

                {/* Core Track Identity */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-xs font-semibold text-[var(--hbe-muted)]">
                    Track title *
                    <input className={`${fieldErrors[`${p}.title`] ? errInput : input} mt-1`} value={t.title} onChange={e => updateTrack(i, { title: e.target.value })} placeholder={form.type === 'single' ? form.title || 'Matches release title' : 'Track title'}/>
                    {fieldErrors[`${p}.title`] && <span className="mt-1 block text-[11px] text-red-500">{fieldErrors[`${p}.title`]}</span>}
                  </label>
                  <label className="text-xs font-semibold text-[var(--hbe-muted)]">
                    Version
                    <input className={`${input} mt-1`} value={t.version} onChange={e => updateTrack(i, { version: e.target.value })} placeholder="Original, Radio Edit, Live…"/>
                  </label>
                  <label className="text-xs font-semibold text-[var(--hbe-muted)]">
                    ISRC (optional, 12 chars)
                    <input className={`${fieldErrors[`${p}.isrc`] ? errInput : input} mt-1`} value={t.isrc} onChange={e => updateTrack(i, { isrc: e.target.value })} placeholder="USABC2600001"/>
                    {fieldErrors[`${p}.isrc`] && <span className="mt-1 block text-[11px] text-red-500">{fieldErrors[`${p}.isrc`]}</span>}
                  </label>
                  <label className="text-xs font-semibold text-[var(--hbe-muted)]">
                    ISWC (optional)
                    <input className={`${fieldErrors[`${p}.iswc`] ? errInput : input} mt-1`} value={t.iswc} onChange={e => updateTrack(i, { iswc: e.target.value })} placeholder="T-123.456.789-0"/>
                    {fieldErrors[`${p}.iswc`] && <span className="mt-1 block text-[11px] text-red-500">{fieldErrors[`${p}.iswc`]}</span>}
                  </label>
                </div>

                {/* Language, Composition, Recording Rights, AI Usage */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-xs font-semibold text-[var(--hbe-muted)]">
                    Language *
                    <select className={`${fieldErrors[`${p}.language`] ? errInput : input} mt-1`} value={t.language} onChange={e => updateTrack(i, { language: e.target.value })}>
                      {catalogueLanguages.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-[var(--hbe-muted)]">
                    Composition type *
                    <select className={`${input} mt-1`} value={t.compositionType} onChange={e => updateTrack(i, { compositionType: e.target.value as 'Original' | 'Cover', ...(e.target.value === 'Cover' ? { copyrightType: 'Licensed' } : {}) })}>
                      {compositionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-[var(--hbe-muted)]">
                    Recording rights *
                    <select className={`${input} mt-1`} value={t.copyrightType} onChange={e => updateTrack(i, { copyrightType: e.target.value as 'Original' | 'Licensed' })}>
                      {recordingRightsOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-[var(--hbe-muted)]">
                    AI usage *
                    <select className={`${input} mt-1`} value={t.aiUsage} onChange={e => updateTrack(i, { aiUsage: e.target.value as 'None' | 'Partial' | 'Full' })}>
                      {aiOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </label>
                </div>

                {/* Conditional Rights Proof URL */}
                {needsRightsProof && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                    <label className="text-xs font-semibold text-amber-400 block">
                      HTTPS Rights-Proof URL * (required for Cover or Licensed tracks)
                      <input className={`${fieldErrors[`${p}.rightsProofUrl`] ? errInput : input} mt-1`} value={t.rightsProofUrl} onChange={e => updateTrack(i, { rightsProofUrl: e.target.value })} placeholder="https://.../license-or-mechanical-proof.pdf"/>
                      {fieldErrors[`${p}.rightsProofUrl`] && <span className="mt-1 block text-[11px] text-red-500">{fieldErrors[`${p}.rightsProofUrl`]}</span>}
                    </label>
                    {t.suggestedRightsUrls && t.suggestedRightsUrls.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 text-[11px]">
                        <span className="text-[var(--hbe-muted)]">Catalog documents:</span>
                        {t.suggestedRightsUrls.map((doc, dIdx) => (
                          <button key={dIdx} type="button" onClick={() => updateTrack(i, { rightsProofUrl: doc.url })} className="rounded bg-amber-500/20 px-2 py-0.5 font-semibold text-amber-300 hover:bg-amber-500/30">{doc.label}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Credits */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="text-xs font-semibold text-[var(--hbe-muted)]">
                    Composers (full legal names) *
                    <input className={`${fieldErrors[`${p}.composers`] ? errInput : input} mt-1`} value={t.composers} onChange={e => updateTrack(i, { composers: e.target.value })} placeholder="First Last, First Last"/>
                    {fieldErrors[`${p}.composers`] && <span className="mt-1 block text-[11px] text-red-500">{fieldErrors[`${p}.composers`]}</span>}
                  </label>
                  <label className="text-xs font-semibold text-[var(--hbe-muted)]">
                    Writers / Lyricists {t.instrumental ? '(not required for instrumental)' : '(full legal names) *'}
                    <input disabled={t.instrumental} className={`${fieldErrors[`${p}.writers`] ? errInput : input} mt-1 disabled:opacity-50`} value={t.instrumental ? '' : t.writers} onChange={e => updateTrack(i, { writers: e.target.value })} placeholder={t.instrumental ? 'Instrumental track — no lyricists' : 'First Last, First Last'}/>
                    {fieldErrors[`${p}.writers`] && <span className="mt-1 block text-[11px] text-red-500">{fieldErrors[`${p}.writers`]}</span>}
                  </label>
                  <label className="text-xs font-semibold text-[var(--hbe-muted)]">
                    Producers *
                    <input className={`${fieldErrors[`${p}.producers`] ? errInput : input} mt-1`} value={t.producers} onChange={e => updateTrack(i, { producers: e.target.value })} placeholder="Producer legal name(s)"/>
                    {fieldErrors[`${p}.producers`] && <span className="mt-1 block text-[11px] text-red-500">{fieldErrors[`${p}.producers`]}</span>}
                  </label>
                  <label className="text-xs font-semibold text-[var(--hbe-muted)]">
                    Mixing engineers (full legal names) *
                    <input className={`${fieldErrors[`${p}.mixingEngineers`] ? errInput : input} mt-1`} value={t.mixingEngineers} onChange={e => updateTrack(i, { mixingEngineers: e.target.value })} placeholder="Full legal name(s)"/>
                    {fieldErrors[`${p}.mixingEngineers`] && <span className="mt-1 block text-[11px] text-red-500">{fieldErrors[`${p}.mixingEngineers`]}</span>}
                  </label>
                  <label className="text-xs font-semibold text-[var(--hbe-muted)]">
                    Mastering engineers (full legal names) *
                    <input className={`${fieldErrors[`${p}.masteringEngineers`] ? errInput : input} mt-1`} value={t.masteringEngineers} onChange={e => updateTrack(i, { masteringEngineers: e.target.value })} placeholder="Full legal name(s)"/>
                    {fieldErrors[`${p}.masteringEngineers`] && <span className="mt-1 block text-[11px] text-red-500">{fieldErrors[`${p}.masteringEngineers`]}</span>}
                  </label>
                  <label className="text-xs font-semibold text-[var(--hbe-muted)]">
                    Featured artists (optional)
                    <input className={`${input} mt-1`} value={t.featuredArtists} onChange={e => updateTrack(i, { featuredArtists: e.target.value })} placeholder="Comma separated"/>
                  </label>
                </div>

                {/* Performers & Performer Roles (from GET /catalogue performerRoles) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--hbe-muted)]">Performers & Roles (at least 1 DistriBeats performer role required) *</span>
                    <button type="button" onClick={() => updateTrack(i, { performers: [...t.performers, { name: selectedArtistName, role: 'Lead Vocals' }] })} className="text-xs font-bold text-violet-400 hover:underline">+ Add performer</button>
                  </div>
                  <div className="space-y-2">
                    {t.performers.map((pf, pfIdx) => (
                      <div key={pfIdx} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                        <input className={input} placeholder="Performer name" value={pf.name} onChange={e => updateTrack(i, { performers: t.performers.map((item, k) => k === pfIdx ? { ...item, name: e.target.value } : item) })}/>
                        <select className={input} value={pf.role} onChange={e => updateTrack(i, { performers: t.performers.map((item, k) => k === pfIdx ? { ...item, role: e.target.value } : item) })}>
                          {performerRoles.map(role => <option key={role} value={role}>{role}</option>)}
                        </select>
                        <button type="button" disabled={t.performers.length === 1} onClick={() => updateTrack(i, { performers: t.performers.filter((_, k) => k !== pfIdx) })} className="px-2 text-red-500 disabled:opacity-30"><X size={15}/></button>
                      </div>
                    ))}
                  </div>
                  {fieldErrors[`${p}.performers`] && <span className="block text-[11px] text-red-500">{fieldErrors[`${p}.performers`]}</span>}
                </div>

                {/* Audio, Preview Start, Duration & Flags */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
                  <label className="text-xs font-semibold text-[var(--hbe-muted)] sm:col-span-2">
                    Master audio file (WAV or FLAC only, up to {(maxAudioBytes / 1_000_000).toFixed(0)} MB) *
                    <input type="file" accept=".wav,.flac,audio/wav,audio/x-wav,audio/flac,audio/x-flac" className={`${fieldErrors[`${p}.audio`] ? errInput : input} mt-1`} onChange={e => handleAudioSelect(i, e.target.files?.[0])}/>
                    {t.audioUrl && !t.audio && <span className="mt-1 block text-[11px] text-emerald-500">Saved audio preserved: {t.audioFileName || t.audioUrl}</span>}
                    {fieldErrors[`${p}.audio`] && <span className="mt-1 block text-[11px] text-red-500">{fieldErrors[`${p}.audio`]}</span>}
                  </label>
                  <label className="text-xs font-semibold text-[var(--hbe-muted)]">
                    Preview start (m:ss, optional)
                    <input className={`${fieldErrors[`${p}.previewStart`] ? errInput : input} mt-1`} value={t.previewStart} onChange={e => updateTrack(i, { previewStart: e.target.value })} placeholder="0:45"/>
                    {fieldErrors[`${p}.previewStart`] && <span className="mt-1 block text-[11px] text-red-500">{fieldErrors[`${p}.previewStart`]}</span>}
                  </label>
                  <label className="text-xs font-semibold text-[var(--hbe-muted)]">
                    Duration (seconds, optional)
                    <input type="number" min={0} className={`${input} mt-1`} value={t.durationSeconds || ''} onChange={e => updateTrack(i, { durationSeconds: Math.max(0, Number(e.target.value) || 0) })} placeholder="e.g. 198"/>
                  </label>
                </div>

                <div className="flex flex-wrap gap-6 pt-1">
                  <label className="flex items-center gap-2 text-xs font-semibold text-[var(--hbe-text)]">
                    <input type="checkbox" checked={t.explicit} onChange={e => updateTrack(i, { explicit: e.target.checked })}/> Explicit lyrics
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-[var(--hbe-text)]">
                    <input type="checkbox" checked={t.instrumental} onChange={e => updateTrack(i, { instrumental: e.target.checked })}/> Instrumental (no vocals / writers not required)
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-3 border-t border-[var(--hbe-divide)] pt-5">
          {editing && <button type="button" onClick={() => { reset(); setTab('catalog'); }} className="rounded-xl border border-[var(--hbe-line)] px-5 py-3 text-sm font-semibold text-[var(--hbe-muted)]">Discard Changes</button>}
          <button type="button" disabled={saving} onClick={saveRelease} className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-50 flex items-center gap-2">
            <Upload size={16}/>{saving ? 'Validating & Saving…' : editing ? 'Update Release Draft' : 'Save Release Draft'}
          </button>
        </div>
      </div>
    )}

    {tab === 'royalties' && <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5"><p className="text-xs text-[var(--hbe-muted)]">Total Revenue</p><p className="mt-2 text-2xl font-bold text-[var(--hbe-text)]">{formatCurrency(royalties?.totalRevenue||0)}</p></div><div className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5"><p className="text-xs text-[var(--hbe-muted)]">Artist Earnings</p><p className="mt-2 text-2xl font-bold text-emerald-500">{formatCurrency(royalties?.artistEarnings||0)}</p></div><div className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5"><p className="text-xs text-[var(--hbe-muted)]">Statements</p><p className="mt-2 text-2xl font-bold text-[var(--hbe-text)]">{royalties?.entries?.length||0}</p></div></div><div className="flex justify-between gap-4"><div><h2 className="font-bold text-[var(--hbe-text)]">Royalty history</h2><p className="text-xs text-[var(--hbe-muted)]">Internal royalty ledger. Import approved statements into the ledger before reconciliation.</p></div><button onClick={download} className="shrink-0 rounded-xl border border-[var(--hbe-line)] px-4 py-2 text-sm font-semibold text-[var(--hbe-text)] flex items-center gap-2"><Download size={15}/> CSV</button></div><div className="grid gap-4 lg:grid-cols-3">{[['Platform / source',royalties?.byPlatform],['Release',royalties?.byRelease],['Track',royalties?.byTrack]].map(([label,data]:any)=><div key={label} className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5"><h3 className="mb-4 text-sm font-bold text-[var(--hbe-text)] flex items-center gap-2"><BarChart3 size={15}/>{label}</h3><div className="space-y-3">{Object.entries(data||{}).map(([name,value]:any)=><div key={name} className="flex justify-between text-sm"><span className="capitalize text-[var(--hbe-muted)]">{name.replace(/_/g,' ')}</span><strong className="text-[var(--hbe-text)]">{formatCurrency(value)}</strong></div>)}{Object.keys(data||{}).length===0&&<p className="text-xs text-[var(--hbe-muted)]">No reporting data yet</p>}</div></div>)}</div></div>}

    {tab === 'provider' && user?.role === 'admin' && <div className="space-y-4 rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5"><div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-bold text-[var(--hbe-text)]">DistriBeats provider catalogue</h2><p className="text-xs text-[var(--hbe-muted)]">Live API view for reconciling remote releases with local records.</p></div><button onClick={loadRemoteReleases} disabled={remoteLoading} className="rounded-xl border border-[var(--hbe-line)] px-3 py-2 text-xs font-semibold text-[var(--hbe-text)] disabled:opacity-50"><RefreshCw size={13} className={`mr-1 inline ${remoteLoading ? 'animate-spin' : ''}`}/>Refresh</button></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-[var(--hbe-divide)] text-xs uppercase text-[var(--hbe-muted)]"><tr><th className="pb-3">Release</th><th className="pb-3">Provider ID</th><th className="pb-3">UPC</th><th className="pb-3">Status</th><th className="pb-3">Local record</th></tr></thead><tbody className="divide-y divide-[var(--hbe-divide)]">{remoteReleases.map(remote => { const remoteId = String(remote.id || remote.release_id || ''); const local = releases.find(item => item.distribeatsReleaseId === remoteId || item.providerReleaseId === remoteId); return <tr key={remoteId || remote.title}><td className="py-3 font-semibold text-[var(--hbe-text)]">{remote.title || remote.name || 'Untitled release'}</td><td className="py-3 font-mono text-xs text-[var(--hbe-muted)]">{remoteId || '—'}</td><td className="py-3 text-[var(--hbe-text-soft)]">{remote.upc || '—'}</td><td className="py-3 capitalize text-[var(--hbe-text-soft)]">{String(remote.status || 'unknown').replaceAll('_', ' ')}</td><td className="py-3">{local ? <Link to={`/distribution/${local._id}`} className="font-semibold text-violet-500">Open local release</Link> : <span className="text-xs font-semibold text-amber-500">Not linked locally</span>}</td></tr>})}</tbody></table>{!remoteLoading && remoteReleases.length === 0 && <p className="py-10 text-center text-sm text-[var(--hbe-muted)]">No remote releases returned by DistriBeats.</p>}</div></div>}

    {tab === 'webhooks' && user?.role === 'admin' && <div className="space-y-4 rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5"><div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-bold text-[var(--hbe-text)]">DistriBeats webhook history</h2><p className="text-xs text-[var(--hbe-muted)]">Persistent delivery audit · {webhookTotal} event{webhookTotal === 1 ? '' : 's'}</p></div><button onClick={loadWebhookEvents} disabled={webhooksLoading} className="rounded-xl border border-[var(--hbe-line)] px-3 py-2 text-xs font-semibold text-[var(--hbe-text)] disabled:opacity-50"><RefreshCw size={13} className={`mr-1 inline ${webhooksLoading ? 'animate-spin' : ''}`}/>Refresh</button></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-[var(--hbe-divide)] text-xs uppercase text-[var(--hbe-muted)]"><tr><th className="pb-3">Received</th><th className="pb-3">Event</th><th className="pb-3">Release</th><th className="pb-3">Remote status</th><th className="pb-3">Result</th><th className="pb-3">Delivery ID</th></tr></thead><tbody className="divide-y divide-[var(--hbe-divide)]">{webhookEvents.map(item => <tr key={item._id}><td className="py-3 text-xs text-[var(--hbe-muted)]">{new Date(item.receivedAt || item.createdAt).toLocaleString()}</td><td className="py-3 font-semibold text-[var(--hbe-text)]">{item.event}</td><td className="py-3 text-[var(--hbe-text-soft)]">{item.releaseTitle || item.remoteReleaseId || '—'}</td><td className="py-3 capitalize text-[var(--hbe-muted)]">{item.remoteStatus || '—'}</td><td className="py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold capitalize ${item.status === 'processed' ? 'bg-emerald-500/10 text-emerald-500' : item.status === 'duplicate' ? 'bg-sky-500/10 text-sky-500' : 'bg-amber-500/10 text-amber-500'}`}>{item.status}</span></td><td className="py-3 font-mono text-xs text-[var(--hbe-muted)]">{item.deliveryId || '—'}</td></tr>)}</tbody></table>{!webhooksLoading && webhookEvents.length === 0 && <p className="py-10 text-center text-sm text-[var(--hbe-muted)]">No verified webhook deliveries have been received yet.</p>}</div></div>}

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
                    <button onClick={async () => { await distributionApi.updateQc(r._id, { qcStatus: 'ready_for_distribution', rightsStatus: 'approved' }); load(); toast.success('Approved'); }} className="rounded bg-emerald-500/20 text-emerald-500 px-3 py-1 text-xs font-bold hover:bg-emerald-500/30">Approve</button>
                    <button onClick={async () => { await distributionApi.updateQc(r._id, { qcStatus: 'qc_failed', rightsStatus: 'rejected' }); load(); toast.error('Rejected'); }} className="rounded bg-red-500/20 text-red-500 px-3 py-1 text-xs font-bold hover:bg-red-500/30">Reject</button>
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
