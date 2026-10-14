import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { defectPrioritySlices, defectStatusSlices } from '@/lib/aio-cycle-charts';
import type { JiraIssue } from '@/services/jira/types';
import { AioDonut } from './AioDonut';
import { TITLE_CLASS } from './AioTile';
import type { ResolvedDefect } from './useCycleDefects';

const DONUT_SIZE = 128;

export function severityOf(issue: JiraIssue | null): string | null {
  return issue?.fields.customfield_13415?.value ?? issue?.fields.customfield_13415?.name ?? null;
}

function describe(slices: { label: string; value: number }[]): string {
  return slices.map((s) => `${s.value} ${s.label}`).join(', ');
}

/**
 * Defect Summary: Status (by Jira category) and Priority (by icon severity) donuts plus a
 * plain-text severity line. No centre counts: the open-defect count lives only in the
 * "Open defects" tile. The cycle's defects are already latest-run only, so there is no
 * "latest run" toggle.
 */
export function DefectSummary({ defects }: { defects: ResolvedDefect[] }) {
  const { statusSlices, prioritySlices, bySeverity } = useMemo(() => {
    const sev = new Map<string, number>();
    for (const d of defects) {
      const s = severityOf(d.issue);
      if (s) sev.set(s, (sev.get(s) ?? 0) + 1);
    }
    return {
      statusSlices: defectStatusSlices(defects),
      prioritySlices: defectPrioritySlices(defects),
      bySeverity: [...sev.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    };
  }, [defects]);

  if (statusSlices.length === 0) return null;

  return (
    <div
      data-testid="defects-summary"
      className="grid gap-2 border-b px-4 py-2 density-compact:py-1.5 density-comfortable:py-3"
    >
      <span className={TITLE_CLASS}>Defect Summary</span>
      <div className="flex flex-wrap gap-4">
        <Card size="sm">
          <CardContent className="grid justify-items-center gap-1">
            <span className={TITLE_CLASS}>Status</span>
            <AioDonut
              slices={statusSlices}
              size={DONUT_SIZE}
              testId="defect-status-donut"
              ariaLabel={`Defects by status: ${describe(statusSlices)}`}
            />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="grid justify-items-center gap-1">
            <span className={TITLE_CLASS}>Priority</span>
            <AioDonut
              slices={prioritySlices}
              size={DONUT_SIZE}
              testId="defect-priority-donut"
              ariaLabel={`Defects by priority: ${describe(prioritySlices)}`}
            />
          </CardContent>
        </Card>
      </div>
      {bySeverity.length > 0 && (
        <span className="text-xs text-muted-foreground">
          {`Sev: ${bySeverity.map(([name, n]) => `${name} ${n}`).join(' · ')}`}
        </span>
      )}
    </div>
  );
}
