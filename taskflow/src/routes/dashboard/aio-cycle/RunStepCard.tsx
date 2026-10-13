import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { PriorityIcon } from '@/components/ui/priority-icon';
import { Skeleton } from '@/components/ui/skeleton';
import { PROGRESS_SEGMENT_CLASS } from '@/lib/aio-cycle-list';
import { normalizeStatus, normalizeStatusLabel } from '@/lib/aioUtils';
import { aioRunStatusPillClass, statusPillClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import type { AioTestRunStep } from '@/services/aio';
import { fetchJiraIssueByKey } from '@/services/jira';
import type { JiraIssue } from '@/services/jira/types';
import { WikiRenderer } from '../WikiRenderer';

/**
 * Steps render as one bordered list. At ≥720px container width each step is a single grid
 * row (# · Step · Expected · Actual · Status) under a shared header; below that the three
 * texts stack with their own labels. The `contents` wrapper lets the same markup serve both.
 */
const GRID =
  'grid-cols-[1.75rem_minmax(0,1fr)_auto] @[720px]:grid-cols-[1.75rem_repeat(3,minmax(0,1fr))_6.5rem]';

export function RunStepList({ children }: { children: ReactNode }) {
  return (
    <div
      className="@container overflow-hidden rounded-xl ring-1 ring-border"
      data-testid="aio-run-detail-step-table"
    >
      <div
        aria-hidden
        className={cn(
          'hidden gap-x-4 border-b bg-muted/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground @[720px]:grid',
          GRID,
        )}
      >
        <span>#</span>
        <span>Step</span>
        <span>Expected</span>
        <span>Actual</span>
        <span>Status</span>
      </div>
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

  const body = (
    <>
      {issue?.fields.issuetype?.name ? (
        <IssueTypeIcon typeName={issue.fields.issuetype.name} />
      ) : null}
      <span className="flex-none font-mono text-xs">{issue?.key ?? defectId}</span>
      {isLoading ? (
        <Skeleton className="h-3.5 w-32" />
      ) : (
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {issue?.fields.summary ?? ''}
        </span>
      )}
      <PriorityIcon priority={issue?.fields.priority} />
      {issue?.fields.status && (
        <div className="flex flex-none">
          <span className={statusPillClass(issue.fields.status.statusCategory?.key)}>
            {issue.fields.status.name}
          </span>
        </div>
      )}
    </>
  );

  const rowClass = 'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left';
  if (!issue || !onOpenDefect) {
    return <li className={rowClass}>{body}</li>;
  }
  return (
    <li>
      <button
        type="button"
        aria-label={`Open defect ${issue.key}`}
        className={cn(rowClass, 'cursor-pointer transition-colors hover:bg-muted')}
        onClick={() => onOpenDefect(issue.key)}
      >
        {body}
      </button>
    </li>
  );
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 text-sm">
      <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground @[720px]:hidden">
        {label}
      </div>
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
        'relative grid items-start gap-x-4 gap-y-1.5 px-3 py-2.5',
        GRID,
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

      <div className="min-w-0 space-y-2 @[720px]:contents">
        <Cell label="Step">
          <WikiRenderer wikiText={step.step} />
          {step.testData ? (
            <div className="mt-1 rounded-md bg-muted/50 px-2 py-1 text-xs">
              <span className="mr-1 font-medium text-muted-foreground">Test data</span>
              <WikiRenderer wikiText={step.testData} />
            </div>
          ) : null}
        </Cell>
        {step.expectedResult ? (
          <Cell label="Expected">
            <WikiRenderer wikiText={step.expectedResult} />
          </Cell>
        ) : (
          <div className="hidden @[720px]:block" />
        )}
        {executed ? (
          <Cell label="Actual">
            <WikiRenderer wikiText={step.actualResult ?? ''} />
          </Cell>
        ) : (
          <div className="hidden text-sm text-muted-foreground @[720px]:block">—</div>
        )}
      </div>

      <div className="flex justify-end @[720px]:justify-start">
        <span className={aioRunStatusPillClass(status)}>{normalizeStatusLabel(status)}</span>
      </div>

      {defects.length > 0 && (
        <ul
          className="col-start-2 col-end-[-1] -mx-2 space-y-0.5"
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
