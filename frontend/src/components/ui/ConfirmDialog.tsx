import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const variants = {
    danger: {
      tile: 'bg-red-500/12 text-[#DC2626] border border-red-500/20',
      confirm: 'bg-[#DC2626] hover:bg-[#B91C1C]',
      glow: 'rgba(220,38,38,0.16)',
    },
    warning: {
      tile: 'bg-amber-500/12 text-[#D97706] border border-amber-500/20',
      confirm: 'bg-[#F59E0B] hover:bg-[#FBBF24] text-black',
      glow: 'rgba(245,158,11,0.16)',
    },
    info: {
      tile: 'bg-[#7C3AED]/12 text-[#7C3AED] border border-[#7C3AED]/20',
      confirm: 'bg-[#7C3AED] hover:bg-[#6D28D9]',
      glow: 'rgba(37,99,235,0.16)',
    },
  };
  const v = variants[variant];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div
        className="hbe-card hbe-card-hover w-full max-w-[420px] p-6 rounded-2xl"
        style={{ boxShadow: 'var(--hbe-shadow-float)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${v.tile}`}>
            <AlertTriangle size={20} />
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg text-[var(--hbe-muted)] hover:text-[var(--hbe-text)] hover:bg-(--hbe-fill) transition-colors">
            <X size={16} />
          </button>
        </div>
        <h3 className="text-[15px] font-bold text-[var(--hbe-text)] mt-3">{title}</h3>
        <p className="text-[13px] text-[var(--hbe-muted)] mt-1.5 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2.5 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-[13px] font-semibold text-[var(--hbe-text-soft)] bg-(--hbe-fill) border border-(--hbe-line) rounded-xl hover:bg-(--hbe-hover-fill) hover:text-[var(--hbe-text)] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-[13px] font-semibold text-white rounded-xl transition-colors shadow-lg ${v.confirm}`}
            style={{ boxShadow: `0 10px 30px ${v.glow}` }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;