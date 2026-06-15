'use no memo';

/**
 * MrReviewQueue — Phase 84 DASH-06/07
 *
 * Two-group MR review queue derived client-side from the warm gitlab-mrs cache.
 * Cache key ['gitlab-mrs', gitlabBaseUrl, userId] MUST MATCH MrHealthPanel exactly
 * so the two components share a single cache entry — no duplicate fetch (D-13).
 *
 * Groups (via groupMrsByRole from dashboardMetrics — never inlined):
 *   - Awaiting my review: reviewer, NOT author (excludes self-authored — Pitfall 3)
 *   - My open MRs: I am author
 *
 * MR row uses the overlay-button-sibling pattern (per project memory):
 * relative container + absolute inset-0 button + health badge as SIBLING (not child).
 *
 * External URL opens via Tauri openUrl — never window.open (blocked in Tauri webview).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { openUrl } from '@tauri-apps/plugin-opener';
import { GitMerge, Plug } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import type { GitLabMR } from '@/services/gitlab';
import { fetchAssignedMRs, fetchReviewerMRs } from '@/services/gitlab';
import { useAuthStore } from '@/stores/auth.store';
import { groupMrsByRole } from './dashboardMetrics';

export interface MrReviewQueueProps {
  gitlabBaseUrl: string;
  gitlabToken: string;
  /** True while the parent is still reading the token from Stronghold (Pitfall 4). */
  tokenLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Health badge — dot + text label always paired (accessibility: never color alone).
// ---------------------------------------------------------------------------

type HealthStatus = 'approved' | 'changes_requested' | 'needs_review';

function resolveHealth(raw: string | undefined): HealthStatus {
  if (raw === 'approved') return 'approved';
  if (raw === 'changes_requested') return 'changes_requested';
  return 'needs_review';
}

interface HealthBadgeProps {
  status: HealthStatus;
}

function HealthBadge({ status }: HealthBadgeProps) {
  if (status === 'approved') {
    return (
      <span className="flex items-center gap-1 text-xs shrink-0">
        <span className="size-2 rounded-full bg-green-500" aria-hidden />
        <span className="text-green-600">Approved</span>
      </span>
    );
  }
  if (status === 'changes_requested') {
    return (
      <span className="flex items-center gap-1 text-xs shrink-0">
        <span className="size-2 rounded-full bg-destructive" aria-hidden />
        <span className="text-destructive">Changes requested</span>
      </span>
    );
  }
  // needs_review (default for undefined health)
  return (
    <span className="flex items-center gap-1 text-xs shrink-0">
      <span className="size-2 rounded-full bg-amber-500" aria-hidden />
      <span className="text-amber-600">Needs review</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// MR row — overlay-button-sibling pattern (project memory: overlay_button_nested_interactive)
// ---------------------------------------------------------------------------

interface MrRowProps {
  mr: GitLabMR;
  health: HealthStatus;
}

function MrRow({ mr, health }: MrRowProps) {
  return (
    <div className="relative flex items-center gap-2 py-2 hover:bg-muted/50 rounded cursor-pointer">
      {/* Overlay button covers the full row — sibling of health badge (not parent) */}
      <button
        type="button"
        className="absolute inset-0 rounded"
        aria-label={mr.title}
        onClick={() => openUrl(mr.web_url)}
      />
      <span className="text-sm truncate flex-1 pr-0.5">{mr.title}</span>
      {/* Health badge AFTER the overlay button — sibling, not nested inside the button */}
      <HealthBadge status={health} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group — label + MR rows
// ---------------------------------------------------------------------------

interface MrGroupProps {
  label: string;
  mrs: GitLabMR[];
  getHealth: (mr: GitLabMR) => HealthStatus;
}

function MrGroup({ label, mrs, getHealth }: MrGroupProps) {
  if (mrs.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      {mrs.map((mr) => (
        <MrRow key={`${mr.project_id}-${mr.iid}`} mr={mr} health={getHealth(mr)} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function MrReviewQueue({
  gitlabBaseUrl,
  gitlabToken,
  tokenLoading = false,
}: MrReviewQueueProps) {
  const queryClient = useQueryClient();

  // Use persisted GitLab user ID from auth store — avoids a validateGitLab round-trip.
  // Safe to read from store inside component (userId is not a token — D-16 exception).
  const userId = useAuthStore((s) => s.gitlabUserId) ?? undefined;

  // Cache key MUST MATCH MrHealthPanel exactly: ['gitlab-mrs', gitlabBaseUrl, userId]
  // Same queryFn: fetchAssignedMRs + fetchReviewerMRs deduped into { filtered, merged }
  // This makes MrReviewQueue and MrHealthPanel share the same cache entry — no extra fetch (D-13).
  const { data: mrQueryData, isLoading } = useQuery({
    queryKey: ['gitlab-mrs', gitlabBaseUrl, userId],
    queryFn: async () => {
      const token = gitlabToken ?? '';
      const [assigned, reviewer] = await Promise.all([
        fetchAssignedMRs(gitlabBaseUrl ?? '', token),
        userId ? fetchReviewerMRs(gitlabBaseUrl ?? '', token, userId) : Promise.resolve([]),
      ]);
      const seen = new Set<number>();
      const merged = [...assigned, ...reviewer].filter(
        (mr) => !seen.has(mr.iid) && seen.add(mr.iid),
      );
      return { filtered: merged, merged };
    },
    staleTime: 30_000,
    enabled: !!gitlabBaseUrl && !!gitlabToken && !!userId,
  });

  const showSkeleton = useDelayedLoading(isLoading);

  const allMrs: GitLabMR[] = mrQueryData?.filtered ?? [];
  const { awaitingReview, myOpen } = groupMrsByRole(allMrs, userId);

  // Per-MR health: imperative getQueryData is acceptable here — MrReviewQueue renders
  // at mount time; no reactive re-render needed when health changes between renders.
  function getHealth(mr: GitLabMR): HealthStatus {
    const raw = queryClient.getQueryData<string>(['mr-health', mr.project_id, mr.iid]);
    return resolveHealth(raw);
  }

  return (
    <div
      role="region"
      aria-label="MR review queue"
      className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 min-h-[160px]"
    >
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        MR review queue
      </h2>

      {/* Skeleton — shown while Stronghold token is fetching OR query is in-flight */}
      {(tokenLoading || showSkeleton) && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-5 rounded" />
          ))}
        </div>
      )}

      {/* GitLab not connected — tokenLoading resolved + no credentials */}
      {!tokenLoading && !showSkeleton && (!gitlabBaseUrl || !gitlabToken) && (
        <EmptyState
          icon={Plug}
          title="GitLab not connected"
          subtitle="Connect GitLab in Settings to see your MR queue."
        />
      )}

      {/* Empty queue — both groups have no MRs */}
      {!tokenLoading &&
        !showSkeleton &&
        !!gitlabBaseUrl &&
        !!gitlabToken &&
        awaitingReview.length === 0 &&
        myOpen.length === 0 && (
          <EmptyState
            icon={GitMerge}
            title="No MRs awaiting review"
            subtitle="You're all caught up."
          />
        )}

      {/* Two-group MR list */}
      {!tokenLoading &&
        !showSkeleton &&
        !!gitlabBaseUrl &&
        !!gitlabToken &&
        (awaitingReview.length > 0 || myOpen.length > 0) && (
          <div className="flex flex-col gap-3">
            <MrGroup label="Awaiting my review" mrs={awaitingReview} getHealth={getHealth} />
            <MrGroup label="My open MRs" mrs={myOpen} getHealth={getHealth} />
          </div>
        )}
    </div>
  );
}
