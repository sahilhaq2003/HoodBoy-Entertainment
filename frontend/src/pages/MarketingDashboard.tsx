import React, { useState, useEffect, useCallback } from 'react';
import {
  Megaphone, Users, FileText, Calendar, AlertCircle, BarChart3,
  Eye, MousePointer, Crosshair
} from 'lucide-react';
import { dashboardApi } from '../services/api';
import { formatNumber, formatDate } from '../utils/helpers';
import DashboardHero from '../components/ui/DashboardHero';
import StatCard from '../components/ui/StatCard';
import Card from '../components/ui/Card';
import StatusBadge from '../components/ui/StatusBadge';
import PerformanceSnapshot from '../components/dashboard/PerformanceSnapshot';

interface KPIs {
  activeCampaigns: number;
  totalCampaigns: number;
  totalContacts: number;
  totalContentItems: number;
}

interface Campaign {
  id: string;
  name: string;
  artist: string;
  budget: number;
  spent: number;
  reach: number;
  impressions: number;
  progress: number;
  platforms: string[];
  startDate: string;
  endDate: string;
}

interface ContentItem {
  title: string;
  platform: string;
  scheduledDate: string;
  status: string;
  campaignName: string;
}

interface DashboardData {
  role: string;
  kpis: KPIs;
  campaigns: Campaign[];
  upcomingContent: ContentItem[];
}

const getPlatformStyle = (platform: string): { bg: string; color: string } => {
  const map: Record<string, { bg: string; color: string }> = {
    instagram: { bg: 'rgba(219,39,119,0.10)', color: '#DB2777' },
    tiktok: { bg: 'rgba(15,23,42,0.08)', color: '#1E293B' },
    youtube: { bg: 'rgba(220,38,38,0.10)', color: '#DC2626' },
    twitter: { bg: 'rgba(14,165,233,0.10)', color: '#0284C7' },
    facebook: { bg: 'rgba(124,58,237,0.12)', color: '#7C3AED' },
    spotify: { bg: 'rgba(22,163,74,0.10)', color: '#16A34A' },
    email: { bg: 'rgba(245,158,11,0.10)', color: '#D97706' },
  };
  return map[platform?.toLowerCase()] || { bg: 'rgba(107,114,128,0.08)', color: '#6B7280' };
};

const MarketingDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await dashboardApi.getRoleDashboard();
      setData(res.data.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-[3px] border-[#7C3AED]/30 border-t-[#7C3AED] rounded-full animate-spin" />
          <p className="text-sm font-medium text-[var(--hbe-muted)]">Loading marketing dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-3">
          <AlertCircle size={40} className="text-[#DC2626] mx-auto" />
          <p className="text-sm font-semibold text-[var(--hbe-text-soft)]">{error || 'No data available'}</p>
        </div>
      </div>
    );
  }

  const { kpis, campaigns, upcomingContent } = data;

  const avgProgress = campaigns.length > 0 ? campaigns.reduce((sum, c) => sum + (c.progress || 0), 0) / campaigns.length : 0;
  const reachable = campaigns.reduce((sum, c) => sum + (c.reach || 0), 0);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">

      <DashboardHero
        eyebrow="Growth & Engagement"
        title="Marketing Command Center"
        subtitle={`${kpis.activeCampaigns} active campaigns · ${kpis.totalContacts} contacts in play`}
        icon={<Crosshair size={22} />}
        accent="rose"
        onRefresh={() => load(true)}
        refreshing={refreshing}
        stats={[
          { label: 'Active Campaigns', value: kpis.activeCampaigns, tone: 'up' },
          { label: 'Content Items', value: kpis.totalContentItems, tone: 'neutral' },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Campaigns" value={kpis.activeCampaigns} icon={<Megaphone size={19} />} color="#DB2777" trend={`${kpis.totalCampaigns} total`} trendUp />
        <StatCard label="Total Campaigns" value={kpis.totalCampaigns} icon={<BarChart3 size={19} />} color="#7C3AED" />
        <StatCard label="Contacts" value={kpis.totalContacts} format={(n) => formatNumber(Math.round(n))} icon={<Users size={19} />} color="#16A34A" />
        <StatCard label="Content Items" value={kpis.totalContentItems} icon={<FileText size={19} />} color="#F59E0B" />
      </div>

      <PerformanceSnapshot
        description="Campaign momentum computed from live campaign data"
        metrics={[
          { label: 'Avg Campaign Progress', value: avgProgress, color: '#DB2777', note: `${campaigns.length} campaigns` },
          { label: 'Active Share', value: kpis.totalCampaigns > 0 ? (kpis.activeCampaigns / kpis.totalCampaigns) * 100 : 0, color: '#16A34A', note: `${kpis.activeCampaigns} active` },
          { label: 'Reach', value: reachable > 0 ? Math.min(100, reachable / Math.max(kpis.totalContacts, 1)) : 0, color: '#0EA5E9', note: `${formatNumber(reachable)} impressions` },
        ]}
      />

      <Card title="Active Campaigns" description="Reach, impressions, and budget velocity" icon={<Megaphone size={16} />} accent="rose" badge={campaigns.length}>
        {campaigns.length === 0 ? (
          <div className="text-center py-8">
            <Megaphone size={28} className="text-[var(--hbe-muted)] mx-auto mb-2" />
            <p className="text-xs text-[var(--hbe-muted)]">No campaigns yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="p-4 rounded-xl border border-(--hbe-line) bg-(--hbe-fill-soft) hover:bg-(--hbe-fill) transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--hbe-text)] truncate">{campaign.name}</p>
                    <p className="text-xs text-[var(--hbe-muted)] mt-0.5">{campaign.artist}</p>
                  </div>
                  <span className="text-xs font-bold shrink-0 ml-2" style={{ color: '#7C3AED' }}>{campaign.progress}%</span>
                </div>
                <div className="w-full h-2 bg-(--hbe-fill) rounded-full mb-3">
                  <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${campaign.progress}%`, background: 'linear-gradient(90deg,#7C3AED,#8B5CF6)' }} />
                </div>
                <div className="flex items-center gap-4 text-xs text-[var(--hbe-muted)] mb-3">
                  <span className="flex items-center gap-1.5"><Eye size={12} className="text-[#0EA5E9]" />{formatNumber(campaign.reach)}</span>
                  <span className="flex items-center gap-1.5"><MousePointer size={12} className="text-[#F59E0B]" />{formatNumber(campaign.impressions)}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {campaign.platforms?.map((platform, idx) => {
                    const s = getPlatformStyle(platform);
                    return (
                      <span key={idx} className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: s.bg, color: s.color }}>
                        {platform}
                      </span>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 mt-3 text-[11px] text-[var(--hbe-muted)]">
                  <Calendar size={11} />
                  <span>{formatDate(campaign.startDate)}</span>
                  <span className="text-[var(--hbe-muted)]">→</span>
                  <span>{formatDate(campaign.endDate)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Content Calendar" description="Scheduled posts across platforms" icon={<Calendar size={16} />} accent="amber" badge={upcomingContent.length}>
        {upcomingContent.length === 0 ? (
          <div className="text-center py-8">
            <Calendar size={28} className="text-[var(--hbe-muted)] mx-auto mb-2" />
            <p className="text-xs text-[var(--hbe-muted)]">No upcoming content</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="pb-3 pr-4">Title</th>
                  <th className="pb-3 pr-4">Platform</th>
                  <th className="pb-3 pr-4">Campaign</th>
                  <th className="pb-3 pr-4">Scheduled</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--hbe-divide)">
                {upcomingContent.map((item, idx) => {
                  const s = getPlatformStyle(item.platform);
                  return (
                    <tr key={idx} className="transition-colors hover:bg-(--hbe-hover-fill)">
                      <td className="py-3 pr-4 text-sm font-semibold text-[var(--hbe-text)] max-w-[250px] truncate">{item.title}</td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-bold" style={{ background: s.bg, color: s.color }}>
                          {item.platform}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-sm text-[var(--hbe-text-soft)]">{item.campaignName}</td>
                      <td className="py-3 pr-4 text-sm text-[var(--hbe-muted)]">{formatDate(item.scheduledDate)}</td>
                      <td className="py-3">
                        <StatusBadge status={item.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

    </div>
  );
};

export default MarketingDashboard;