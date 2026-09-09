import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-(--hbe-fill) border border-(--hbe-line) flex items-center justify-center mb-4">
        <span className="text-[var(--hbe-muted)]">{icon || <Inbox size={26} />}</span>
      </div>
      <h3 className="text-sm font-semibold text-[var(--hbe-text)] mb-1">{title}</h3>
      <p className="text-xs text-[var(--hbe-muted)] max-w-xs">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

export default EmptyState;