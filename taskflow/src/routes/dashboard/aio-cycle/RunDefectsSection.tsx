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
/** Column widths shared by the header and the rows (flex, one line per row). */
const COL = {
  key: 'w-32 flex-none',
  summary: 'min-w-0 flex-1',
  steps: 'hidden w-20 flex-none @[640px]:block',
  priority: 'w-16 flex-none',
  assignee: 'hidden w-40 flex-none @[560px]:flex',
  status: 'flex w-28 flex-none justify-end',
};
const HEADER_CELL = 'text-xs font-medium text-muted-foreground';

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
      <div className="@container overflow-hidden rounded-lg border border-border">
        <div
          aria-hidden
          className="flex items-center gap-4 border-b bg-muted/10 px-4 py-2.5 density-compact:py-1.5 density-comfortable:py-3"
        >
          <span className={`${COL.key} ${HEADER_CELL}`}>Key</span>
          <span className={`${COL.summary} ${HEADER_CELL}`}>Summary</span>
          <span className={`${COL.steps} ${HEADER_CELL}`}>Steps</span>
          <span className={`${COL.priority} ${HEADER_CELL}`}>Priority</span>
          <span className={`${COL.assignee} ${HEADER_CELL}`}>Assignee</span>
          <span className={`${COL.status} ${HEADER_CELL}`}>Status</span>
        </div>
        <ul className="divide-y divide-border">
          {defects.map((d) => {
            const key = d.issue?.key ?? d.id;
            const clickable = !d.isLoading && !!d.issue;
            const assignee = d.issue?.fields.assignee;
            const priority = d.issue?.fields.priority;
            return (
              <li
                key={d.id}
                data-testid={`aio-run-defect-${d.id}`}
                className="relative flex min-w-0 items-center gap-4 px-4 py-3 text-sm transition-colors hover:bg-muted/30 density-compact:py-2 density-comfortable:py-4"
              >
                {clickable && (
                  <button
                    type="button"
                    aria-label={`Open defect ${key}`}
                    className="absolute inset-0 cursor-pointer"
                    onClick={() => onOpenDefect(key)}
                  />
                )}
                <div className={`${COL.key} pointer-events-none flex items-center gap-1.5`}>
                  {d.issue?.fields.issuetype?.name ? (
                    <IssueTypeIcon typeName={d.issue.fields.issuetype.name} />
                  ) : null}
                  <span className="truncate font-mono text-xs">{key}</span>
                </div>
                <div className={`${COL.summary} pointer-events-none`}>
                  {d.isLoading ? (
                    <Skeleton className="h-4 w-48" />
                  ) : (
                    <span className="block truncate">{d.issue?.fields.summary ?? ''}</span>
                  )}
                </div>
                <span
                  data-testid="aio-run-defect-steps"
                  className={`${COL.steps} pointer-events-none truncate text-xs text-muted-foreground tabular-nums`}
                >
                  {d.steps.length > 0 ? d.steps.map((s) => s + 1).join(', ') : '—'}
                </span>
                <div
                  className={`${COL.priority} pointer-events-none flex items-center gap-1.5 text-xs text-muted-foreground`}
                >
                  <PriorityIcon priority={priority} />
                  <span className="truncate">{priority?.name ?? ''}</span>
                </div>
                <div
                  className={`${COL.assignee} pointer-events-none items-center gap-1.5 text-xs text-muted-foreground`}
                >
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
                <div className={`${COL.status} pointer-events-none`}>
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
      </div>
    </RunSection>
  );
}
