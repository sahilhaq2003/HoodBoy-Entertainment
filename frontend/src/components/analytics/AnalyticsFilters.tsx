import React from 'react';
import { Calendar, Filter, X } from 'lucide-react';

export interface AnalyticsFiltersState {
  startDate: string;
  endDate: string;
  artistId: string;
  releaseId: string;
  campaignType: string;
  period: string;
  revenueSource: string;
}

interface AnalyticsFiltersProps {
  filters: AnalyticsFiltersState;
  onChange: (filters: AnalyticsFiltersState) => void;
  artists?: { _id: string; displayName: string }[];
  releases?: { _id: string; title: string }[];
  showArtistFilter?: boolean;
  showReleaseFilter?: boolean;
  showCampaignFilter?: boolean;
  showSourceFilter?: boolean;
  showPeriodFilter?: boolean;
}

const PERIODS = [
  { value: '', label: 'All Time' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];

const CAMPAIGN_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'email', label: 'Email' },
  { value: 'radio', label: 'Radio' },
  { value: 'pr', label: 'PR' },
  { value: 'influencer', label: 'Influencer' },
  { value: 'paid_ads', label: 'Paid Ads' },
  { value: 'event', label: 'Event' },
  { value: 'content', label: 'Content' },
  { value: 'sync', label: 'Sync' },
  { value: 'brand', label: 'Brand' },
  { value: 'other', label: 'Other' },
];

const REVENUE_SOURCES = [
  { value: '', label: 'All Sources' },
  { value: 'streaming_revenue', label: 'Streaming' },
  { value: 'royalty_income', label: 'Royalty Income' },
  { value: 'sync_licensing', label: 'Sync Licensing' },
  { value: 'merchandise', label: 'Merchandise' },
  { value: 'touring_live', label: 'Touring/Live' },
  { value: 'brand_partnerships', label: 'Brand Partnerships' },
  { value: 'publishing_income', label: 'Publishing' },
  { value: 'digital_sales', label: 'Digital Sales' },
  { value: 'physical_sales', label: 'Physical Sales' },
];

const AnalyticsFilters: React.FC<AnalyticsFiltersProps> = ({
  filters,
  onChange,
  artists = [],
  releases = [],
  showArtistFilter = true,
  showReleaseFilter = false,
  showCampaignFilter = false,
  showSourceFilter = false,
  showPeriodFilter = true,
}) => {
  const hasActiveFilters = filters.startDate || filters.artistId || filters.releaseId || filters.campaignType || filters.revenueSource || (filters.period && filters.period !== '');

  const update = (partial: Partial<AnalyticsFiltersState>) => {
    onChange({ ...filters, ...partial });
  };

  const clearFilters = () => {
    onChange({
      startDate: '',
      endDate: '',
      artistId: '',
      releaseId: '',
      campaignType: '',
      period: '',
      revenueSource: '',
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">Filters</span>
          {hasActiveFilters && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
              Active
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1 transition-colors"
          >
            <X size={12} />
            Clear all
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {showPeriodFilter && (
          <select
            value={filters.period}
            onChange={(e) => update({ period: e.target.value })}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            {PERIODS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        )}

        {filters.period === 'custom' && (
          <>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-gray-400" />
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => update({ startDate: e.target.value })}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-gray-400 text-sm">to</span>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => update({ endDate: e.target.value })}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </>
        )}

        {showArtistFilter && artists.length > 0 && (
          <select
            value={filters.artistId}
            onChange={(e) => update({ artistId: e.target.value })}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Artists</option>
            {artists.map(a => (
              <option key={a._id} value={a._id}>{a.displayName}</option>
            ))}
          </select>
        )}

        {showReleaseFilter && releases.length > 0 && (
          <select
            value={filters.releaseId}
            onChange={(e) => update({ releaseId: e.target.value })}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Releases</option>
            {releases.map(r => (
              <option key={r._id} value={r._id}>{r.title}</option>
            ))}
          </select>
        )}

        {showCampaignFilter && (
          <select
            value={filters.campaignType}
            onChange={(e) => update({ campaignType: e.target.value })}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            {CAMPAIGN_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        )}

        {showSourceFilter && (
          <select
            value={filters.revenueSource}
            onChange={(e) => update({ revenueSource: e.target.value })}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            {REVENUE_SOURCES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
};

export default AnalyticsFilters;
