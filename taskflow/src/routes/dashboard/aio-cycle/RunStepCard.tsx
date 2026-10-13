import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { PriorityIcon } from '@/components/ui/priority-icon';
import { PROGRESS_SEGMENT_CLASS } from '@/lib/aio-cycle-list';
import { normalizeStatus, normalizeStatusLabel } from '@/lib/aioUtils';
import { aioRunStatusPillClass, statusCategoryBadgeClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import type { AioTestRunStep } from '@/services/aio';
import { fetchJiraIssueByKey } from '@/services/jira';
import type { JiraIssue } from '@/services/jira/types';
import { WikiRenderer } from '../WikiRenderer';

/**
 * Steps render as one framed list. Each step: number · full-width step text · status, then
 * Expected | Actual side by side (≥640px container) or stacked, then any linked defects.
 * Long step content gets the full row width instead of a third of it.
 */
export function RunStepList({ children }: { children: ReactNode }) {
  return (
    <div
      className="@container overflow-hidden rounded-lg border border-border"
      data-testid="aio-run-detail-step-table"
    >
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function StepDefect({
  defectId,
  jiraBaseUrl,
  token,
  onOpenDefect,
}: {
  defectId: string;
  jiraBaseUrl: string | null | undefined;
  token: string | null | undefined;
  onOpenDefect?: (key: string) => void;
}) {
  // Same key as the sidebar and the cycle page so the cache is shared.
  const { data: issue, isLoading } = useQuery<JiraIssue | null>({
    queryKey: ['jira', jiraBaseUrl, 'issue-lightweight', defectId],
    queryFn: () =>
      fetchJiraIssueByKey(jiraBaseUrl ?? '', token ?? '', defectId) as Promise<JiraIssue | null>,
    enabled: !!jiraBaseUrl && !!token,
  });

  // Compact chip — the full detail (summary, assignee, priority, status) lives in the
  // run's Defects section; here it only marks which defect a step raised.
  const label = issue?.key ?? defectId;
  const statusName = issue?.fields.status?.name;
  const summary = issue?.fields.summary;
  const assignee = issue?.fields.assignee;
  // One-line mini card: type · key · summary · priority · status · assignee.
  const chip = (
    <>
      {issue?.fields.issuetype?.name ? (
        <IssueTypeIcon typeName={issue.fields.issuetype.name} className="size-3.5 shrink-0" />
      ) : null}
      <span className="flex-none font-mono text-muted-foreground">{label}</span>
      {summary ? (
        <span className="min-w-0 flex-1 truncate text-foreground">{summary}</span>
      ) : isLoading ? (
        <span className="h-3 w-32 flex-none rounded bg-muted" />
      ) : null}
      <PriorityIcon priority={issue?.fields.priority} className="size-3.5 shrink-0" />
      {statusName && (
        <span
          className={cn(
            'flex-none whitespace-nowrap rounded px-1.5 py-px text-[10px] font-medium',
            statusCategoryBadgeClass(issue?.fields.status?.statusCategory?.key),
          )}
        >
          {statusName}
        </span>
      )}
      {assignee && (
        <span className="flex flex-none" title={`Assignee: ${assignee.displayName}`}>
          <CachedAvatar
            url={assignee.avatarUrls?.['48x48']}
            name={assignee.displayName}
            size={16}
          />
        </span>
      )}
    </>
  );
  const chipClass =
    'flex w-full min-w-0 items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs';
  if (!issue || !onOpenDefect) {
    return (
      <li className={cn(chipClass, 'text-muted-foreground', isLoading && 'animate-pulse')}>
        {chip}
      </li>
    );
  }
  return (
    <li className="min-w-0">
      <button
        type="button"
        aria-label={`Open defect ${issue.key}`}
        title={[issue.key, statusName, summary].filter(Boolean).join(' · ')}
        className={cn(
          chipClass,
          'cursor-pointer text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring',
        )}
        onClick={() => onOpenDefect(issue.key)}
      >
        {chip}
      </button>
    </li>
  );
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 text-sm">
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

/** One run step as a compact row: Step / Expected / Actual (+ optional Test data and defects). */
export function RunStepCard({
  step,
  index,
  jiraBaseUrl,
  token,
  onOpenDefect,
}: {
  step: AioTestRunStep;
  index: number;
  jiraBaseUrl?: string | null;
  token?: string | null;
  onOpenDefect?: (key: string) => void;
}) {
  const status = step.status ?? 'NOT_EXECUTED';
  const key = normalizeStatus(status);
  const highlight = key === 'fail' || key === 'blocked';
  const defects = (step.jiraDefectIDs ?? []).map(String);
  const executed = key !== 'notRun' && !!step.actualResult;

  return (
    <div
      data-testid={`run-step-${index}`}
      data-highlight={highlight ? 'true' : undefined}
      className={cn(
        'relative grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-start gap-x-4 gap-y-3 px-4 py-4 leading-relaxed density-compact:gap-y-2 density-compact:py-2.5 density-comfortable:py-5',
        key === 'fail' && 'bg-red-500/[0.04]',
        key === 'blocked' && 'bg-orange-500/[0.05]',
      )}
    >
      <span
        aria-hidden
        className={cn('absolute inset-y-0 left-0 w-0.5', PROGRESS_SEGMENT_CLASS[key])}
      />
      <span className="pt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
        {index + 1}
      </span>

      <div className="min-w-0 text-sm">
        <WikiRenderer wikiText={step.step} />
        {step.testData ? (
          <div className="mt-2 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs">
            <span className="mr-1 font-medium text-muted-foreground">Test data</span>
            <WikiRenderer wikiText={step.testData} />
          </div>
        ) : null}
      </div>

      <div className="flex justify-end">
        <span className={aioRunStatusPillClass(status)}>{normalizeStatusLabel(status)}</span>
      </div>

      {(step.expectedResult || executed) && (
        <div
          className={cn(
            'col-start-2 col-end-[-1] grid gap-x-6 gap-y-3',
            step.expectedResult && executed && '@[640px]:grid-cols-2',
          )}
        >
          {step.expectedResult ? (
            <Block label="Expected">
              <WikiRenderer wikiText={step.expectedResult} />
            </Block>
          ) : null}
          {executed ? (
            <Block label="Actual">
              <WikiRenderer wikiText={step.actualResult ?? ''} />
            </Block>
          ) : null}
        </div>
      )}

      {defects.length > 0 && (
        <ul
          className="col-start-2 col-end-[-1] space-y-1.5"
          data-testid={`run-step-defects-${index}`}
        >
          {defects.map((id) => (
            <StepDefect
              key={id}
              defectId={id}
              jiraBaseUrl={jiraBaseUrl}
              token={token}
              onOpenDefect={onOpenDefect}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
