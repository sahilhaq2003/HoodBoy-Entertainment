import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Radio, CheckSquare, DollarSign, TrendingUp,
  Settings, RefreshCw, LayoutDashboard,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { HbeAccent } from './Card';
import { accentColors } from './Card';

interface HeroStat {
  label: string;
  value: string | number;
  tone?: 'up' | 'down' | 'neutral';
}

interface HeroQuickAction {
  label: string;
  icon: React.ReactNode;
  path: string;
  color: string;
}

const defaultQuick: HeroQuickAction[] = [
  { label: 'Add Artist', icon: <Users size={15} />, path: '/artists/new', color: '#16A34A' },
  { label: 'New Release', icon: <Radio size={15} />, path: '/releases', color: '#7C3AED' },
  { label: 'Quick Task', icon: <CheckSquare size={15} />, path: '/tasks', color: '#7C3AED' },
  { label: 'Record Payment', icon: <DollarSign size={15} />, path: '/finance', color: '#D97706' },
  { label: 'Analytics', icon: <TrendingUp size={15} />, path: '/analytics', color: '#0EA5E9' },
  { label: 'Settings', icon: <Settings size={15} />, path: '/settings', color: '#6B7280' },
];

const roleLabel: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  artist: 'Artist',
  finance: 'Finance',
  marketing: 'Marketing',
};

interface DashboardHeroProps {
  eyebrow?: string;
  title?: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: HbeAccent;
  stats?: HeroStat[];
  quick?: HeroQuickAction[];
  onRefresh?: () => void;
  refreshing?: boolean;
  actions?: React.ReactNode;
}

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const DashboardHero: React.FC<DashboardHeroProps> = ({
  eyebrow = 'HoodBoy Entertainment Operations',
  title,
  subtitle,
  icon,
  accent = 'coral',
  stats,
  quick = defaultQuick,
  onRefresh,
  refreshing,
  actions,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const c = accentColors[accent];

  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const firstName = user?.name?.split(' ')[0] || 'there';
  const role = user?.role ? roleLabel[user.role] : undefined;

  return (
    <div className="hbe-hero p-6 md:p-8">
      <div className="hbe-glow" style={{ top: -60, right: '6%', width: 320, height: 320, background: c.dot, opacity: 0.16 }} />

      <div className="relative z-10">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
          <div className="flex items-start gap-4 min-w-0">
            <div
              className="hbe-icon-tile w-[52px] h-[52px] shrink-0"
              style={{ background: c.bg, color: c.text, borderRadius: 14, width: 52, height: 52 }}
            >
              <span className="scale-125">{icon || <LayoutDashboard size={22} />}</span>
            </div>
            <div className="space-y-2 min-w-0">
              <div className="inline-flex items-center gap-2 hbe-badge" style={{ color: c.text, background: c.bg, borderColor: 'transparent' }}>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full animate-ping" style={{ background: c.dot, opacity: 0.6 }} />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: c.dot }} />
                </span>
                {eyebrow}
              </div>
              <h2 className="text-xl md:text-[26px] font-extrabold tracking-[-0.02em] text-[var(--hbe-text)] leading-tight">
                {title || `${greeting()}, ${firstName}`}
              </h2>
              <p className="text-xs md:text-[13px] text-[var(--hbe-muted)] font-medium leading-relaxed">
                {subtitle || (
                  <>
                    {date} - Here is today's system overview{role ? <> · <span className="text-[var(--hbe-text-soft)]">{role} · HoodBoy Entertainment</span></> : ' for HoodBoy Entertainment'}.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row xl:flex-col items-stretch xl:items-end gap-3">
            {stats && stats.length > 0 && (
              <div className="flex items-center gap-5 rounded-2xl border border-(--hbe-line) bg-(--hbe-fill-soft) backdrop-blur-md px-5 sm:px-7 py-4">
                {stats.map((s, i) => (
                  <div key={s.label} className="flex items-center gap-5">
                    {i > 0 && <div className="w-px h-9 bg-(--hbe-line)" />}
                    <div>
                      <div
                        className={`text-lg xl:text-xl font-black tracking-tight ${
                          s.tone === 'up' ? 'text-[#16A34A]' : s.tone === 'down' ? 'text-[#DC2626]' : 'text-[var(--hbe-text)]'
                        }`}
                      >
                        {s.value}
                      </div>
                      <div className="text-[10px] font-semibold tracking-[0.09em] uppercase text-[var(--hbe-muted)] mt-0.5">{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {(onRefresh || actions) && (
              <div className="flex items-center gap-2.5 flex-wrap">
                {onRefresh && (
                  <button
                    onClick={onRefresh}
                    disabled={refreshing}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-(--hbe-line) bg-(--hbe-fill-soft) hover:border-[#C4B5FD] hover:bg-(--hbe-fill) text-[12px] font-semibold text-[var(--hbe-text-soft)] hover:text-[var(--hbe-text)] transition-all disabled:opacity-60"
                  >
                    <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                    Refresh
                  </button>
                )}
                {actions}
              </div>
            )}
          </div>
        </div>

        {quick && quick.length > 0 && (
          <div className="mt-6 pt-5 border-t border-(--hbe-line-soft) flex flex-wrap items-center gap-2.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--hbe-muted)] mr-1">Quick access</span>
            {quick.map((q) => (
              <button
                key={q.path}
                onClick={() => navigate(q.path)}
                className="group inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-(--hbe-line) bg-(--hbe-fill-soft) hover:border-[#C4B5FD] hover:bg-(--hbe-fill) hover:-translate-y-0.5 transition-all duration-200 text-[12px] font-semibold text-[var(--hbe-text-soft)] hover:text-[var(--hbe-text)]"
              >
                <span
                  className="hbe-icon-tile flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
                  style={{ background: `${q.color}16`, color: q.color, width: 24, height: 24, borderRadius: 7 }}
                >
                  {q.icon}
                </span>
                {q.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardHero;