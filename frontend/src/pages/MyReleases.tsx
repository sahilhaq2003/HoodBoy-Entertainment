import React, { useEffect, useState } from 'react';
import { Disc3, Calendar, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { dashboardApi } from '../services/api';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import StatusBadge from '../components/ui/StatusBadge';
import { formatDate } from '../utils/helpers';

interface ReleaseRow {
  _id: string;
  title: string;
  releaseDate: string;
  status: string;
  type: string;
  currentPhase: string;
}

const PHASE_LABELS: Record<string, string> = {
  preparation: 'Preparation', distribution: 'Distribution', marketing: 'Marketing',
  post_release: 'Post-Release', completed: 'Completed',
};

const MyReleases: React.FC = () => {
  const [releases, setReleases] = useState<ReleaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.getRoleDashboard()
      .then((res) => setReleases(res.data.data?.releases || []))
      .catch(() => toast.error('Failed to load your releases'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-16"><LoadingSpinner size={28} text="Loading your releases..." /></div>;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Disc3 size={18} /> My Releases</h1>
        <p className="text-xs text-gray-500 mt-0.5">Your singles, EPs, and albums</p>
      </div>

      {releases.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-12 text-center">
          <Disc3 size={40} className="mx-auto text-gray-300 dark:text-gray-700 mb-3" />
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No releases yet</p>
          <p className="text-xs text-gray-500 mt-1">Your releases will appear here once scheduled.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {releases.map((r) => (
              <div key={r._id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-50 text-violet-600 flex-shrink-0">
                  <Disc3 size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{r.title}</div>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-gray-500">
                    <span className="uppercase text-[10px] font-bold text-gray-400">{r.type}</span>
                    {r.releaseDate && <span className="flex items-center gap-1"><Calendar size={10} />{formatDate(r.releaseDate)}</span>}
                    {r.currentPhase && <span className="flex items-center gap-1"><Clock size={10} />{PHASE_LABELS[r.currentPhase] || r.currentPhase}</span>}
                  </div>
                </div>
                <div className="w-28 flex justify-end">
                  <StatusBadge status={r.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MyReleases;