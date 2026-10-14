import { useMemo } from 'react';
import { type ChartSlice, defectPrioritySlices, defectStatusSlices } from '@/lib/aio-cycle-charts';
import type { JiraIssue } from '@/services/jira/types';
import { AioDonut } from './AioDonut';
import { TITLE_CLASS } from './AioTile';
import type { ResolvedDefect } from './useCycleDefects';

const DONUT_SIZE = 112;

export function severityOf(issue: JiraIssue | null): string | null {
  return issue?.fields.customfield_13415?.value ?? issue?.fields.customfield_13415?.name ?? null;
}

function describe(slices: { label: string; value: number }[]): string {
  return slices.map((s) => `${s.value} ${s.label}`).join(', ');
}

/** Severity breakdown line for the Defects tab; the donuts live in the cycle stats block. */
export function DefectSummary({ defects }: { defects: ResolvedDefect[] }) {
  const bySeverity = useMemo(() => {
    const sev = new Map<string, number>();
    for (const d of defects) {
      const s = severityOf(d.issue);
      if (s) sev.set(s, (sev.get(s) ?? 0) + 1);
    }
    return [...sev.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [defects]);

  if (bySeverity.length === 0) return null;

  return (
    <div
      data-testid="defects-summary"
      className="border-b px-4 py-2 text-xs text-muted-foreground density-compact:py-1.5 density-comfortable:py-3"
    >
      {`Sev: ${bySeverity.map(([name, n]) => `${name} ${n}`).join(' · ')}`}
    </div>
  );
}

/** Status + Priority donut pair (shared by the Defects tab and the cycle stats block). */
export function DefectDonuts({
  statusSlices,
  prioritySlices,
}: {
  statusSlices: ChartSlice[];
  prioritySlices: ChartSlice[];
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
    </>
  );
}

/** Defect donuts computed straight from the resolved defects (null while none charted). */
export function CycleDefectDonuts({ defects }: { defects: ResolvedDefect[] }) {
  const statusSlices = useMemo(() => defectStatusSlices(defects), [defects]);
  const prioritySlices = useMemo(() => defectPrioritySlices(defects), [defects]);
  if (statusSlices.length === 0) return null;
  return <DefectDonuts statusSlices={statusSlices} prioritySlices={prioritySlices} />;
}

/** Donut with a compact name/count key beside it (a bare ring says nothing without one). */
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
      <AioDonut
        slices={slices}
        size={DONUT_SIZE}
        testId={testId}
        ariaLabel={`${label}: ${describe(slices)}`}
      />
      <div className="grid gap-1 text-xs">
        <span className={TITLE_CLASS}>{title}</span>
        {slices.slice(0, 5).map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className="size-2 flex-none rounded-full" style={{ background: s.color }} />
            <span className="truncate">{s.label}</span>
            <span className="tabular-nums text-muted-foreground">{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
