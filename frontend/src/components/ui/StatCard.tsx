import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import AnimatedNumber from './AnimatedNumber';
import Sparkline from './Sparkline';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string;
  trend?: string;
  trendUp?: boolean;
  trendNote?: string;
  sparkline?: number[];
  format?: (n: number) => string;
  animated?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  color = '#7C3AED',
  trend,
  trendUp,
  trendNote,
  sparkline,
  format,
  animated = true,
}) => {
  const numeric = typeof value === 'number' && animated;

  return (
    <div className="metric-card hbe-card hbe-card-hover p-5 overflow-hidden relative group">
      <div
        className="absolute -top-12 -right-12 w-36 h-36 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
        style={{ background: `${color}1c` }}
      />
      <div className="flex items-center justify-between mb-3 relative">
        <div
          className="hbe-icon-tile w-10 h-10"
          style={{ background: `${color}14`, color, border: `1px solid ${color}22` }}
        >
          {icon}
        </div>
        {trend && (
          <span
            className={`inline-flex items-center gap-[3px] px-2 py-1 rounded-full text-[10.5px] font-bold ${
              trendUp ? 'bg-emerald-500/10 text-[#16A34A]' : 'bg-red-500/10 text-[#DC2626]'
            }`}
            title={trendNote}
          >
            {trendUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {trend}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-3 relative">
        <div className="min-w-0">
          {numeric ? (
            <AnimatedNumber
              value={value as number}
              format={format}
              className="text-[26px] font-extrabold tracking-[-0.035em] text-[var(--hbe-text)] leading-none"
            />
          ) : (
            <div className="text-[26px] font-extrabold tracking-[-0.035em] text-[var(--hbe-text)] leading-none">{value}</div>
          )}
          <div className="text-xs font-medium text-[var(--hbe-muted)] mt-2">{label}</div>
          {trendNote && !trend && <div className="text-[11px] text-[var(--hbe-muted)] mt-0.5">{trendNote}</div>}
        </div>
        {sparkline && sparkline.length >= 2 && (
          <Sparkline data={sparkline} color={color} className="shrink-0 -mb-1 opacity-90" />
        )}
      </div>
    </div>
  );
};

export default StatCard;