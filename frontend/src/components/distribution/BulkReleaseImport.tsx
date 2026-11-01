import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, FolderOpen, LoaderCircle, RefreshCw, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { distributionApi } from '../../services/api';
import type { Artist } from '../../types';
import { buildBulkTemplate, buildDistroKidTransferTemplate, bulkBoolean, ensureCover3000x3000, parseBulkCsv, parseBulkPerformers, splitBulkList, type BulkCsvRow } from '../../utils/bulkReleaseImport';

type ResultState = { status: 'waiting' | 'creating' | 'created' | 'failed'; id?: string; message?: string; duplicate?: boolean };
type ReleaseGroup = { key: string; rows: BulkCsvRow[]; first: BulkCsvRow; errors: string[]; artistId: string; cover?: File; audio: Array<File | undefined> };

type Props = {
  artists: Artist[];
  references: any;
  isArtistUser: boolean;
  onCreated: () => Promise<void> | void;
};

const input = 'w-full rounded-xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] px-3 py-2 text-sm text-[var(--hbe-text)] outline-none focus:border-violet-500';
const normalized = (value: unknown) => String(value || '').trim().toLowerCase();
const validIsrc = (value: string) => /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(value.replace(/[\s-]/g, '').toUpperCase());
const validUpc = (value: string) => /^\d{12,14}$/.test(value.replace(/[\s-]/g, ''));
const validHttps = (value: string) => /^https:\/\/\S+$/i.test(value);
const splitNames = (value = '') => splitBulkList(value);

const artistLabel = (artist: Artist) => artist.artistName || artist.stageName || artist.name || artist.email || artist._id;

