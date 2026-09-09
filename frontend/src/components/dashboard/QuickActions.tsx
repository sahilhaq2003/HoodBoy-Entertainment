import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Radio, DollarSign, CheckSquare, FileText, TrendingUp, Settings } from 'lucide-react';

const actions = [
  { label: 'Create Task', icon: <CheckSquare size={18} />, path: '/tasks', color: '#7C3AED', bg: 'rgba(124,58,237,0.12)' },
  { label: 'Add Artist', icon: <Users size={18} />, path: '/artists/new', color: '#16A34A', bg: 'rgba(22,163,74,0.12)' },
  { label: 'New Release', icon: <Radio size={18} />, path: '/releases', color: '#7C3AED', bg: 'rgba(124,58,237,0.12)' },
  { label: 'Record Payment', icon: <DollarSign size={18} />, path: '/finance', color: '#D97706', bg: 'rgba(245,158,11,0.12)' },
  { label: 'New Contract', icon: <FileText size={18} />, path: '/contracts', color: '#0EA5E9', bg: 'rgba(14,165,233,0.12)' },
  { label: 'Analytics', icon: <TrendingUp size={18} />, path: '/analytics', color: '#DC2626', bg: 'rgba(220,38,38,0.12)' },
  { label: 'Settings', icon: <Settings size={18} />, path: '/settings', color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
];

const QuickActions: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
      {actions.map((action) => (
        <button
          key={action.path}
          onClick={() => navigate(action.path)}
          className="quick-action-card hbe-card hbe-card-hover flex flex-col items-center justify-center gap-2.5 py-6 transition-all duration-200 group"
        >
          <div
            className="hbe-icon-tile w-11 h-11 transition-transform duration-200 group-hover:scale-110"
            style={{ background: action.bg, color: action.color }}
          >
            {action.icon}
          </div>
          <span className="text-xs font-semibold text-[var(--hbe-text-soft)] group-hover:text-[var(--hbe-text)] transition-colors">
            {action.label}
          </span>
        </button>
      ))}
    </div>
  );
};

export default QuickActions;