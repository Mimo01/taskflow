import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { MarkerGlyph } from '@/components/ui/tooltip-body';
import {
  type ChartSlice,
  defectPrioritySlices,
  defectSeveritySlices,
  defectStatusSlices,
  severityLabel,
} from '@/lib/aio-cycle-charts';
import type { JiraIssue } from '@/services/jira/types';
import { AioDonut, AioDonutSkeleton } from './AioDonut';
import type { ResolvedDefect } from './useCycleDefects';

/** Fixed key width so the Status and Priority keys (and their values) line up. */
const KEY_CLASS = 'grid gap-0.5 text-xs leading-4';
const KEY_TITLE_CLASS = 'font-medium';

/** Raw severity value ('2-Major'): the number is the order, so sort on this. */
export function severityRaw(issue: JiraIssue | null): string | null {
  return issue?.fields.customfield_13415?.value ?? issue?.fields.customfield_13415?.name ?? null;
}

/** Severity as shown to the user: just the label ('Major'). */
export function severityOf(issue: JiraIssue | null): string | null {
  const raw = severityRaw(issue);
  return raw ? severityLabel(raw) : null;
}

function describe(slices: { label: string; value: number }[]): string {
  return slices.map((s) => `${s.value} ${s.label}`).join(', ');
}

/** Status, Priority and Severity donuts, each with its key (severity only when any defect has one). */
export function DefectDonuts({
  statusSlices,
  prioritySlices,
  severitySlices,
}: {
  statusSlices: ChartSlice[];
  prioritySlices: ChartSlice[];
  severitySlices: ChartSlice[];
}) {
  return (
    <>
      <DonutBlock
        title="Status"
        testId="defect-status-donut"
        label="Defects by status"
        slices={statusSlices}
      />
      <DonutBlock
        title="Priority"
        testId="defect-priority-donut"
        label="Defects by priority"
        slices={prioritySlices}
      />
      {severitySlices.length > 0 && (
        <DonutBlock
          title="Severity"
          testId="defect-severity-donut"
          label="Defects by severity"
          slices={severitySlices}
        />
      )}
    </>
  );
}

/**
 * Defect donuts computed straight from the resolved defects. Always renders something of the
 * same height (skeleton rings, an empty ring, or the pair), so the block never jumps.
 */
export function CycleDefectDonuts({
  defects,
  loading,
}: {
  defects: ResolvedDefect[];
  loading: boolean;
}) {
  const statusSlices = useMemo(() => defectStatusSlices(defects), [defects]);
  const prioritySlices = useMemo(() => defectPrioritySlices(defects), [defects]);
  const severitySlices = useMemo(() => defectSeveritySlices(defects), [defects]);
  if (loading) {
    return (
      <>
        <DonutBlockSkeleton testId="defect-status-skeleton" />
        <DonutBlockSkeleton testId="defect-priority-skeleton" />
      </>
    );
  }
  if (statusSlices.length === 0) {
    return (
      <AioDonutSkeleton testId="defect-donut-empty" pulse={false}>
        No linked defects
      </AioDonutSkeleton>
    );
  }
  return (
    <DefectDonuts
      statusSlices={statusSlices}
      prioritySlices={prioritySlices}
      severitySlices={severitySlices}
    />
  );
}

function DonutBlockSkeleton({ testId }: { testId: string }) {
  return (
    <div className="flex items-center gap-4">
      <AioDonutSkeleton testId={testId} />
      <div className={KEY_CLASS}>
        <Skeleton className="h-3.5 w-12" />
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3.5 w-20" />
      </div>
    </div>
  );
}

/**
 * Donut with a compact key beside it (a bare ring says nothing without one). Key rows use the
 * same status swatch as the tooltip rows that open on the slices.
 */
function DonutBlock({
  title,
  testId,
  label,
  slices,
}: {
  title: string;
  testId: string;
  label: string;
  slices: ChartSlice[];
}) {
  return (
    <div data-testid="defect-donut-block" className="flex items-center gap-4">
      <AioDonut slices={slices} testId={testId} ariaLabel={`${label}: ${describe(slices)}`} />
      <div className={KEY_CLASS}>
        <span className={KEY_TITLE_CLASS}>{title}</span>
        {(slices.length > 3 ? slices.slice(0, 2) : slices).map((s) => (
          <span key={s.label} className="flex min-w-0 items-center gap-2">
            <MarkerGlyph marker="status" color={s.color} />
            <span className="min-w-0 max-w-40 truncate text-muted-foreground">{s.label}</span>
            <span className="tabular-nums">{s.value}</span>
          </span>
        ))}
        {slices.length > 3 && (
          <span className="text-muted-foreground">{`+${slices.length - 2} more`}</span>
        )}
      </div>
    </div>
  );
}
