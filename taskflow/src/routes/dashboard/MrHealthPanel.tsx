/**
 * MrHealthPanel — DASH-02
 *
 * Shows the current user's open MR health summary:
 * Needs Review / Approved / Changes Requested counts.
 *
 * Reads from the 3-element cache key ['gitlab-mrs', gitlabBaseUrl, userId] shared
 * with MyTasksTab. Per-MR health is read from ['mr-health', project_id, iid] entries
 * populated by MyTasksTab. Undefined health entries → Needs Review.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { GitLabMR } from '@/services/gitlab';
import { fetchAssignedMRs, fetchReviewerMRs } from '@/services/gitlab';
import { useAuthStore } from '@/stores/auth.store';

export interface MrHealthPanelProps {
  gitlabBaseUrl: string;
  gitlabToken: string;
  /** True while the parent is still reading the token from Stronghold. */
  tokenLoading?: boolean;
}

export default function MrHealthPanel({
  gitlabBaseUrl,
  gitlabToken,
  tokenLoading = false,
}: MrHealthPanelProps) {
  const queryClient = useQueryClient();

  // Use persisted GitLab user ID from auth store — avoids a validateGitLab round-trip
  // on every mount. The ID is stored during onboarding and token update.
  const userId = useAuthStore((s) => s.gitlabUserId) ?? undefined;

  const { data: mrQueryData, isLoading } = useQuery({
    queryKey: ['gitlab-mrs', gitlabBaseUrl, userId],
    queryFn: async () => {
      const token = gitlabToken ?? '';
      const [assigned, reviewer] = await Promise.all([
        fetchAssignedMRs(gitlabBaseUrl!, token),
        userId ? fetchReviewerMRs(gitlabBaseUrl!, token, userId) : Promise.resolve([]),
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

  const assignedMrs: GitLabMR[] = mrQueryData?.filtered ?? [];

  const counts = { needsReview: 0, approved: 0, changesRequested: 0 };
  for (const mr of assignedMrs) {
    const health = queryClient.getQueryData<string>(['mr-health', mr.project_id, mr.iid]);
    if (health === 'approved') counts.approved++;
    else if (health === 'changes_requested') counts.changesRequested++;
    else counts.needsReview++;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 min-h-[160px]">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        MR Health
      </h2>

      {/* Skeleton — shown while Stronghold token is fetching OR while query is in-flight */}
      {(tokenLoading || isLoading) && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-5 rounded bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {!tokenLoading && !isLoading && assignedMrs.length === 0 && (
        <p className="text-sm text-muted-foreground">No open MRs</p>
      )}

      {!tokenLoading && !isLoading && assignedMrs.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-sm">
            <span>Needs Review</span>
            <span className="font-semibold">{counts.needsReview}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Approved</span>
            <span className="font-semibold text-green-600">{counts.approved}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Changes Requested</span>
            <span className="font-semibold text-amber-600">{counts.changesRequested}</span>
          </div>
        </div>
      )}
    </div>
  );
}
