import { useQuery } from '@tanstack/react-query';
import { Bug } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { PROGRESS_SEGMENT_CLASS } from '@/lib/aio-cycle-list';
import { normalizeStatus, normalizeStatusLabel } from '@/lib/aioUtils';
import { aioRunStatusPillClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import type { AioTestRunStep } from '@/services/aio';
import { fetchJiraIssueByKey } from '@/services/jira';
import { WikiRenderer } from '../WikiRenderer';

function StepDefectChip({
  defectId,
  jiraBaseUrl,
  token,
}: {
  defectId: string;
  jiraBaseUrl: string | null | undefined;
  token: string | null | undefined;
}) {
  // Same key as the sidebar and the cycle page so the cache is shared.
  const { data: issue } = useQuery({
    queryKey: ['jira', jiraBaseUrl, 'issue-lightweight', defectId],
    queryFn: () => fetchJiraIssueByKey(jiraBaseUrl ?? '', token ?? '', defectId),
    enabled: !!jiraBaseUrl && !!token,
  });
  if (!issue) {
    return <span className="font-mono text-xs text-muted-foreground">{defectId}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
      <Bug className="size-3 flex-none text-red-500" aria-hidden />
      {issue.key}
    </span>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  );
}

/** One run step as a card: Step / Expected / Actual (+ optional Test data and defects). */
export function RunStepCard({
  step,
  index,
  jiraBaseUrl,
  token,
}: {
  step: AioTestRunStep;
  index: number;
  jiraBaseUrl?: string | null;
  token?: string | null;
}) {
  const status = step.status ?? 'NOT_EXECUTED';
  const key = normalizeStatus(status);
  const highlight =
    key === 'fail' ? 'ring-red-500/40' : key === 'blocked' ? 'ring-orange-500/40' : '';
  const defects = (step.jiraDefectIDs ?? []).map(String);

  return (
    <Card
      data-testid={`run-step-${index}`}
      data-highlight={highlight ? 'true' : undefined}
      className={cn('relative gap-2 overflow-hidden py-3 pl-5 pr-4', highlight)}
    >
      <span
        aria-hidden
        className={cn('absolute inset-y-0 left-0 w-1', PROGRESS_SEGMENT_CLASS[key])}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs text-muted-foreground">Step {index + 1}</span>
        <div className="flex flex-none items-center">
          <span className={aioRunStatusPillClass(status)}>{normalizeStatusLabel(status)}</span>
        </div>
      </div>
      <Section label="Step">
        <WikiRenderer wikiText={step.step} />
      </Section>
      {step.expectedResult ? (
        <Section label="Expected">
          <WikiRenderer wikiText={step.expectedResult} />
        </Section>
      ) : null}
      {step.testData ? (
        <Section label="Test data">
          <WikiRenderer wikiText={step.testData} />
        </Section>
      ) : null}
      {key !== 'notRun' && step.actualResult ? (
        <Section label="Actual">
          <WikiRenderer wikiText={step.actualResult} />
        </Section>
      ) : null}
      {defects.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-1.5"
          data-testid={`run-step-defects-${index}`}
        >
          {defects.map((id) => (
            <StepDefectChip key={id} defectId={id} jiraBaseUrl={jiraBaseUrl} token={token} />
          ))}
        </div>
      )}
    </Card>
  );
}
