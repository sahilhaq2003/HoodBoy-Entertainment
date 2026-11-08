import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, LogOut, Package, TicketCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { preloadRoute } from '../../utils/routePreload';

const LinkupHeader: React.FC<{ onSignIn?:()=>void }> = ({onSignIn}) => {
  const {user,logout}=useAuth();
  const location=useLocation();
  const navigate=useNavigate();
  const initials=String(user?.name||'Guest').split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
  const signOut=()=>{logout();navigate('/home',{replace:true})};
  const eventsActive=location.pathname==='/linkup'||location.pathname.startsWith('/linkup/events');
  const packagesActive=location.pathname==='/linkup/packages';
  const bookingsActive=location.pathname==='/linkup/bookings';

  return <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050817]/85 shadow-[0_12px_40px_rgba(0,0,0,.28)] backdrop-blur-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-5 h-[76px] flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 sm:gap-5 min-w-0">
        <Link to="/home" onMouseEnter={()=>void preloadRoute('/home')} onFocus={()=>void preloadRoute('/home')} className="hidden sm:inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition" aria-label="Back to home"><span className="w-9 h-9 grid place-items-center rounded-full border border-white/10 bg-white/5"><ArrowLeft size={16}/></span><span className="hidden lg:inline">Home</span></Link>
        <Link to="/linkup" className="flex items-center gap-3 min-w-0" aria-label="HoodBoy Entertainment Linkup home">
          <span className="w-12 h-12 rounded-xl border border-white/10 bg-white/[.06] p-1 shadow-lg shadow-violet-950/30"><img src="/logo-160.png" alt="HoodBoy Entertainment" className="w-full h-full object-contain"/></span>
          <span className="min-w-0"><strong className="block text-sm sm:text-base font-black tracking-tight text-white truncate">HoodBoy Entertainment</strong><small className="block text-[9px] font-bold uppercase tracking-[.2em] text-violet-300">The Lnk Up</small></span>
        </Link>
      </div>

      <nav className="hidden md:flex items-center rounded-full border border-white/10 bg-white/[.04] p-1" aria-label="Linkup navigation">
        <Link to="/linkup" onMouseEnter={()=>void preloadRoute('/linkup')} onFocus={()=>void preloadRoute('/linkup')} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition ${eventsActive?'bg-violet-600 text-white shadow-lg shadow-violet-900/30':'text-slate-400 hover:text-white'}`}><CalendarDays size={14}/> Events</Link>
        <Link to="/linkup/packages" onMouseEnter={()=>void preloadRoute('/linkup/packages')} onFocus={()=>void preloadRoute('/linkup/packages')} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition ${packagesActive?'bg-violet-600 text-white shadow-lg shadow-violet-900/30':'text-slate-400 hover:text-white'}`}><Package size={14}/> Packages</Link>
        {user?.role==='customer'&&<Link to="/linkup/bookings" onMouseEnter={()=>void preloadRoute('/linkup/bookings')} onFocus={()=>void preloadRoute('/linkup/bookings')} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition ${bookingsActive?'bg-violet-600 text-white shadow-lg shadow-violet-900/30':'text-slate-400 hover:text-white'}`}><TicketCheck size={14}/> My bookings</Link>}
      </nav>

      <div className="flex items-center gap-2 sm:gap-3">
        {user?<><div className="hidden sm:flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[.05] py-1.5 pl-1.5 pr-3"><span className="w-8 h-8 overflow-hidden grid place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[10px] font-black">{user.avatar?<img src={user.avatar} alt="" className="w-full h-full object-cover"/>:initials}</span><span className="max-w-28"><b className="block text-xs text-white truncate">{user.name}</b><small className="block text-[9px] text-emerald-300">Customer</small></span></div><button onClick={signOut} className="group inline-flex items-center gap-2 h-10 px-3 sm:px-4 rounded-full border border-white/15 bg-white/[.04] text-xs font-bold text-slate-300 hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200 transition" title="Sign out"><LogOut size={15} className="group-hover:-translate-x-0.5 transition"/><span className="hidden sm:inline">Sign out</span></button></>:<button onClick={onSignIn||(()=>navigate('/login'))} className="h-10 px-4 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-xs font-black text-white shadow-lg shadow-violet-950/35 hover:brightness-110 transition">Sign in with Google</button>}
      </div>
    </div>
    <div className="md:hidden px-4 pb-3 flex gap-2"><Link to="/home" aria-label="Back to home" className="w-10 h-9 grid place-items-center rounded-lg border border-white/10 text-slate-300"><ArrowLeft size={15}/></Link><Link to="/linkup" className={`flex-1 h-9 grid place-items-center rounded-lg text-xs font-bold ${eventsActive?'bg-violet-600':'bg-white/[.06] text-slate-300'}`}>Events</Link><Link to="/linkup/packages" className={`flex-1 h-9 grid place-items-center rounded-lg text-xs font-bold ${packagesActive?'bg-violet-600':'bg-white/[.06] text-slate-300'}`}>Packages</Link>{user?.role==='customer'&&<Link to="/linkup/bookings" className={`flex-1 h-9 grid place-items-center rounded-lg text-xs font-bold ${bookingsActive?'bg-violet-600':'bg-white/[.06] text-slate-300'}`}>Bookings</Link>}</div>
  </header>;
};

export default LinkupHeader;
