import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Clock3, History, MapPin, Package, QrCode, ReceiptText, RefreshCw, ShieldCheck, TicketCheck, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';
import LinkupHeader from '../components/linkup/LinkupHeader';
import LinkupPageLoader from '../components/linkup/LinkupPageLoader';
import { linkupPlatformApi } from '../services/api';
import { formatEventSchedule } from '../utils/eventTime';

type Booking = Record<string, any>;
type BookingTab = 'current' | 'past';

const money = (amount: number, currency = 'USD') => new Intl.NumberFormat(undefined, { style:'currency', currency }).format(Number(amount || 0));
const words = (value = '') => String(value).replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase());
const terminalStatuses = new Set(['completed', 'cancelled', 'expired']);
const today = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};
const isPastBooking = (booking: Booking) => terminalStatuses.has(booking.bookingStatus) || (booking.event?.eventDate && String(booking.event.eventDate).slice(0, 10) < today());
const statusClass = (status = '') => status === 'confirmed' || status === 'paid' || status === 'approved'
  ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
  : status === 'cancelled' || status === 'expired' || status === 'rejected'
    ? 'border-red-400/25 bg-red-400/10 text-red-200'
    : 'border-amber-400/25 bg-amber-400/10 text-amber-100';

const LinkupBookings: React.FC = () => {
  const { user, googleLogin } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [tab, setTab] = useState<BookingTab>('current');

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try { setBookings((await linkupPlatformApi.myBookings()).data.data || []); }
    catch (error:any) { toast.error(error.response?.data?.message || 'Could not load your bookings'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (user) { setShowSignIn(false); void load(); } else setBookings([]); }, [user?._id]);

  const grouped = useMemo(() => {
    const current = bookings.filter(booking => !isPastBooking(booking)).sort((a,b) => String(a.event?.eventDate || '').localeCompare(String(b.event?.eventDate || '')));
    const past = bookings.filter(isPastBooking).sort((a,b) => String(b.event?.eventDate || b.createdAt || '').localeCompare(String(a.event?.eventDate || a.createdAt || '')));
    return { current, past };
  }, [bookings]);
  const visible = grouped[tab];

  if (loading && user && !bookings.length) return <LinkupPageLoader variant="bookings"/>;

  return <div className="min-h-screen bg-[#050817] text-white">
    <LinkupHeader onSignIn={()=>setShowSignIn(true)}/>
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-5 sm:py-14">
      {!user ? <section className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/10 via-white/[.045] to-fuchsia-500/[.06] p-7 text-center shadow-2xl shadow-black/30 sm:p-10">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/25"><TicketCheck size={29}/></span>
        <p className="mt-6 text-xs font-black uppercase tracking-[.24em] text-violet-300">Customer booking portal</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Your nights, all in one place.</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">Sign in with the same Google account used for checkout to securely view current reservations, payment progress and past bookings.</p>
        <div className="mx-auto mt-8 max-w-md rounded-2xl border border-white/10 bg-white p-4 text-slate-900"><GoogleSignInButton onCredential={async credential=>{setSigningIn(true);try{await googleLogin(credential,true);toast.success('Welcome back');}catch(error:any){toast.error(error.response?.data?.message||'Google sign-in failed')}finally{setSigningIn(false)}}} onError={message=>toast.error(message)}/>{signingIn&&<p className="mt-3 text-xs font-semibold text-violet-600">Securely signing you in…</p>}</div>
        <p className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-slate-400"><ShieldCheck size={15} className="text-emerald-400"/> Bookings are matched to your authenticated customer account.</p>
      </section> : <>
        <section className="flex flex-col gap-7 border-b border-white/10 pb-9 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[.24em] text-violet-300">Customer account</p><h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">My bookings</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">Track upcoming Linkup experiences, payment verification and your complete booking history.</p></div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">{[[grouped.current.length,'Current',CalendarDays],[bookings.filter(item=>item.bookingStatus==='confirmed').length,'Confirmed',CheckCircle2],[grouped.past.length,'Past',History]].map(([value,label,Icon]:any)=><div key={label} className="min-w-24 rounded-2xl border border-white/10 bg-white/[.045] p-3.5 sm:min-w-28"><Icon size={17} className="text-violet-300"/><strong className="mt-3 block text-2xl font-black">{value}</strong><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span></div>)}</div>
        </section>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-2xl border border-white/10 bg-white/[.04] p-1.5"><button onClick={()=>setTab('current')} className={`inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold transition ${tab==='current'?'bg-violet-600 text-white shadow-lg shadow-violet-950/40':'text-slate-400 hover:text-white'}`}><CalendarDays size={16}/> Current <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px]">{grouped.current.length}</span></button><button onClick={()=>setTab('past')} className={`inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold transition ${tab==='past'?'bg-violet-600 text-white shadow-lg shadow-violet-950/40':'text-slate-400 hover:text-white'}`}><History size={16}/> Past <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px]">{grouped.past.length}</span></button></div>
          <button onClick={()=>void load()} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-4 text-sm font-bold text-slate-300 transition hover:bg-white/[.08] disabled:opacity-50"><RefreshCw size={15} className={loading?'animate-spin':''}/> Refresh</button>
        </div>

        {visible.length ? <div className="mt-6 grid gap-5 lg:grid-cols-2">{visible.map(booking=><article key={booking._id} className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[.045] shadow-xl shadow-black/15 transition hover:-translate-y-0.5 hover:border-violet-400/25">
          <div className="flex min-h-32 gap-4 border-b border-white/10 p-5 sm:p-6"><div className="h-24 w-28 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10">{booking.package?.image||booking.event?.banner?<img src={booking.package?.image||booking.event?.banner} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/>:<span className="grid h-full w-full place-items-center text-violet-300"><TicketCheck size={28}/></span>}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${statusClass(booking.bookingStatus)}`}>{words(booking.bookingStatus)}</span><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${statusClass(booking.paymentStatus)}`}>{words(booking.paymentStatus)}</span></div><h2 className="mt-3 truncate text-lg font-black sm:text-xl">{booking.event?.title || booking.performanceSlot?.title || 'Linkup booking'}</h2><p className="mt-1 truncate text-sm font-semibold text-violet-200">{booking.package?.name || (booking.bookingType==='performance_slot'?'Performance slot':'Experience package')}</p></div></div>
          <div className="grid gap-3 p-5 text-sm text-slate-300 sm:grid-cols-2 sm:p-6"><p className="flex items-start gap-2"><CalendarDays size={16} className="mt-0.5 shrink-0 text-violet-300"/><span>{formatEventSchedule(booking.event)}</span></p><p className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-violet-300"/><span>{booking.event?.venueName || booking.event?.location || 'Venue to be announced'}</span></p><p className="flex items-center gap-2"><Users size={16} className="text-violet-300"/><span>{booking.guestCount || 1} {Number(booking.guestCount||1)===1?'guest':'guests'}</span></p><p className="flex items-center gap-2"><ReceiptText size={16} className="text-violet-300"/><span className="font-mono text-xs">{booking.bookingReference}</span></p></div>
          {booking.transfer&&<div className="mx-5 mb-5 rounded-2xl border border-white/10 bg-black/15 p-4 sm:mx-6 sm:mb-6"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold uppercase tracking-wider text-slate-400">Payment receipt</span><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${statusClass(booking.transfer.verificationStatus)}`}>{words(booking.transfer.verificationStatus)}</span></div><p className="mt-2 text-xs text-slate-400">Reference <span className="font-mono text-slate-200">{booking.transfer.transferReference}</span></p>{booking.transfer.rejectionReason&&<p className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs leading-5 text-red-100">{booking.transfer.rejectionReason}</p>}</div>}
          {booking.entryQrUrl&&<div className="mx-5 mb-5 flex flex-col items-center gap-4 rounded-2xl border border-violet-400/20 bg-violet-500/[.08] p-5 text-center sm:mx-6 sm:mb-6 sm:flex-row sm:text-left"><img src={booking.entryQrUrl} alt={`Entry QR code for ${booking.bookingReference}`} className="h-36 w-36 shrink-0 rounded-2xl bg-white p-2" loading="lazy"/><div><p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-violet-200"><QrCode size={15}/> Event entry pass</p><h3 className="mt-2 text-lg font-black">{booking.checkedInAt?'Entry already confirmed':'Show this QR at the entrance'}</h3><p className="mt-2 text-xs leading-5 text-slate-300">{booking.checkedInAt?`Checked in ${new Date(booking.checkedInAt).toLocaleString()}.`:'An administrator will scan this secure code and confirm your booking, chair/table and guest details.'}</p></div></div>}
          <div className="flex items-center justify-between gap-4 border-t border-white/10 bg-black/10 px-5 py-4 sm:px-6"><div><span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Total</span><strong className="text-lg font-black">{money(booking.totalAmount,booking.currency)}</strong></div>{!isPastBooking(booking)&&booking.event?._id?<Link to={`/linkup/events/${booking.event._id}`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-black text-white transition hover:bg-violet-500"><Package size={14}/> View event</Link>:<span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500"><Clock3 size={14}/> Booking history</span>}</div>
        </article>)}</div> : <div className="mt-6 flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/[.025] px-5 text-center"><span className="grid h-16 w-16 place-items-center rounded-2xl bg-violet-500/10 text-violet-300">{tab==='current'?<CalendarDays size={27}/>:<History size={27}/>}</span><h2 className="mt-5 text-xl font-black">No {tab} bookings</h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{tab==='current'?'When you reserve a Linkup experience, it will appear here with live payment and confirmation status.':'Completed, cancelled and expired bookings will appear here.'}</p>{tab==='current'&&<Link to="/linkup/packages" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-black">Explore packages <Package size={15}/></Link>}</div>}
      </>}
    </main>

    {showSignIn&&!user&&<div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={event=>event.target===event.currentTarget&&setShowSignIn(false)}><div className="w-full max-w-md rounded-3xl bg-white p-6 text-slate-900 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-2xl font-black">View your bookings</h2><p className="mt-2 text-sm leading-6 text-slate-500">Sign in with the Google account used when making your reservation.</p></div><button onClick={()=>setShowSignIn(false)} className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500"><X size={18}/></button></div><div className="mt-6"><GoogleSignInButton onCredential={async credential=>{setSigningIn(true);try{await googleLogin(credential,true);toast.success('Welcome back')}catch(error:any){toast.error(error.response?.data?.message||'Google sign-in failed')}finally{setSigningIn(false)}}} onError={message=>toast.error(message)}/>{signingIn&&<p className="mt-3 text-center text-xs font-semibold text-violet-600">Securely signing you in…</p>}</div></div></div>}
  </div>;
};

export default LinkupBookings;
