import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Music, Radio, FileText, DollarSign,
  Phone, CheckSquare, Settings, Star, TrendingUp, LogOut, X,
  Award, FolderOpen, Shield, Calendar, Disc, Megaphone,
  BarChart3, CreditCard, Receipt, Wallet, User, Home, FileClock, LayoutGrid,
  Tv, UserCog,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const iconMap: Record<string, React.ReactNode> = {
  '/': <LayoutDashboard size={17} />,
  '/manager-dashboard': <LayoutDashboard size={17} />,
  '/artist-dashboard': <LayoutDashboard size={17} />,
  '/finance-dashboard': <LayoutDashboard size={17} />,
  '/marketing-dashboard': <LayoutDashboard size={17} />,
  '/artists': <Users size={17} />,
  '/songs': <Music size={17} />,
  '/releases': <Radio size={17} />,
  '/the-lnk-up': <Tv size={17} />,
  '/projects': <FolderOpen size={17} />,
  '/contracts': <FileText size={17} />,
  '/finance': <DollarSign size={17} />,
  '/royalties': <Star size={17} />,
  '/artist-balances': <Wallet size={17} />,
  '/analytics': <TrendingUp size={17} />,
  '/song-analytics': <BarChart3 size={17} />,
  '/campaigns': <Megaphone size={17} />,
  '/development': <Award size={17} />,
  '/ownership': <Shield size={17} />,
  '/files': <FolderOpen size={17} />,
  '/metadata': <Disc size={17} />,
  '/contract-templates': <Receipt size={17} />,
  '/tax-calendar': <Calendar size={17} />,
  '/contacts': <Phone size={17} />,
  '/tasks': <CheckSquare size={17} />,
  '/settings': <Settings size={17} />,
  '/team': <UserCog size={17} />,
  '/my-music': <Music size={17} />,
  '/my-releases': <Radio size={17} />,
  '/profile': <User size={17} />,
  '/budgets': <CreditCard size={17} />,
  '/weekly-report': <FileClock size={17} />,
};

const SECTION_ORDER: Array<{ label: string; prefix: string }> = [
  { label: 'Overview', prefix: '' },
  { label: 'Catalog', prefix: '/artists' },
  { label: 'Operations', prefix: '/projects' },
  { label: 'Finance', prefix: '/finance' },
  { label: 'Insights', prefix: '/analytics' },
  { label: 'Account', prefix: '/settings' },
];

const sectionFor = (path: string): { label: string } => {
  if (path === '/' || path.endsWith('-dashboard')) return { label: 'Overview' };
  if (['/artists', '/songs', '/releases', '/metadata', '/files', '/my-music', '/my-releases'].some((p) => path.startsWith(p)))
    return { label: 'Catalog' };
  if (['/projects', '/development', '/tasks', '/contracts', '/contract-templates', '/contacts', '/campaigns', '/the-lnk-up'].some((p) => path.startsWith(p)))
    return { label: 'Operations' };
  if (['/finance', '/royalties', '/artist-balances', '/budgets', '/tax-calendar'].some((p) => path.startsWith(p)))
    return { label: 'Finance' };
  if (['/analytics', '/song-analytics', '/ownership', '/weekly-report'].some((p) => path.startsWith(p)))
    return { label: 'Insights' };
  if (['/team'].some((p) => path.startsWith(p)))
    return { label: 'Account' };
  return { label: 'Account' };
};

const roleMeta: Record<string, { label: string; color: string; bg: string }> = {
  admin: { label: 'Administrator', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  manager: { label: 'Manager', color: '#16A34A', bg: 'rgba(22,163,74,0.12)' },
  artist: { label: 'Artist', color: '#7C3AED', bg: 'rgba(124,58,237,0.12)' },
  finance: { label: 'Finance', color: '#D97706', bg: 'rgba(245,158,11,0.12)' },
  marketing: { label: 'Marketing', color: '#DB2777', bg: 'rgba(236,72,153,0.12)' },
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { user, logout, nav } = useAuth();

  const grouped = SECTION_ORDER.map((section) => ({
    ...section,
    items: nav.filter((item) => sectionFor(item.path).label === section.label),
  })).filter((g) => g.items.length > 0);

  const meta = roleMeta[user?.role || ''] || roleMeta.manager;

  const sidebarContent = (
    <div className="sidebar-panel h-full flex flex-col w-[264px] flex-shrink-0">
      {/* Logo */}
      <div className="flex min-h-[72px] items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <img src="/logo-160.png" alt="HoodBoy Entertainment" width="44" height="44" decoding="async" className="w-11 h-11 object-contain flex-shrink-0 drop-shadow-sm" />
          <div className="min-w-0">
            <div className="text-[19px] font-extrabold tracking-[-0.02em] bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A855F7] bg-clip-text text-transparent drop-shadow-sm leading-tight">HoodBoy Ent.</div>
          </div>
        </div>
        <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg text-[var(--hbe-muted)] hover:bg-(--hbe-hover-fill) hover:text-[var(--hbe-text)] transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4">
        {grouped.map((group) => (
          <div key={group.label} className="sidebar-nav-group">
            <p className="sidebar-section-label">{group.label}</p>
            <div className="space-y-[2px]">
              {group.items.map((item) => {
                const isActive =
                  location.pathname === item.path ||
                  (item.path !== '/' && !item.path.endsWith('-dashboard') && location.pathname.startsWith(item.path)) ||
                  (item.path.endsWith('-dashboard') && location.pathname === item.path);
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={`nav-item ${isActive ? 'nav-item-active' : ''}`}
                  >
                    <span className="nav-icon flex-shrink-0">{iconMap[item.path] || <Home size={17} />}</span>
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-(--hbe-line-soft) p-3.5 space-y-2">
        <div className="flex items-center gap-3 rounded-2xl border border-(--hbe-line) bg-(--hbe-fill-soft) p-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 border border-white/25 overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}99)` }}
          >
            {user?.avatar ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" /> : (user?.name?.charAt(0) || 'U')}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-[var(--hbe-text)] truncate">{user?.name}</div>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mt-0.5"
              style={{ background: meta.bg, color: meta.color }}
            >
              {meta.label}
            </span>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-[var(--hbe-muted)] border border-transparent hover:border-red-500/20 hover:bg-red-500/10 hover:text-[#DC2626] transition-colors"
        >
          <LogOut size={15} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block h-full shrink-0">{sidebarContent}</aside>
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <div className="absolute inset-y-0 left-0 w-[264px] shadow-2xl">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
