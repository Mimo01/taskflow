import { CachedAvatar } from '@/components/ui/cached-avatar';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { PriorityIcon } from '@/components/ui/priority-icon';
import { Skeleton } from '@/components/ui/skeleton';
import { statusPillClass } from '@/lib/statusStyles';
import type { JiraIssue } from '@/services/jira/types';
import { RunSection } from './RunSection';

export interface RunDefect {
  id: string;
  issue: JiraIssue | null;
  isLoading: boolean;
  /** 0-based indexes of the steps this defect is linked to (empty = run-level only). */
  steps: number[];
}

/**
 * All defects of the run in one place — run-level and step-level, de-duplicated. One line
 * per defect: type · key · summary · linked steps · priority · assignee · status.
 */
export function RunDefectsSection({
  defects,
  onOpenDefect,
}: {
  defects: RunDefect[];
  onOpenDefect: (key: string) => void;
}) {
  if (defects.length === 0) return null;
  return (
    <RunSection title="Defects" count={defects.length} testId="aio-run-defects-section">
      <ul className="space-y-1.5 density-compact:space-y-1 density-comfortable:space-y-2">
        {defects.map((d) => {
          const key = d.issue?.key ?? d.id;
          const clickable = !d.isLoading && !!d.issue;
          const assignee = d.issue?.fields.assignee;
          return (
            <li
              key={d.id}
              data-testid={`aio-run-defect-${d.id}`}
              className="relative flex min-w-0 items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm transition-colors hover:bg-accent density-compact:py-1.5 density-comfortable:py-3"
            >
              {clickable && (
                <button
                  type="button"
                  aria-label={`Open defect ${key}`}
                  className="absolute inset-0 cursor-pointer rounded-md"
                  onClick={() => onOpenDefect(key)}
                />
              )}
              <div className="pointer-events-none flex min-w-0 flex-1 items-center gap-2">
                {d.issue?.fields.issuetype?.name ? (
                  <IssueTypeIcon typeName={d.issue.fields.issuetype.name} />
                ) : null}
                <span className="flex-none font-mono text-xs text-muted-foreground">{key}</span>
                {d.isLoading ? (
                  <Skeleton className="h-4 w-48" />
                ) : (
                  <span className="min-w-0 flex-1 truncate">{d.issue?.fields.summary ?? ''}</span>
                )}
              </div>
              {d.steps.length > 0 && (
                <span className="pointer-events-none flex-none text-xs text-muted-foreground tabular-nums">
                  {d.steps.length === 1 ? 'Step' : 'Steps'} {d.steps.map((s) => s + 1).join(', ')}
                </span>
              )}
              <div className="pointer-events-none flex w-4 flex-none justify-center">
                <PriorityIcon priority={d.issue?.fields.priority} />
              </div>
              <div className="pointer-events-none hidden w-36 flex-none items-center gap-1.5 text-xs text-muted-foreground @[560px]:flex">
                {assignee ? (
                  <>
                    <CachedAvatar
                      url={assignee.avatarUrls?.['48x48']}
                      name={assignee.displayName}
                      size={20}
                    />
                    <span className="truncate">{assignee.displayName}</span>
                  </>
                ) : d.issue ? (
                  <span>Unassigned</span>
                ) : null}
              </div>
              <div className="pointer-events-none flex w-28 flex-none justify-end">
                {d.issue?.fields.status && (
                  <span className={statusPillClass(d.issue.fields.status.statusCategory?.key)}>
                    {d.issue.fields.status.name}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </RunSection>
  );
}
