import React, { useState, useRef, useEffect } from 'react';
import { Menu, LogOut, User, Settings, ChevronDown, Search, CalendarDays, Command, Sun, Moon, Loader2, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import NotificationBell from '../notifications/NotificationBell';
import { searchApi } from '../../services/api';
import { applyAppearance, getAppearance } from '../../utils/appearance';

interface SearchResult { id: string; category: string; title: string; subtitle?: string; path: string }

const pageTitles: Record<string, string> = {
  '/': 'Executive Dashboard',
  '/artists': 'Artists',
  '/artists/new': 'Artist Onboarding',
  '/artists/onboarding': 'Artist Onboarding',
  '/songs': 'Music Catalog',
  '/releases': 'Releases',
  '/the-lnk-up': 'The Lnk Up',
  '/contracts': 'Contracts',
  '/finance': 'Finance Overview',
  '/royalties': 'Royalties',
  '/analytics': 'Analytics',
  '/contacts': 'Contacts',
  '/tasks': 'Tasks & Responsibilities',
  '/weekly-report': 'Weekly Report',
  '/metadata': 'Metadata Manager',
  '/settings': 'Settings',
  '/projects': 'Projects',
  '/development': 'Artist Development',
  '/files': 'File Manager',
  '/ownership': 'Ownership Tracker',
  '/campaigns': 'Campaign Manager',
  '/manager-dashboard': 'Manager Dashboard',
  '/artist-dashboard': 'Artist Dashboard',
  '/finance-dashboard': 'Finance Dashboard',
  '/marketing-dashboard': 'Marketing Dashboard',
  '/artist-balances': 'Artist Balances',
  '/tax-calendar': 'Tax Calendar',
  '/contract-templates': 'Contract Templates',
  '/song-analytics': 'Song Analytics',
  '/my-music': 'My Music',
  '/my-releases': 'My Releases',
  '/profile': 'My Profile',
  '/budgets': 'Budgets',
};

interface TopBarProps {
  onMenuClick: () => void;
}

const roleTone: Record<string, { bg: string; color: string }> = {
  admin: { bg: 'linear-gradient(135deg,#EF4444,#B91C1C)', color: '#E11D48' },
  manager: { bg: 'linear-gradient(135deg,#22C55E,#15803D)', color: '#16A34A' },
  artist: { bg: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', color: '#7C3AED' },
  finance: { bg: 'linear-gradient(135deg,#F59E0B,#B45309)', color: '#D97706' },
  marketing: { bg: 'linear-gradient(135deg,#F472B6,#DB2777)', color: '#DB2777' },
};

const TopBar: React.FC<TopBarProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('hbe_theme') as 'light' | 'dark') || 'light';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    const appearance = getAppearance();
    applyAppearance({ ...appearance, theme: next });
  };

  useEffect(() => {
    const syncTheme = () => setTheme(getAppearance().theme === 'dark' ? 'dark' : 'light');
    window.addEventListener('hbe-appearance-change', syncTheme);
    return () => window.removeEventListener('hbe-appearance-change', syncTheme);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') setSearchOpen(false);
    };
    document.addEventListener('keydown', onShortcut);
    return () => document.removeEventListener('keydown', onShortcut);
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length < 2) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    const timer = window.setTimeout(() => {
      searchApi.search(searchQuery.trim())
        .then(res => setSearchResults(res.data.data || []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const openResult = (result: SearchResult) => {
    setSearchOpen(false); setSearchQuery(''); setSearchResults([]);
    navigate(result.path);
  };

  const getTitle = () => {
    for (const [path, title] of Object.entries(pageTitles)) {
      if (path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)) {
        return title;
      }
    }
    return 'HoodBoy Entertainment';
  };

  const handleLogout = () => {
    setUserMenuOpen(false);
    logout();
    navigate('/login');
  };

  const tone = roleTone[user?.role || ''] || roleTone.manager;

  return (
    <header className="topbar-panel min-h-[72px] flex items-center px-4 sm:px-5 md:px-7 xl:px-9 gap-3 sticky top-0 z-30">
      <button onClick={onMenuClick} className="lg:hidden header-icon-button">
        <Menu size={20} />
      </button>

      <div className="min-w-0 lg:w-52 xl:w-60">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--hbe-muted)] hidden sm:block">HoodBoy Workspace</p>
        <h1 className="text-[15px] font-bold text-[var(--hbe-text)] truncate mt-0.5">{getTitle()}</h1>
      </div>

      <div className="header-search hidden md:flex flex-1 max-w-xl items-center gap-3 px-4 py-[9px] relative">
        <Search size={15} className="text-[var(--hbe-muted)]" />
        <input
          ref={searchRef}
          type="text"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
          onFocus={() => setSearchOpen(true)}
          placeholder="Search artists, songs, contracts..."
          aria-label="Search workspace"
          className="bg-transparent text-[12.5px] text-[var(--hbe-text-soft)] placeholder-[var(--hbe-muted)] outline-none flex-1"
        />
        {searching ? <Loader2 size={13} className="animate-spin text-[var(--hbe-muted)]" /> : searchQuery && <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} aria-label="Clear search"><X size={13} /></button>}
        <span className="hidden xl:inline-flex items-center gap-1 rounded-lg border border-(--hbe-line) bg-(--hbe-fill) px-2 py-1 text-[9.5px] font-semibold text-[var(--hbe-muted)]">
          <Command size={9} />K
        </span>
        {searchOpen && searchQuery.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] max-h-80 overflow-y-auto rounded-2xl border border-(--hbe-line) bg-(--hbe-panel) shadow-2xl z-50 p-2">
            {!searching && searchResults.length === 0 && <p className="px-3 py-6 text-center text-xs text-[var(--hbe-muted)]">No accessible records found.</p>}
            {searchResults.map(result => <button key={`${result.category}-${result.id}`} onMouseDown={e => e.preventDefault()} onClick={() => openResult(result)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-(--hbe-hover-fill)"><span className="text-[9px] uppercase tracking-wide font-bold text-purple-600 w-16 flex-shrink-0">{result.category}</span><span className="min-w-0"><span className="block text-xs font-semibold text-[var(--hbe-text)] truncate">{result.title}</span>{result.subtitle && <span className="block text-[10px] text-[var(--hbe-muted)] truncate capitalize">{result.subtitle.replace(/_/g, ' ')}</span>}</span></button>)}
          </div>
        )}
      </div>

      <div className="ml-auto flex flex-shrink-0 items-center gap-3">
        <div className="hidden xl:flex items-center gap-2.5 rounded-xl border border-(--hbe-line) bg-(--hbe-fill-soft) px-3.5 py-2 text-[11px] font-semibold text-[var(--hbe-muted)]">
          <CalendarDays size={14} style={{ color: '#7C3AED' }} />
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
        </div>

        <NotificationBell />

        <button
          onClick={toggleTheme}
          className="header-icon-button"
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        <div className="relative" ref={userMenuRef}>
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="flex items-center gap-2.5 rounded-xl border border-transparent p-1.5 pr-2.5 hover:border-(--hbe-line) hover:bg-(--hbe-fill) transition-colors"
        >
          <div
            className="w-9 h-9 rounded-[11px] flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 border border-white/25 shadow-lg overflow-hidden"
            style={{ background: tone.bg, boxShadow: '0 8px 24px rgba(15,23,42,0.18)' }}
          >
            {user?.avatar ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" /> : (user?.name?.slice(0, 2).toUpperCase() || 'HB')}
          </div>
          <div className="hidden md:block text-left">
            <div className="text-xs font-semibold text-[var(--hbe-text)] leading-tight">{user?.name || 'Admin'}</div>
            <div className="text-[10px] capitalize leading-tight mt-0.5" style={{ color: tone.color }}>{user?.role}</div>
          </div>
          <ChevronDown size={13} className={`text-[var(--hbe-muted)] hidden md:block transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {userMenuOpen && (
          <div
            className="absolute right-0 top-full mt-2.5 w-60 overflow-hidden rounded-2xl z-50"
            style={{ background: 'var(--hbe-panel)', border: '1px solid var(--hbe-line)', boxShadow: 'var(--hbe-shadow-float)' }}
          >
            <div className="px-4 py-3.5 border-b border-(--hbe-line-soft)" style={{ background: 'var(--hbe-fill-soft)' }}>
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-[11px] flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 overflow-hidden"
                  style={{ background: tone.bg }}
                >
                  {user?.avatar ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" /> : (user?.name?.slice(0, 2).toUpperCase() || 'HB')}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--hbe-text)] truncate">{user?.name}</p>
                  <p className="text-[11px] text-[var(--hbe-muted)] truncate">{user?.email}</p>
                </div>
              </div>
            </div>
            <div className="py-1.5">
              <button
                onClick={() => { setUserMenuOpen(false); navigate(user?.role === 'artist' ? '/profile' : '/settings'); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-[var(--hbe-text-soft)] hover:bg-(--hbe-hover-fill) hover:text-[var(--hbe-text)] transition-colors"
              >
                <User size={15} className="text-[var(--hbe-muted)]" />
                Profile
              </button>
              <button
                onClick={() => { setUserMenuOpen(false); navigate('/settings'); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-[var(--hbe-text-soft)] hover:bg-(--hbe-hover-fill) hover:text-[var(--hbe-text)] transition-colors"
              >
                <Settings size={15} className="text-[var(--hbe-muted)]" />
                Settings
              </button>
            </div>
            <div className="border-t border-(--hbe-line-soft) py-1.5">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-[#DC2626] hover:bg-red-500/10 transition-colors"
              >
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
