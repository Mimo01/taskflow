import type { ReleasePill } from '@/lib/release-list';
import { STATUS_PILL_LAYOUT_CLASS, tonePillClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';

/** One status pill per release. Wrapped in a flex parent so the pill geometry holds. */
export function ReleaseStatusPill({ pill }: { pill: ReleasePill }) {
  return (
    <div className="flex">
      <span
        data-testid="release-status-pill"
        className={cn(STATUS_PILL_LAYOUT_CLASS, tonePillClass(pill.tone))}
      >
        {pill.label}
      </span>
    </div>
  );
}
