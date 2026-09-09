import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import AnimatedNumber from '../ui/AnimatedNumber';
import Sparkline from '../ui/Sparkline';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  change?: string;
  changeType?: 'up' | 'down' | 'neutral';
  subtitle?: string;
  sparkline?: number[];
  format?: (n: number) => string;
  animated?: boolean;
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  icon,
  color,
  change,
  changeType = 'neutral',
  subtitle,
  sparkline,
  format,
  animated = true,
}) => {
  const ChangeIcon = changeType === 'up' ? TrendingUp : changeType === 'down' ? TrendingDown : Minus;
  const changeColor = changeType === 'up' ? '#16A34A' : changeType === 'down' ? '#DC2626' : '#6B7280';
  const changeBg = changeType === 'up' ? 'rgba(22,163,74,0.12)' : changeType === 'down' ? 'rgba(220,38,38,0.10)' : 'var(--hbe-fill)';
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
        {change && (
          <div className="flex items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-[10.5px] font-bold"
              style={{ background: changeBg, color: changeColor }}
            >
              <ChangeIcon size={11} />
              {change}
            </span>
          </div>
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
          <div className="text-xs font-medium text-[var(--hbe-muted)] mt-2">{title}</div>
          {subtitle && <div className="text-[11px] text-[var(--hbe-muted)] mt-0.5">{subtitle}</div>}
        </div>
        {sparkline && sparkline.length >= 2 && (
          <Sparkline data={sparkline} color={color} className="shrink-0 -mb-1 opacity-90" />
        )}
      </div>
    </div>
  );
};

export default KPICard;