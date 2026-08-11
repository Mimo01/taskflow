import { openUrl } from '@tauri-apps/plugin-opener';
import { AlertTriangle, GitMerge, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { Progress } from '@/components/ui/progress';
import { statusPillClass } from '@/lib/statusStyles';
import type { GitLabMR } from '@/services/gitlab';
import type { JiraIssue } from '@/services/jira';
import type { ReleaseMatch } from '@/services/releaseLinker';

interface IssuesSectionProps {
  issueCounts: { issuesFixed: number; issuesTotal: number } | undefined;
  gitlabMatchType: ReleaseMatch['type'];
  hasReleaseDate: boolean;
  isLoadingIssues: boolean;
  matchedRows: Array<{ issue: JiraIssue; mr: GitLabMR | null }>;
  wrongMilestoneByKey: Map<string, GitLabMR>;
  onOpenIssue: (key: string) => void;
  onOpenIssueFull: (key: string) => void;
  onSeedBreadcrumb: () => void;
}

export function IssuesSection({
  issueCounts,
  gitlabMatchType,
  hasReleaseDate,
  isLoadingIssues,
  matchedRows,
  wrongMilestoneByKey,
  onOpenIssue,
  onOpenIssueFull,
  onSeedBreadcrumb,
}: IssuesSectionProps) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-medium text-muted-foreground">Issues</h3>
        {issueCounts && (
          <Badge variant="secondary" className="text-xs tabular-nums">
            {issueCounts.issuesFixed} / {issueCounts.issuesTotal} done
          </Badge>
        )}
      </div>

      {/* Progress bar (Jira-driven) */}
      {issueCounts && issueCounts.issuesTotal > 0 && (
        <Progress
          value={Math.round((issueCounts.issuesFixed / issueCounts.issuesTotal) * 100)}
          className="max-w-xs mb-4"
          indicatorClassName="bg-green-500"
        />
      )}

      {/* Milestone warning */}
      {gitlabMatchType === 'none' && (
        <div className="flex items-center gap-2 rounded-md border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 px-3 py-2 mb-4">
          <AlertTriangle className="size-4 text-orange-600 dark:text-orange-400 shrink-0" />
          <p className="text-xs text-orange-700 dark:text-orange-300">
            No GitLab milestone matched — MR linking is unavailable.
            {!hasReleaseDate && ' Set a release date to enable milestone matching.'}
          </p>
        </div>
      )}

      {/* Issues table */}
      {isLoadingIssues ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="size-3.5 animate-spin" />
          Loading issues...
        </div>
      ) : matchedRows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No issues in this fix version</p>
      ) : (
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr className="text-xs text-muted-foreground font-medium bg-muted/30">
              <th className="text-left py-1.5 px-2 border-b border-border/50">Key</th>
              <th className="text-left py-1.5 px-2 border-b border-border/50">Summary</th>
              <th className="text-left py-1.5 px-2 border-b border-border/50">Assignee</th>
              <th className="text-left py-1.5 px-2 border-b border-border/50">Status</th>
              <th className="text-left py-1.5 px-2 border-b border-border/50">MR</th>
            </tr>
          </thead>
          <tbody>
            {matchedRows.map((row) => (
              <tr
                key={row.issue.id}
                className="border-b border-border/50 hover:bg-muted/40 cursor-pointer"
                onClick={() => {
                  onSeedBreadcrumb();
                  onOpenIssue(row.issue.key);
                }}
              >
                <td className="py-1.5 px-2 font-mono text-xs whitespace-nowrap border-b border-border/50 text-primary">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenIssueFull(row.issue.key);
                    }}
                    className="font-mono text-xs text-primary hover:underline cursor-pointer"
                  >
                    {row.issue.key}
                  </button>
                </td>
                <td className="py-1.5 px-2 border-b border-border/50">
                  <span className="line-clamp-1">{row.issue.fields.summary}</span>
                </td>
                <td className="py-1.5 px-2 border-b border-border/50 whitespace-nowrap">
                  {row.issue.fields.assignee ? (
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <CachedAvatar
                        url={row.issue.fields.assignee.avatarUrls['48x48']}
                        name={row.issue.fields.assignee.displayName}
                        size={20}
                      />
                      <span className="line-clamp-1">{row.issue.fields.assignee.displayName}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CachedAvatar url={null} name="Unassigned" size={20} />
                      Unassigned
                    </span>
                  )}
                </td>
                <td className="py-1.5 px-2 border-b border-border/50 whitespace-nowrap">
                  <span className={statusPillClass(row.issue.fields.status.statusCategory?.key)}>
                    {row.issue.fields.status.name}
                  </span>
                </td>
                <td className="py-1.5 px-2 border-b border-border/50 whitespace-nowrap">
                  {row.mr ? (
                    <span className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openUrl(row.mr?.web_url ?? '');
                        }}
                        className={`inline-flex items-center gap-1 text-xs hover:underline ${
                          row.mr.state === 'merged'
                            ? 'text-green-600 dark:text-green-400'
                            : row.mr.state === 'opened'
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-500'
                        }`}
                      >
                        <GitMerge className="size-3.5" />!{row.mr.iid}
                      </button>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          row.mr.state === 'merged'
                            ? 'border-green-500 text-green-600'
                            : row.mr.state === 'opened'
                              ? 'border-blue-500 text-blue-600'
                              : 'border-gray-400 text-gray-500'
                        }`}
                      >
                        {row.mr.state}
                      </Badge>
                    </span>
                  ) : gitlabMatchType === 'none' ? (
                    <span
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                      title="No milestone matched — cannot check for MRs"
                    >
                      —
                    </span>
                  ) : wrongMilestoneByKey.has(row.issue.key) ? (
                    (() => {
                      const offending = wrongMilestoneByKey.get(row.issue.key);
                      if (!offending) return null;
                      const offendingMilestone = offending.milestone?.title ?? 'no milestone';
                      return (
                        <span className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openUrl(offending.web_url);
                            }}
                            className={`inline-flex items-center gap-1 text-xs hover:underline ${
                              offending.state === 'merged'
                                ? 'text-green-600 dark:text-green-400'
                                : offending.state === 'opened'
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-gray-500'
                            }`}
                          >
                            <GitMerge className="size-3.5" />!{offending.iid}
                          </button>
                          <span
                            className="inline-flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400"
                            title={`MR !${offending.iid} is on milestone ${offendingMilestone}, not this release`}
                          >
                            <AlertTriangle className="size-3.5" />
                            Wrong milestone
                          </span>
                        </span>
                      );
                    })()
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400"
                      title="No merge request found in milestone"
                    >
                      <AlertTriangle className="size-3.5" />
                      Missing MR
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
