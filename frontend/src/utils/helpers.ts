export const formatCurrency = (amount: number): string => {
  if (amount === null || amount === undefined || isNaN(amount)) return '$0';
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
};

export const formatNumber = (num: number): string => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toLocaleString();
};

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const daysUntil = (dateStr: string): number => {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = date.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

export const getStatusClass = (status: string): string => {
  const map: Record<string, string> = {
    completed: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/40',
    in_progress: 'bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800/40',
    not_started: 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700/40 dark:text-gray-400 dark:border-gray-700',
    delayed: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/40',
    waiting_approval: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40',
    active: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/40',
    released: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/40',
    planned: 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700/40 dark:text-gray-400 dark:border-gray-700',
    expired: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/40',
    upcoming: 'bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800/40',
    on_hold: 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800/40',
    inactive: 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700/40 dark:text-gray-400 dark:border-gray-700',
    approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/40',
    rejected: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/40',
    pending_approval: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40',
    draft: 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700/40 dark:text-gray-400 dark:border-gray-700',
    pending_signature: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40',
    renewed: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/40',
    terminated: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/40',
    submitted: 'bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800/40',
    in_preparation: 'bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800/40',
    scheduled: 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700/40 dark:text-gray-400 dark:border-gray-700',
    cancelled: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/40',
    paused: 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800/40',
  };
  return map[status] || 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700/40 dark:text-gray-400 dark:border-gray-700';
};

export const getPriorityClass = (priority: string): string => {
  const map: Record<string, string> = {
    critical: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/40',
    high: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40',
    medium: 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800/40',
    low: 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700/40 dark:text-gray-400 dark:border-gray-700',
  };
  return map[priority] || 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700/40 dark:text-gray-400 dark:border-gray-700';
};

export const formatStatus = (status: string): string => {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

export const getInitials = (name: string): string => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

export const getAvatarColor = (name: string): string => {
  const colors = [
    '#4F46E5',
    '#7C3AED',
    '#7C3AED',
    '#059669',
    '#DC2626',
    '#D97706',
    '#EC4899',
    '#0891B2',
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
};
