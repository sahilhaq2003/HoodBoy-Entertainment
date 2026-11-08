import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Armchair, CalendarDays, Camera, CheckCircle2, Keyboard, MapPin, QrCode, RefreshCw, ShieldCheck, TicketCheck, UserCheck, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { linkupPlatformApi } from '../../services/api';
import { formatEventSchedule } from '../../utils/eventTime';

type EntryDetails = Record<string, any>;

const words = (value = '') => String(value).replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase());

const LinkupCheckInPanel: React.FC = () => {
  const scannerRef = useRef<any>(null);
  const detailsRef = useRef<HTMLElement>(null);
  const scanLocked = useRef(false);
  const latestDecoded = useRef<{ value: string; at: number }|null>(null);
  const captureRequested = useRef(false);
  const captureTimeout = useRef<number|null>(null);
  const [scanning, setScanning] = useState(false);
  const [capturePending, setCapturePending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState('');
  const [details, setDetails] = useState<EntryDetails|null>(null);
  const [error, setError] = useState('');

  const revealDetails = () => {
    window.setTimeout(() => {
      detailsRef.current?.focus({ preventScroll: true });
      detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const clearCaptureRequest = () => {
    captureRequested.current = false;
    setCapturePending(false);
    if (captureTimeout.current !== null) window.clearTimeout(captureTimeout.current);
    captureTimeout.current = null;
  };

  const stopScanner = async () => {
    clearCaptureRequest();
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try { if (scanner.isScanning) await scanner.stop(); } catch { /* Camera may already be stopped. */ }
      try { scanner.clear(); } catch { /* Reader may already be cleared. */ }
    }
    setScanning(false);
  };
  useEffect(() => () => { void stopScanner(); }, []);

  const lookup = async (value: string) => {
    const scanned = value.trim();
    if (!scanned || busy) return;
    setBusy(true); setError(''); setDetails(null); setToken(scanned);
    try {
      const response = await linkupPlatformApi.lookupEntryPass(scanned);
      setDetails(response.data.data);
      revealDetails();
      toast.success(response.data.data.checkedInAt ? 'Pass already checked in' : response.data.data.canCheckIn ? 'Valid booking found' : 'Booking found but entry is not available');
    } catch (requestError:any) {
      setError(requestError.response?.data?.message || 'This QR code is not a valid Linkup entry pass.');
    } finally { setBusy(false); }
  };

  const submitCapturedCode = (decodedText: string) => {
    if (scanLocked.current) return;
    scanLocked.current = true;
    clearCaptureRequest();
    void lookup(decodedText);
    void stopScanner();
  };

  const captureAndScan = () => {
    if (!scanning || busy || capturePending || scanLocked.current) return;
    setError('');
    captureRequested.current = true;
    setCapturePending(true);
    const recent = latestDecoded.current;
    if (recent && Date.now() - recent.at < 1500) {
      submitCapturedCode(recent.value);
      return;
    }
    captureTimeout.current = window.setTimeout(() => {
      clearCaptureRequest();
      setError('No QR code was detected. Hold the code steady inside the frame and tap Capture & scan again.');
    }, 5000);
  };

  const startScanner = async () => {
    setError(''); setDetails(null); scanLocked.current = false; latestDecoded.current = null; clearCaptureRequest();
    try {
      await stopScanner();
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('linkup-entry-reader', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        useBarCodeDetectorIfSupported: true,
        verbose: false,
      });
      scannerRef.current = scanner;
      setScanning(true);
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 20, qrbox: (width:number,height:number) => { const size=Math.max(50,Math.floor(Math.min(width,height)*0.9)); return { width:size, height:size }; }, aspectRatio: 1, disableFlip: true },
        decodedText => {
          latestDecoded.current = { value: decodedText, at: Date.now() };
          if (captureRequested.current) submitCapturedCode(decodedText);
        },
        () => {},
      );
    } catch (cameraError:any) {
      await stopScanner();
      setError(/permission|notallowed/i.test(String(cameraError?.message || cameraError)) ? 'Camera permission was denied. Allow camera access or paste the entry code below.' : 'The camera could not start. Use the manual entry option below.');
    }
  };

  const confirm = async () => {
    if (!token || busy) return;
    setBusy(true); setError('');
    try {
      const response = await linkupPlatformApi.confirmEntryPass(token);
      setDetails(response.data.data);
      toast.success('Guest entry confirmed');
    } catch (requestError:any) {
      if (requestError.response?.data?.data) setDetails(requestError.response.data.data);
      setError(requestError.response?.data?.message || 'Could not confirm guest entry');
    } finally { setBusy(false); }
  };

  const reset = () => { void stopScanner(); setToken(''); setDetails(null); setError(''); scanLocked.current=false; latestDecoded.current=null; };

  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,.95fr)]">
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-gradient-to-r from-violet-50 to-fuchsia-50 p-4 sm:p-6"><div className="flex items-start gap-3 sm:gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-200 sm:h-12 sm:w-12"><QrCode size={23}/></span><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-600">Secure event entry</p><h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">Scan customer QR pass</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Use the rear camera to verify a paid booking. Details appear before entry is confirmed.</p></div></div></div>
      <div className="p-5 sm:p-6">
        <div className={`relative mx-auto aspect-square w-full max-w-lg overflow-hidden rounded-3xl border-2 ${scanning?'border-violet-500 bg-slate-950':'border-dashed border-slate-300 bg-slate-50'}`}>
          <div id="linkup-entry-reader" className="h-full w-full overflow-hidden [&>div]:!h-full [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover"/>
          {!scanning&&<div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center"><span className="grid h-16 w-16 place-items-center rounded-2xl bg-violet-100 text-violet-700"><Camera size={28}/></span><h3 className="mt-5 text-lg font-black text-slate-900">Ready to scan</h3><p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">Ask the customer to open the QR code from their approval email or My Bookings page.</p><button type="button" onClick={()=>void startScanner()} className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-violet-600 px-6 text-sm font-black text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700"><Camera size={17}/> Open camera</button></div>}
        </div>
        {scanning&&<div className="mt-4 flex flex-col items-stretch justify-center gap-2 sm:flex-row"><button type="button" disabled={capturePending||busy} onClick={captureAndScan} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 text-sm font-black text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700 disabled:cursor-wait disabled:opacity-70">{capturePending?<RefreshCw size={17} className="animate-spin"/>:<Camera size={17}/>} {capturePending?'Scanning QR...':'Capture & scan'}</button><button type="button" onClick={()=>void stopScanner()} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 text-sm font-bold text-slate-700 hover:bg-slate-50">Stop camera</button></div>}
        <div className="my-6 flex items-center gap-3"><span className="h-px flex-1 bg-slate-200"/><span className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">Manual entry</span><span className="h-px flex-1 bg-slate-200"/></div>
        <div className="flex flex-col gap-2 sm:flex-row"><label className="relative min-w-0 flex-1"><Keyboard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={token} onChange={event=>setToken(event.target.value)} onKeyDown={event=>event.key==='Enter'&&void lookup(token)} placeholder="Paste scanned HBE-LINKUP code" className="h-12 w-full rounded-xl border border-slate-300 pl-10 pr-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"/></label><button type="button" disabled={!token.trim()||busy} onClick={()=>void lookup(token)} className="h-12 rounded-xl bg-slate-900 px-5 text-sm font-black text-white disabled:opacity-40">{busy?'Checking…':'Verify pass'}</button></div>
        {busy&&!details&&<div role="status" aria-live="polite" className="mt-4 flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm font-bold text-violet-700"><RefreshCw size={18} className="shrink-0 animate-spin"/><span>QR captured. Loading booking details...</span></div>}
        {error&&<div role="alert" className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-700"><AlertTriangle size={19} className="mt-0.5 shrink-0"/><span>{error}</span></div>}
      </div>
    </section>

    <section ref={detailsRef} tabIndex={-1} aria-live="polite" className="scroll-mt-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm outline-none sm:p-6">
      {!details?<div className="flex min-h-[260px] flex-col items-center justify-center text-center sm:min-h-[520px]"><span className="grid h-16 w-16 place-items-center rounded-2xl bg-slate-100 text-slate-400"><ShieldCheck size={28}/></span><h2 className="mt-5 text-xl font-black text-slate-900">Booking verification</h2><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Verified customer, event, package, chair/table and guest details will appear here before check-in.</p></div>:<div>
        <div className={`rounded-2xl border p-5 ${details.checkedInAt?'border-amber-200 bg-amber-50':details.canCheckIn?'border-emerald-200 bg-emerald-50':'border-red-200 bg-red-50'}`}><div className="flex items-start gap-3"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${details.checkedInAt?'bg-amber-500':details.canCheckIn?'bg-emerald-600':'bg-red-600'} text-white`}>{details.checkedInAt?<TicketCheck size={21}/>:details.canCheckIn?<CheckCircle2 size={21}/>:<AlertTriangle size={21}/>}</span><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Entry status</p><h2 className="mt-1 text-xl font-black text-slate-900">{details.checkedInAt?'Already checked in':details.canCheckIn?'Valid paid booking':'Entry not available'}</h2>{details.checkedInAt&&<p className="mt-1 text-xs font-semibold text-amber-700">Checked in {new Date(details.checkedInAt).toLocaleString()}</p>}</div></div></div>
        <div className="mt-6"><p className="text-xs font-black uppercase tracking-[.18em] text-violet-600">{details.bookingReference}</p><h3 className="mt-2 text-2xl font-black text-slate-900">{details.customerName}</h3><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase text-emerald-700">{words(details.paymentStatus)}</span><span className="rounded-full bg-violet-100 px-3 py-1 text-[10px] font-black uppercase text-violet-700">{words(details.bookingStatus)}</span></div></div>
        <div className="mt-6 grid gap-3"><div className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start gap-3"><CalendarDays size={18} className="mt-0.5 shrink-0 text-violet-600"/><div><span className="text-xs font-bold uppercase tracking-wide text-slate-400">Event</span><strong className="mt-1 block text-slate-900">{details.event?.title||'Event unavailable'}</strong><p className="mt-1 text-sm text-slate-600">{formatEventSchedule(details.event)}</p></div></div></div><div className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start gap-3"><MapPin size={18} className="mt-0.5 shrink-0 text-violet-600"/><div><span className="text-xs font-bold uppercase tracking-wide text-slate-400">Venue</span><strong className="mt-1 block text-slate-900">{details.event?.venueName||'To be announced'}</strong><p className="mt-1 text-sm text-slate-600">{details.event?.location}</p></div></div></div><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl border border-slate-200 p-4"><Armchair size={18} className="text-violet-600"/><span className="mt-3 block text-xs font-bold uppercase tracking-wide text-slate-400">Chair / table</span><strong className="mt-1 block text-slate-900">{details.seating?.name||details.package?.name||'Assigned package'}</strong></div><div className="rounded-2xl border border-slate-200 p-4"><Users size={18} className="text-violet-600"/><span className="mt-3 block text-xs font-bold uppercase tracking-wide text-slate-400">Guests</span><strong className="mt-1 block text-slate-900">{details.guestCount} {Number(details.guestCount)===1?'person':'people'}</strong></div></div></div>
        <div className="mt-6 flex flex-col gap-3"><button type="button" disabled={!details.canCheckIn||busy} onClick={()=>void confirm()} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"><UserCheck size={18}/>{busy?'Confirming…':details.checkedInAt?'Already checked in':'Confirm guest entry'}</button><button type="button" onClick={reset} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50"><RefreshCw size={15}/> Scan another pass</button></div>
      </div>}
    </section>
  </div>;
};

export default LinkupCheckInPanel;
