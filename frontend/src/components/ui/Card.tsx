import React from 'react';

export type HbeAccent = 'coral' | 'emerald' | 'violet' | 'sky' | 'amber' | 'rose' | 'slate';

export const accentColors: Record<HbeAccent, { text: string; bg: string; dot: string }> = {
  coral: { text: '#7C3AED', bg: 'rgba(124,58,237,0.10)', dot: '#7C3AED' },
  emerald: { text: '#16A34A', bg: 'rgba(22,163,74,0.10)', dot: '#16A34A' },
  violet: { text: '#7C3AED', bg: 'rgba(124,58,237,0.10)', dot: '#7C3AED' },
  sky: { text: '#0EA5E9', bg: 'rgba(14,165,233,0.10)', dot: '#0EA5E9' },
  amber: { text: '#D97706', bg: 'rgba(245,158,11,0.10)', dot: '#F59E0B' },
  rose: { text: '#DC2626', bg: 'rgba(220,38,38,0.09)', dot: '#DC2626' },
  slate: { text: '#6B7280', bg: 'rgba(107,114,128,0.10)', dot: '#9CA3AF' },
};

interface CardProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  accent?: HbeAccent;
  action?: React.ReactNode;
  badge?: string | number;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  hover?: boolean;
}

const Card: React.FC<CardProps> = ({
  title,
  description,
  icon,
  accent = 'slate',
  action,
  badge,
  children,
  className = '',
  bodyClassName = '',
  hover = true,
}) => {
  const c = accentColors[accent];
  return (
    <div className={`hbe-card ${hover ? 'hbe-card-hover' : ''} ${className}`}>
      {title && (
        <div className="hbe-card-header">
          {icon && (
            <div className="hbe-icon-tile" style={{ background: c.bg, color: c.text }}>
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="hbe-card-title truncate">{title}</div>
            {description && <div className="hbe-card-desc truncate">{description}</div>}
          </div>
          {badge !== undefined && badge !== null && <span className="hbe-badge">{badge}</span>}
          {action && <div className="ml-auto flex items-center gap-1.5">{action}</div>}
        </div>
      )}
      <div className={title ? `p-5 ${bodyClassName}` : `p-5 ${bodyClassName}`}>{children}</div>
    </div>
  );
};

export default Card;