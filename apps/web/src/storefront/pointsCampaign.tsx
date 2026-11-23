import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatNumber, type PointsCampaignShowcase } from '@tamas/shared';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { cn } from '../components/ui/cn';
import './pointsCampaign.css';

export const POINTS_CAMPAIGN_PATH = '/campaign';

/**
 * The points campaign with its leaderboard, or null when it is off. Polled
 * every 15 seconds while it runs, so the board moves live; the signed-in
 * customer's own standing comes with it.
 */
export function usePointsCampaign() {
  const userId = useAuth((state) => state.user?.id ?? null);
  return useQuery({
    queryKey: ['points-campaign', userId],
    queryFn: ({ signal }) => api.get<{ campaign: PointsCampaignShowcase | null }>('/catalog/points-campaign', undefined, signal),
    select: (data) => data.campaign,
    staleTime: 10_000,
    refetchInterval: (query) => (query.state.data?.campaign?.phase === 'running' ? 15_000 : 5 * 60_000),
  });
}

/** Shown while the campaign is announced or running. */
export function campaignVisible(campaign: PointsCampaignShowcase | null | undefined): campaign is PointsCampaignShowcase {
  return Boolean(campaign && (campaign.phase === 'upcoming' || campaign.phase === 'running'));
}

/** «+۱۵ امتیاز» on a product card while the campaign is visible. */
export function PointsBadge({ points, className }: { points: number; className?: string }) {
  const { data: campaign } = usePointsCampaign();
  if (points <= 0 || !campaignVisible(campaign)) return null;
  return (
    <span className={cn('sell-badge points-badge', className)} title={`${campaign.title}: هر عدد ${formatNumber(points)} امتیاز`}>
      ★ {formatNumber(points)} امتیاز
    </span>
  );
}

/** Header pill linking to the campaign page; hidden when the campaign is off or over without results. */
export function CampaignTab({ className }: { className?: string }) {
  const { data: campaign } = usePointsCampaign();
  const location = useLocation();
  if (!campaign || campaign.phase === 'unscheduled' || (campaign.phase === 'ended' && !campaign.winners)) return null;
  return (
    <Link
      to={POINTS_CAMPAIGN_PATH}
      className={cn('campaign-tab', className)}
      aria-current={location.pathname === POINTS_CAMPAIGN_PATH ? 'page' : undefined}
    >
      <span aria-hidden="true">🏆</span>
      <span>{campaign.phase === 'ended' ? 'برندگان کمپین' : 'کمپین امتیاز'}</span>
      {campaign.me && campaign.me.points > 0 && <span className="campaign-tab-points">{formatNumber(campaign.me.points)}</span>}
    </Link>
  );
}
