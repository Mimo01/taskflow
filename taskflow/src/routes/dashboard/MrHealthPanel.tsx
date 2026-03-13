/**
 * MrHealthPanel — DASH-02
 *
 * Shows the current user's open MR health summary:
 * Needs Review / Approved / Changes Requested counts.
 *
 * Reads from the 3-element cache key ['gitlab-mrs', gitlabBaseUrl, userId] shared
 * with MrAttentionTab. Per-MR health is read from ['mr-health', project_id, iid] entries
 * populated by MrAttentionTab and MyTasksTab. Undefined health entries → Needs Review.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAssignedMRs, fetchReviewerMRs, validateGitLab } from '@/services/gitlab';
import type { GitLabMR } from '@/services/gitlab';

export interface MrHealthPanelProps {
  gitlabBaseUrl: string;
  gitlabToken: string;
}

export default function MrHealthPanel({ gitlabBaseUrl, gitlabToken }: MrHealthPanelProps) {
  const queryClient = useQueryClient();

  // Resolve userId internally — shares ['gitlab-current-user'] cache with Dashboard,
  // so no extra network request is made. This avoids the two-step cascade where Dashboard
  // must complete validateGitLab before passing userId down as a prop.
  const { data: currentUser } = useQuery({
    queryKey: ['gitlab-current-user', gitlabBaseUrl],
    queryFn: () => validateGitLab(gitlabBaseUrl!, gitlabToken!),
    staleTime: Infinity,
    enabled: !!gitlabBaseUrl && !!gitlabToken,
  });
  const userId = currentUser?.id;

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

      {isLoading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-5 rounded bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && assignedMrs.length === 0 && (
        <p className="text-sm text-muted-foreground">No open MRs</p>
      )}

      {!isLoading && assignedMrs.length > 0 && (
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
