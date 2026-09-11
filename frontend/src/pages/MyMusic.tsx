import React, { useEffect, useState } from 'react';
import { Music, AlertCircle, Headphones, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { dashboardApi } from '../services/api';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import StatusBadge from '../components/ui/StatusBadge';
import { formatNumber, formatDate } from '../utils/helpers';

interface SongRow {
  _id: string;
  title: string;
  status: string;
  genre: string;
  streams: number;
  revenue: number;
  createdAt: string;
}

const MyMusic: React.FC = () => {
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.getRoleDashboard()
      .then((res) => setSongs(res.data.data?.songs || []))
      .catch(() => toast.error('Failed to load your music'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-16"><LoadingSpinner size={28} text="Loading your music..." /></div>;
  }

  const totalStreams = songs.reduce((s, x) => s + (x.streams || 0), 0);
  const totalRevenue = songs.reduce((s, x) => s + (x.revenue || 0), 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Music size={18} /> My Music</h1>
          <p className="text-xs text-gray-500 mt-0.5">Your songs in the label catalog</p>
        </div>
        {songs.length > 0 && (
          <div className="flex gap-3">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-2">
              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Streams</div>
              <div className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatNumber(totalStreams)}</div>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-2">
              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Revenue</div>
              <div className="text-sm font-bold text-emerald-600">${formatNumber(Math.round(totalRevenue))}</div>
            </div>
          </div>
        )}
      </div>

      {songs.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-12 text-center">
          <Music size={40} className="mx-auto text-gray-300 dark:text-gray-700 mb-3" />
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No songs yet</p>
          <p className="text-xs text-gray-500 mt-1">Your songs will appear here once they are in the catalog.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {songs.map((song) => (
              <div key={song._id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-50 text-indigo-600 flex-shrink-0">
                  <Headphones size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{song.title}</div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                    {song.genre && <span>{song.genre}</span>}
                    {song.createdAt && <span className="flex items-center gap-1"><AlertCircle size={10} />Added {formatDate(song.createdAt)}</span>}
                  </div>
                </div>
                <div className="text-right text-xs hidden sm:block">
                  <div className="font-semibold text-gray-700 dark:text-gray-200">{formatNumber(song.streams || 0)} streams</div>
                  <div className="text-emerald-600 font-medium">${formatNumber(Math.round(song.revenue || 0))}</div>
                </div>
                <div className="w-28 flex justify-end">
                  <StatusBadge status={song.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MyMusic;