import React from 'react';
import { Music, DollarSign, TrendingUp, Calendar, FileText, ArrowUpRight, Edit2, Trash2, Disc3 } from 'lucide-react';
import type { Artist } from '../../types';
import StatusBadge from '../ui/StatusBadge';
import OnboardingProgress from '../onboarding/OnboardingProgress';
import { formatCurrency, formatNumber, formatDate, getInitials, getAvatarColor } from '../../utils/helpers';

interface ArtistCardProps {
  artist: Artist;
  onOpen: (artist: Artist) => void;
  onDelete: (id: string) => void;
}

const ArtistCard: React.FC<ArtistCardProps> = ({ artist, onOpen, onDelete }) => {
  const displayName = artist.artistName || artist.stageName || artist.name;
  const name = displayName || 'Artist';
  const color = getAvatarColor(name);
  const hasDocs = artist.documents && artist.documents.length > 0;
  const contractExpired = artist.contractEnd && new Date(artist.contractEnd).getTime() < Date.now();

  return (
    <div
      className="group relative bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm hover:shadow-[0_24px_50px_-16px_rgba(79,70,229,0.28)] hover:border-gray-300 dark:hover:border-gray-600 hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col"
      onClick={() => onOpen(artist)}
    >
      {/* Cover banner */}
      <div
        className="relative h-20 flex-shrink-0 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}99 55%, ${color}44 100%)` }}
      >
        <div className="absolute -right-10 -top-12 w-40 h-40 rounded-full border border-white/20" />
        <div className="absolute -right-3 -top-6 w-24 h-24 rounded-full border border-white/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-white/10" />
        <Disc3 size={84} strokeWidth={1} className="absolute -bottom-5 -right-4 text-white/15" />

        <div className="absolute top-2.5 right-2.5 z-20">
          <StatusBadge status={artist.status} />
        </div>

        <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => { e.stopPropagation(); onOpen(artist); }}
            className="w-7 h-7 rounded-lg bg-black/25 text-white hover:bg-black/45 backdrop-blur-sm flex items-center justify-center transition-all"
            title="View / Edit"
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(artist._id); }}
            className="w-7 h-7 rounded-lg bg-black/25 text-white hover:bg-red-500/80 backdrop-blur-sm flex items-center justify-center transition-all"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Avatar overlap */}
      <div className="relative -mt-8 px-5">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-lg font-bold ring-4 ring-white dark:ring-gray-800 shadow-lg overflow-hidden"
          style={{ background: color }}
        >
          {artist.image ? (
            <img src={artist.image} alt={name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
          ) : (
            getInitials(name)
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-5 pt-3 pb-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-gray-900 dark:text-gray-100 leading-snug truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {name}
            </h3>
            {artist.name && artist.name !== displayName && (
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{artist.name}</p>
            )}
          </div>
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 -translate-y-0.5 group-hover:translate-y-0 flex items-center justify-center flex-shrink-0 transition-all duration-200">
            <ArrowUpRight size={15} />
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700/40 text-gray-500 dark:text-gray-400 text-[11px] font-medium">
            <Music size={11} /> {artist.genre || 'No genre'}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <div className="rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700/60 px-3 py-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-5 h-5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                <TrendingUp size={11} />
              </div>
              <span className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Streams</span>
            </div>
            <div className="text-[15px] font-bold text-gray-900 dark:text-gray-100 tabular-nums">{formatNumber(artist.totalStreams || 0)}</div>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700/60 px-3 py-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-5 h-5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                <DollarSign size={11} />
              </div>
              <span className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Revenue</span>
            </div>
            <div className="text-[15px] font-bold text-gray-900 dark:text-gray-100 tabular-nums">{formatCurrency(artist.totalRevenue || 0)}</div>
          </div>
        </div>

        {/* Onboarding */}
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/60">
          <OnboardingProgress currentStep={artist.onboardingStep} onboardingStatus={artist.onboardingStatus} compact />
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 pb-4 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 gap-2">
        {artist.contractEnd ? (
          <span className="flex items-center gap-1.5 min-w-0">
            <Calendar size={11} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
            <span className="truncate">
              {contractExpired ? (
                <span className="text-red-500 font-semibold">Ended <span className="font-medium">{formatDate(artist.contractEnd)}</span></span>
              ) : (
                <>Ends <span className="font-semibold text-gray-700 dark:text-gray-200">{formatDate(artist.contractEnd)}</span></>
              )}
            </span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <Calendar size={11} className="text-gray-400 dark:text-gray-500" />
            No contract
          </span>
        )}
        {hasDocs && (
          <span className="flex items-center gap-1 flex-shrink-0">
            <FileText size={11} className="text-gray-400 dark:text-gray-500" />
            {artist.documents!.length} doc{artist.documents!.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
};

export default ArtistCard;
