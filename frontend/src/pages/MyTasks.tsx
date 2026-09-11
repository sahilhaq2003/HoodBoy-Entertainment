import React, { useEffect, useState } from 'react';
import { CheckSquare, Calendar, AlertCircle, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { dashboardApi } from '../services/api';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import StatusBadge from '../components/ui/StatusBadge';
import { formatDate } from '../utils/helpers';

interface TaskRow {
  id: string;
  title: string;
  deadline: string;
  status: string;
  priority: string;
  assignedBy: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: '#6B7280', medium: '#06B6D4', high: '#F59E0B', critical: '#EF4444',
};

const MyTasks: React.FC = () => {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.getRoleDashboard()
      .then((res) => setTasks(res.data.data?.tasks || []))
      .catch(() => toast.error('Failed to load your tasks'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-16"><LoadingSpinner size={28} text="Loading your tasks..." /></div>;
  }

  const isOverdue = (t: TaskRow) => t.deadline && ['not_started', 'in_progress', 'blocked', 'delayed'].includes(t.status) && new Date(t.deadline) < new Date();

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><CheckSquare size={18} /> My Tasks</h1>
        <p className="text-xs text-gray-500 mt-0.5">Tasks assigned to you</p>
      </div>

      {tasks.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-12 text-center">
          <CheckSquare size={40} className="mx-auto text-gray-300 dark:text-gray-700 mb-3" />
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No tasks assigned</p>
          <p className="text-xs text-gray-500 mt-1">Tasks assigned to you will show up here.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors">
                <div className="w-1.5 self-stretch rounded-full flex-shrink-0" style={{ background: PRIORITY_COLORS[t.priority] || '#6B7280' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{t.title}</span>
                    {isOverdue(t) && <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-red-50 dark:bg-red-500/10 text-red-600 rounded-full"><AlertCircle size={10} />Overdue</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-xs text-gray-500">
                    {t.deadline && <span className="flex items-center gap-1"><Calendar size={10} />{formatDate(t.deadline)}</span>}
                    {t.assignedBy && <span className="flex items-center gap-1"><User size={10} />By {t.assignedBy}</span>}
                  </div>
                </div>
                <div className="w-28 flex justify-end">
                  <StatusBadge status={t.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MyTasks;