const BulkReleaseImport: React.FC<Props> = ({ artists, references, isArtistUser, onCreated }) => {
  const [csvFile, setCsvFile] = useState<File>();
  const [rows, setRows] = useState<BulkCsvRow[]>([]);
  const [csvError, setCsvError] = useState('');
  const [assets, setAssets] = useState<File[]>([]);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [transferConfirmed, setTransferConfirmed] = useState(false);
  const [working, setWorking] = useState(false);
  const [results, setResults] = useState<Record<string, ResultState>>({});

  const earliestDate = references?.policy?.earliestReleaseDate || '';
  const genres = useMemo(() => new Set((references?.genres || []).map((item: any) => normalized(typeof item === 'string' ? item : item.name || item.value))), [references]);
  const stores = useMemo(() => new Set((references?.stores || []).map((item: any) => normalized(typeof item === 'string' ? item : item.name || item.value))), [references]);
  const performerRoles = useMemo(() => new Set((references?.performerRoles || []).map((item: any) => normalized(item))), [references]);

  const fileMap = useMemo(() => {
    const map = new Map<string, File>();
    const duplicates = new Set<string>();
    assets.forEach(file => {
      const key = normalized(file.name);
      if (map.has(key)) duplicates.add(key);
      else map.set(key, file);
    });
    return { map, duplicates };
  }, [assets]);

  const resolveArtist = (value: string) => {
    if (isArtistUser) return '';
    const query = normalized(value);
    if (!query) return '';
    const matches = artists.filter(artist => [artist._id, artist.artistName, artist.stageName, artist.name, artist.email].some(candidate => normalized(candidate) === query));
    return matches.length === 1 ? matches[0]._id : '';
  };

  const groups = useMemo<ReleaseGroup[]>(() => {
    const grouped = new Map<string, BulkCsvRow[]>();
    rows.forEach(row => {
      const key = row.release_key.trim();
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    });
    return [...grouped.entries()].map(([key, rawRows]) => {
      const sorted = [...rawRows].sort((a, b) => Number(a.track_number) - Number(b.track_number));
      const first = sorted[0];
      const errors: string[] = [];
      const mode = normalized(first.mode) === 'catalog_transfer' || normalized(first.mode) === 'transfer' ? 'catalog_transfer' : 'new_release';
      const requiredReleaseFields = ['release_title', 'release_type', 'genre', 'sub_genre', 'language', 'delivery_date', 'copyright', 'cover_file'];
      if (!key) errors.push(`Line ${first.__line}: release_key is required.`);
      requiredReleaseFields.forEach(field => { if (!first[field]) errors.push(`${key || `Line ${first.__line}`}: ${field} is required.`); });
      const consistencyFields = ['mode', 'release_title', 'artist', 'release_type', 'genre', 'sub_genre', 'language', 'delivery_date', 'original_release_date', 'upc', 'copyright', 'publishing_copyright', 'source_distributor', 'source_release_url', 'spotify_artist_url', 'ai_document_url', 'artwork_ai_usage', 'stores', 'territories', 'cover_file'];
      consistencyFields.forEach(field => {
        if (sorted.some(row => normalized(row[field]) !== normalized(first[field]))) errors.push(`${key}: ${field} must be identical on every track row for the release.`);
      });
      const artistId = resolveArtist(first.artist);
      if (!isArtistUser && !artistId) errors.push(`${key}: artist must uniquely match an Artist ID, artist name, stage name, or email in this workspace.`);
      if (!['single', 'ep', 'album'].includes(normalized(first.release_type))) errors.push(`${key}: release_type must be single, ep, or album.`);
      if (genres.size && first.genre && !genres.has(normalized(first.genre))) errors.push(`${key}: genre "${first.genre}" is not in the live DistriBeats catalogue.`);
      if (genres.size && first.sub_genre && !genres.has(normalized(first.sub_genre))) errors.push(`${key}: sub_genre "${first.sub_genre}" is not in the live DistriBeats catalogue.`);
      if (earliestDate && first.delivery_date < earliestDate) errors.push(`${key}: delivery_date must be ${earliestDate} or later.`);
      const requestedStores = splitBulkList(first.stores || 'Spotify');
      if (!requestedStores.length) errors.push(`${key}: select at least one store.`);
      requestedStores.forEach(store => { if (stores.size && !stores.has(normalized(store))) errors.push(`${key}: store "${store}" is not supported by DistriBeats.`); });
      const hasAi = sorted.some(row => ['partial', 'full'].includes(normalized(row.ai_usage)));
      if (hasAi && !/^https:\/\/.*\.pdf(?:\?|$)/i.test(first.ai_document_url)) errors.push(`${key}: ai_document_url must be an HTTPS PDF when any track uses Partial or Full AI.`);
      if (hasAi && requestedStores.some(store => normalized(store) === 'youtube content id')) errors.push(`${key}: YouTube Content ID cannot be selected when a track uses AI.`);
      if (mode === 'catalog_transfer') {
        if (!first.source_distributor) errors.push(`${key}: source_distributor is required for a transfer.`);
        if (!validHttps(first.source_release_url)) errors.push(`${key}: source_release_url must be an HTTPS URL.`);
        if (!first.original_release_date) errors.push(`${key}: original_release_date is required for a transfer.`);
        else if (first.original_release_date > new Date().toISOString().slice(0, 10)) errors.push(`${key}: original_release_date cannot be in the future.`);
        if (!validUpc(first.upc)) errors.push(`${key}: transfer UPC must contain 12–14 digits.`);
      } else if (first.upc && !validUpc(first.upc)) errors.push(`${key}: UPC must contain 12–14 digits.`);
      if (normalized(first.release_type) === 'single' && sorted.length !== 1) errors.push(`${key}: a single must contain exactly one track row.`);
      if (normalized(first.release_type) === 'single' && sorted[0]?.track_title !== first.release_title) errors.push(`${key}: a single's track_title must exactly match release_title.`);
      const trackNumbers = sorted.map(row => Number(row.track_number));
      if (trackNumbers.some(number => !Number.isInteger(number) || number < 1)) errors.push(`${key}: every track_number must be a positive whole number.`);
      if (new Set(trackNumbers).size !== trackNumbers.length) errors.push(`${key}: track_number values must be unique.`);

      sorted.forEach((row, index) => {
        const label = `${key} track ${index + 1}`;
        for (const field of ['track_title', 'composers', 'producers', 'mixing_engineers', 'mastering_engineers', 'performers', 'audio_file']) {
          if (!row[field]) errors.push(`${label}: ${field} is required.`);
        }
        if (!bulkBoolean(row.instrumental) && !row.writers) errors.push(`${label}: writers are required unless instrumental is true.`);
        if (mode === 'catalog_transfer' && !validIsrc(row.isrc)) errors.push(`${label}: original 12-character ISRC is required.`);
        else if (row.isrc && !validIsrc(row.isrc)) errors.push(`${label}: ISRC format is invalid.`);
        const performers = parseBulkPerformers(row.performers);
        performers.forEach(performer => {
          if (!performer.name || !performer.role) errors.push(`${label}: performers must use Name::Role format.`);
          else if (performerRoles.size && !performerRoles.has(normalized(performer.role))) errors.push(`${label}: performer role "${performer.role}" is not supported.`);
        });
        if ((normalized(row.composition_type) === 'cover' || normalized(row.copyright_type) === 'licensed') && !validHttps(row.rights_proof_url)) errors.push(`${label}: HTTPS rights_proof_url is required for cover or licensed tracks.`);
      });

      const cover = fileMap.map.get(normalized(first.cover_file));
      if (!cover) errors.push(`${key}: cover file "${first.cover_file}" was not selected.`);
      else if (!/\.(?:jpe?g|png)$/i.test(cover.name)) errors.push(`${key}: cover artwork must be JPG or PNG.`);
      if (fileMap.duplicates.has(normalized(first.cover_file))) errors.push(`${key}: more than one selected file is named "${first.cover_file}".`);
      const audio = sorted.map((row, index) => {
        const file = fileMap.map.get(normalized(row.audio_file));
        if (!file) errors.push(`${key} track ${index + 1}: audio file "${row.audio_file}" was not selected.`);
        else if (!/\.(?:wav|flac)$/i.test(file.name)) errors.push(`${key} track ${index + 1}: master audio must be WAV or FLAC.`);
        if (fileMap.duplicates.has(normalized(row.audio_file))) errors.push(`${key} track ${index + 1}: duplicate selected filename "${row.audio_file}".`);
        return file;
      });
      return { key, rows: sorted, first, errors: [...new Set(errors)], artistId, cover, audio };
    });
  }, [rows, fileMap, artists, isArtistUser, genres, stores, performerRoles, earliestDate]);

  const allErrors = groups.flatMap(group => group.errors);
  const transferCount = groups.filter(group => ['transfer', 'catalog_transfer'].includes(normalized(group.first.mode))).length;
  const validCount = groups.filter(group => group.errors.length === 0).length;

  const loadCsv = async (file?: File) => {
    setCsvFile(file);
    setRows([]);
    setResults({});
    setCsvError('');
    if (!file) return;
    try {
      const parsed = parseBulkCsv(await file.text());
      if (parsed.length > 500) throw new Error('A batch may contain at most 500 track rows. Split larger catalogues into multiple batches.');
      const releases = new Set(parsed.map(row => row.release_key));
      if (releases.size > 100) throw new Error('A batch may contain at most 100 releases. Split larger catalogues into multiple batches.');
      setRows(parsed);
    } catch (error: any) {
      setCsvError(error.message || 'Could not read CSV.');
    }
  };

  const downloadTemplate = (distrokidOnly = false) => {
    const exampleArtist = isArtistUser ? '' : artists[0]?._id || '';
    const csvContent = distrokidOnly ? buildDistroKidTransferTemplate(exampleArtist) : buildBulkTemplate(exampleArtist);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = distrokidOnly ? 'hbe-distrokid-transfer-template.csv' : 'hbe-bulk-distribution-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const buildFormData = async (group: ReleaseGroup) => {
    const row = group.first;
    const mode = ['transfer', 'catalog_transfer'].includes(normalized(row.mode)) ? 'catalog_transfer' : 'new_release';
    const data = new FormData();
    const add = (key: string, value: unknown) => data.append(key, String(value ?? ''));
    add('title', row.release_title);
    if (group.artistId) add('artist', group.artistId);
    add('type', normalized(row.release_type));
    add('genre', row.genre);
    add('subGenre', row.sub_genre);
    add('language', row.language || 'English');
    add('releaseDate', row.delivery_date);
    if (row.original_release_date) add('originalReleaseDate', row.original_release_date);
    add('distributionMode', mode);
    add('sourceDistributor', row.source_distributor);
    add('sourceReleaseUrl', row.source_release_url);
    add('transferAcknowledged', mode === 'catalog_transfer' && transferConfirmed);
    add('upc', row.upc.replace(/\D/g, ''));
    add('copyright', row.copyright);
    add('publishingCopyright', row.publishing_copyright);
    add('catalogNumber', row.catalog_number);
    add('spotifyArtistUrl', row.spotify_artist_url);
    add('aiDocumentUrl', row.ai_document_url);
    add('worldwide', normalized(row.territories || 'WORLDWIDE') === 'worldwide');
    add('territories', JSON.stringify(normalized(row.territories || 'WORLDWIDE') === 'worldwide' ? ['WORLDWIDE'] : splitBulkList(row.territories).map(item => item.toUpperCase())));
    add('excludedTerritories', '[]');
    add('dspOutletIds', JSON.stringify(splitBulkList(row.stores || 'Spotify')));
    add('attestations', JSON.stringify({ age: ageConfirmed, rights: rightsConfirmed }));
    add('artworkAiUsage', ['some', 'material', 'all'].includes(normalized(row.artwork_ai_usage)) ? normalized(row.artwork_ai_usage) : 'none');
    add('explicit', group.rows.some(track => bulkBoolean(track.explicit)));
    add('bulkReleaseKey', group.key);
    add('bulkImportKey', `bulk-${csvFile?.name || 'manifest'}-${csvFile?.lastModified || 0}-${group.key}`.replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 180));
    if (group.cover) {
      const adjustedCover = await ensureCover3000x3000(group.cover);
      data.append('cover', adjustedCover);
    }
    const tracks = group.rows.map((track, index) => ({
      title: track.track_title,
      version: track.version || 'Original',
      isrc: track.isrc.replace(/[\s-]/g, '').toUpperCase(),
      explicit: bulkBoolean(track.explicit),
      instrumental: bulkBoolean(track.instrumental),
      language: track.language || row.language || 'English',
      genre: row.genre,
      copyright: row.copyright,
      compositionType: normalized(track.composition_type) === 'cover' ? 'Cover' : 'Original',
      copyrightType: normalized(track.copyright_type) === 'licensed' ? 'Licensed' : 'Original',
      rightsProofUrl: track.rights_proof_url,
      aiUsage: normalized(track.ai_usage) === 'full' ? 'Full' : normalized(track.ai_usage) === 'partial' ? 'Partial' : 'None',
      writers: bulkBoolean(track.instrumental) ? [] : splitNames(track.writers),
      composers: splitNames(track.composers),
      producers: splitNames(track.producers),
      mixingEngineers: splitNames(track.mixing_engineers),
      masteringEngineers: splitNames(track.mastering_engineers),
      featuredArtists: splitNames(track.featured_artists),
      performers: parseBulkPerformers(track.performers),
      trackNumber: Number(track.track_number) || index + 1,
    }));
    add('tracks', JSON.stringify(tracks));
    group.audio.forEach((file, index) => { if (file) data.append(`audio_${index}`, file); });
    return data;
  };

  const createDrafts = async (retryFailedOnly = false) => {
    if (!groups.length || allErrors.length) return toast.error('Resolve every preflight issue before creating drafts.');
    if (!ageConfirmed || !rightsConfirmed || (transferCount > 0 && !transferConfirmed)) return toast.error('Accept all required batch confirmations first.');
    setWorking(true);
    let created = 0;
    let failed = 0;
    try {
      for (const group of groups) {
        const previous = results[group.key];
        if (previous?.status === 'created' || (retryFailedOnly && previous?.status !== 'failed')) continue;
        setResults(current => ({ ...current, [group.key]: { status: 'creating' } }));
        try {
          const formData = await buildFormData(group);
          const response = await distributionApi.create(formData);
          const release = response.data.data;
          setResults(current => ({ ...current, [group.key]: { status: 'created', id: release._id, duplicate: Boolean(response.data.duplicate), message: response.data.duplicate ? 'Existing draft reused safely.' : 'Draft created and queued for QC.' } }));
          created += 1;
        } catch (error: any) {
          const details = error.response?.data?.errors;
          const message = Array.isArray(details) ? details.map((item: any) => item.message || item).join('; ') : error.response?.data?.message || error.message || 'Draft creation failed.';
          setResults(current => ({ ...current, [group.key]: { status: 'failed', message } }));
          failed += 1;
        }
      }
      await onCreated();
      if (failed) toast.error(`${failed} release${failed === 1 ? '' : 's'} failed. ${created} created successfully.`);
      else toast.success(`${created} release draft${created === 1 ? '' : 's'} created and queued for QC.`);
    } finally { setWorking(false); }
  };

  const failedCount = Object.values(results).filter(result => result.status === 'failed').length;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--hbe-line)] bg-[var(--hbe-surface)] p-5 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div><h2 className="flex items-center gap-2 text-xl font-bold text-[var(--hbe-text)]"><FileSpreadsheet size={21} className="text-violet-500"/>Bulk Releases & Catalogue Transfers</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--hbe-muted)]">Create up to 100 independent release drafts from one manifest. Each release is uploaded separately, cover artwork is auto-adjusted to 3000×3000 px RGB, and each draft receives its own validation result and provider ID.</p></div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button type="button" onClick={() => downloadTemplate(true)} className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 text-sm font-bold text-sky-500"><Download size={15} className="mr-2 inline"/>DistroKid Transfer CSV Template</button>
            <button type="button" onClick={() => downloadTemplate(false)} className="rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-2.5 text-sm font-bold text-violet-500"><Download size={15} className="mr-2 inline"/>General CSV Template</button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {[
            ['1', 'Prepare CSV', 'Use one row per track. Tracks sharing release_key become one release.'],
            ['2', 'Select assets', 'Select every exact cover_file and audio_file named in the CSV.'],
            ['3', 'Resolve preflight', 'Correct every highlighted metadata, identifier, store and file issue.'],
            ['4', 'Create drafts', 'Drafts enter QC individually. Submit only after each release passes review.'],
          ].map(([number, title, copy]) => <div key={number} className="rounded-xl border border-[var(--hbe-line)] bg-[var(--hbe-fill-soft)] p-4"><span className="grid h-7 w-7 place-items-center rounded-full bg-violet-600 text-xs font-bold text-white">{number}</span><h3 className="mt-3 text-sm font-bold text-[var(--hbe-text)]">{title}</h3><p className="mt-1 text-xs leading-5 text-[var(--hbe-muted)]">{copy}</p></div>)}
        </div>

        <div className="mt-5 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 text-xs leading-5 text-[var(--hbe-muted)]">
          <strong className="text-[var(--hbe-text)]">CSV rules:</strong> use <code>new_release</code> or <code>catalog_transfer</code> in <code>mode</code>; repeat the same <code>release_key</code> for every track on an EP/album; identify the artist by workspace Artist ID, exact name, or email; separate multiple names/stores/territories with <code>|</code>; format performers as <code>Legal Name::Lead Vocals|Second Name::Guitar</code>; and make every <code>cover_file</code>/<code>audio_file</code> exactly match a selected filename. Replace all example values from the template before importing.
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <label className="rounded-2xl border border-dashed border-[var(--hbe-line)] p-5 text-sm font-semibold text-[var(--hbe-text)]"><FileSpreadsheet size={20} className="mb-2 text-emerald-500"/>CSV manifest *<input type="file" accept=".csv,text/csv" className={`${input} mt-3`} onChange={event => loadCsv(event.target.files?.[0])}/>{csvFile && <span className="mt-2 block text-xs text-emerald-500">{csvFile.name} · {rows.length} track row{rows.length === 1 ? '' : 's'}</span>}{csvError && <span className="mt-2 block text-xs text-red-500">{csvError}</span>}</label>
          <label className="rounded-2xl border border-dashed border-[var(--hbe-line)] p-5 text-sm font-semibold text-[var(--hbe-text)]"><FolderOpen size={20} className="mb-2 text-sky-500"/>Artwork and master files *<input type="file" multiple accept=".jpg,.jpeg,.png,.wav,.flac,image/jpeg,image/png,audio/wav,audio/flac" className={`${input} mt-3`} onChange={event => setAssets(Array.from(event.target.files || []))}/><span className="mt-2 block text-xs text-[var(--hbe-muted)]">{assets.length ? `${assets.length} file${assets.length === 1 ? '' : 's'} selected` : 'Select all files in one file-picker action. Exact filenames are matched case-insensitively.'}</span></label>
        </div>

        {groups.length > 0 && <div className="mt-6 grid gap-3 sm:grid-cols-4">{[['Releases', groups.length], ['Tracks', rows.length], ['Transfers', transferCount], ['Ready', validCount]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-[var(--hbe-line)] p-4"><p className="text-xs text-[var(--hbe-muted)]">{label}</p><p className="mt-1 text-2xl font-bold text-[var(--hbe-text)]">{value}</p></div>)}</div>}

        {allErrors.length > 0 && <div className="mt-6 max-h-64 overflow-y-auto rounded-xl border border-red-500/40 bg-red-500/10 p-4"><h3 className="flex items-center gap-2 font-bold text-red-500"><AlertTriangle size={16}/>{allErrors.length} preflight issue{allErrors.length === 1 ? '' : 's'}</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-red-400">{allErrors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul></div>}

        {groups.length > 0 && <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--hbe-line)]"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-[var(--hbe-fill-soft)] text-xs uppercase text-[var(--hbe-muted)]"><tr><th className="p-3">Release key</th><th>Title</th><th>Mode</th><th>Tracks</th><th>Preflight</th><th>Creation result</th></tr></thead><tbody className="divide-y divide-[var(--hbe-divide)]">{groups.map(group => { const result = results[group.key]; return <tr key={group.key}><td className="p-3 font-mono text-xs text-[var(--hbe-text)]">{group.key}</td><td className="font-semibold text-[var(--hbe-text)]">{group.first.release_title}</td><td className="capitalize text-[var(--hbe-muted)]">{['transfer', 'catalog_transfer'].includes(normalized(group.first.mode)) ? 'Catalogue transfer' : 'New release'}</td><td>{group.rows.length}</td><td>{group.errors.length ? <span className="font-bold text-red-500">{group.errors.length} issue(s)</span> : <span className="inline-flex items-center gap-1 font-bold text-emerald-500"><CheckCircle2 size={13}/>Ready</span>}</td><td>{!result ? <span className="text-[var(--hbe-muted)]">Waiting</span> : result.status === 'creating' ? <span className="inline-flex items-center gap-1 text-violet-500"><LoaderCircle size={13} className="animate-spin"/>Creating</span> : result.status === 'created' ? <a href={`/distribution/${result.id}`} className="font-bold text-emerald-500 underline">{result.duplicate ? 'Existing draft' : 'Draft created'}</a> : <span className="max-w-xs text-xs text-red-500" title={result.message}>{result.message}</span>}</td></tr>; })}</tbody></table></div>}

        <div className="mt-6 space-y-3 rounded-xl border border-[var(--hbe-line)] bg-[var(--hbe-fill-soft)] p-4">
          <label className="flex items-start gap-2 text-xs font-semibold text-[var(--hbe-text)]"><input type="checkbox" className="mt-0.5" checked={ageConfirmed} onChange={event => setAgeConfirmed(event.target.checked)}/><span>I confirm every artist in this batch meets the minimum age requirement.</span></label>
          <label className="flex items-start gap-2 text-xs font-semibold text-[var(--hbe-text)]"><input type="checkbox" className="mt-0.5" checked={rightsConfirmed} onChange={event => setRightsConfirmed(event.target.checked)}/><span>I confirm the label owns or has licensed all master, publishing and distribution rights in this batch.</span></label>
          {transferCount > 0 && <label className="flex items-start gap-2 text-xs font-semibold text-[var(--hbe-text)]"><input type="checkbox" className="mt-0.5" checked={transferConfirmed} onChange={event => setTransferConfirmed(event.target.checked)}/><span>I will keep every source-distributor release live until its transferred replacement is live in all selected stores.</span></label>}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">{failedCount > 0 && <button type="button" disabled={working} onClick={() => createDrafts(true)} className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-3 text-sm font-bold text-amber-500 disabled:opacity-50"><RefreshCw size={15} className="mr-2 inline"/>Retry {failedCount} Failed</button>}<button type="button" disabled={working || !groups.length || Boolean(allErrors.length) || !ageConfirmed || !rightsConfirmed || (transferCount > 0 && !transferConfirmed)} onClick={() => createDrafts(false)} className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><Upload size={16} className="mr-2 inline"/>{working ? 'Creating Drafts…' : `Create ${validCount} Draft${validCount === 1 ? '' : 's'}`}</button></div>
      </div>

      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-500"><strong>Important:</strong> Bulk import creates independent drafts; it does not bypass Content/QC review or submit incomplete releases to DistriBeats. After QC marks each draft ready, submit it from the catalogue. DistriBeats processes every release separately and does not provide a one-request bulk endpoint.</div>
    </div>
  );
};

export default BulkReleaseImport;
