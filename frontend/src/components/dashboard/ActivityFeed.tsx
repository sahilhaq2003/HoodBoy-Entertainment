import React from 'react';
import { Calendar, Music, FileText, Clock } from 'lucide-react';
import { formatDate, daysUntil } from '../../utils/helpers';
import Card from '../ui/Card';

interface ActivityItem {
  id: string;
  title: string;
  date: string;
  type: 'task' | 'release' | 'contract' | 'campaign';
  status?: string;
  priority?: string;
  assignee?: string;
  artist?: string;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  title: string;
  accent?: 'coral' | 'emerald' | 'violet' | 'sky' | 'amber' | 'rose' | 'slate';
}

const ICON_STYLES: Record<string, { color: string; bg: string; dot: string }> = {
  task: { color: '#7C3AED', bg: 'rgba(124,58,237,0.12)', dot: '#7C3AED' },
  release: { color: '#0EA5E9', bg: 'rgba(14,165,233,0.12)', dot: '#0EA5E9' },
  contract: { color: '#D97706', bg: 'rgba(245,158,11,0.12)', dot: '#F59E0B' },
  campaign: { color: '#DB2777', bg: 'rgba(219,39,119,0.12)', dot: '#DB2777' },
};

const ActivityFeed: React.FC<ActivityFeedProps> = ({ items, title, accent = 'slate' }) => {
  const getType = (type: string): keyof typeof ICON_STYLES => {
    if (type in ICON_STYLES) return type as keyof typeof ICON_STYLES;
    return 'task';
  };

  const getIcon = (type: string) => {
    const s = ICON_STYLES[getType(type)];
    switch (type) {
      case 'release': return <Music size={13.5} style={{ color: s.color }} />;
      case 'contract': return <FileText size={13.5} style={{ color: s.color }} />;
      case 'campaign': return <Calendar size={13.5} style={{ color: s.color }} />;
      default: return <Clock size={13.5} style={{ color: s.color }} />;
    }
  };

  return (
    <Card title={title} accent={accent}>
      {items.length === 0 ? (
        <p className="text-xs text-[var(--hbe-muted)] text-center py-8">No upcoming items</p>
      ) : (
        <div className="space-y-1">
          {items.map((item) => {
            const days = daysUntil(item.date);
            const s = ICON_STYLES[getType(item.type)];
            return (
              <div key={item.id} className="flex items-start gap-3 group rounded-lg px-2 py-2 -mx-2 transition-colors hover:bg-(--hbe-hover-fill)">
                <div className="flex flex-col items-center">
                  <div className="w-[9px] h-[9px] rounded-full mt-1.5 flex-shrink-0" style={{ background: s.dot, boxShadow: `0 0 0 3px ${s.bg}` }} />
                  <div className="w-px h-full bg-(--hbe-line) mt-1.5" />
                </div>
                <div className="flex-1 min-w-0 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="hbe-icon-tile" style={{ background: s.bg, width: 24, height: 24, borderRadius: 7, color: s.color }}>
                      {getIcon(item.type)}
                    </span>
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider shrink-0"
                      style={{ color: s.color }}
                    >
                      {getType(item.type)}
                    </span>
                    <span className="text-xs font-semibold text-[var(--hbe-text)] truncate">{item.title}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10.5px] text-[var(--hbe-muted)]">{formatDate(item.date)}</span>
                    {item.artist && <span className="text-[10.5px] text-[var(--hbe-muted)]">· {item.artist}</span>}
                    {item.assignee && <span className="text-[10.5px] text-[var(--hbe-muted)]">· {item.assignee}</span>}
                  </div>
                  {days >= 0 && days <= 7 && (
                    <span
                      className={`text-[10px] font-bold mt-1 inline-block px-1.5 py-[1px] rounded-full ${
                        days <= 3
                          ? 'bg-red-500/10 text-[#DC2626]'
                          : 'bg-amber-500/10 text-[#F59E0B]'
                      }`}
                    >
                      {days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due in ${days} days`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default ActivityFeed;