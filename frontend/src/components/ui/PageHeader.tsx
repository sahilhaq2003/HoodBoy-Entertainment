import React from 'react';
import type { HbeAccent } from './Card';
import { accentColors } from './Card';

interface HeaderStat {
  label: string;
  value: string | number;
  tone?: 'up' | 'down' | 'neutral';
}

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: HbeAccent;
  avatar?: React.ReactNode;
  actions?: React.ReactNode;
  stats?: HeaderStat[];
}

const PageHeader: React.FC<PageHeaderProps> = ({
  eyebrow,
  title,
  subtitle,
  icon,
  accent = 'coral',
  avatar,
  actions,
  stats,
}) => {
  const c = accentColors[accent];

  return (
    <div className="hbe-hero p-6 md:p-8">
      <div className="hbe-glow" style={{ top: -60, right: '8%', width: 280, height: 280, background: c.dot, opacity: 0.14 }} />
      <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          {avatar ? (
            <div className="relative shrink-0">{avatar}</div>
          ) : icon ? (
            <div
              className="hbe-icon-tile w-[52px] h-[52px] shrink-0"
              style={{ background: c.bg, color: c.text, borderRadius: 14, width: 52, height: 52 }}
            >
              <span className="scale-125">{icon}</span>
            </div>
          ) : null}
          <div className="space-y-1.5 min-w-0">
            {eyebrow && (
              <div className="inline-flex items-center gap-1.5 hbe-badge" style={{ color: c.text, background: c.bg, borderColor: 'transparent' }}>
                <span className="hbe-badge-dot" style={{ background: c.dot }} />
                {eyebrow}
              </div>
            )}
            <h2 className="text-xl md:text-2xl font-extrabold tracking-[-0.02em] text-[var(--hbe-text)] leading-tight">
              {title}
            </h2>
            {subtitle && <div className="text-xs md:text-[13px] text-[var(--hbe-muted)] font-medium max-w-2xl leading-relaxed">{subtitle}</div>}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          {stats && stats.length > 0 && (
            <div className="flex items-center gap-5 rounded-2xl border border-(--hbe-line) bg-(--hbe-fill-soft) backdrop-blur-md px-5 sm:px-7 py-4">
              {stats.map((stat, i) => (
                <div key={stat.label} className="flex items-center gap-5">
                  {i > 0 && <div className="w-px h-9 bg-(--hbe-line)" />}
                  <div className="text-center sm:text-left">
                    <div
                      className={`text-lg xl:text-xl font-black tracking-tight ${
                        stat.tone === 'up' ? 'text-[#16A34A]' : stat.tone === 'down' ? 'text-[#DC2626]' : 'text-[var(--hbe-text)]'
                      }`}
                    >
                      {stat.value}
                    </div>
                    <div className="text-[10.5px] font-semibold tracking-[0.09em] uppercase text-[var(--hbe-muted)] mt-0.5">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      </div>
    </div>
  );
};

export default PageHeader;