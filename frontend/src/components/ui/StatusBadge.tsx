import React from 'react';
import { getStatusClass, getPriorityClass, formatStatus } from '../../utils/helpers';

interface StatusBadgeProps {
  status: string;
  type?: 'status' | 'priority';
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'status' }) => {
  const cls = type === 'priority' ? getPriorityClass(status) : getStatusClass(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 py-1 pl-2 pr-2.5 rounded-full text-[10.5px] font-bold tracking-wide whitespace-nowrap ${cls}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
      {formatStatus(status)}
    </span>
  );
};

export default StatusBadge;