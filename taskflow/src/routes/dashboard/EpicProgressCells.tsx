import { AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { statusCategoryDotClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';

/**
 * The two enrichment-driven cells of the redesigned epic row (Phase 91.2):
 * `EpicProgressCell` (the three-segment Done/In-Progress/To-Do bar with a
 * `done/total` label, D-11) and `EpicPointsCell` (the `done/total SP` label,
 * D-13). Both cells render the same four enrichment states — pending
 * shimmer (D-14), ready with stories, ready with zero stories / "No
 * stories" (D-16), and failure with a small click-to-retry glyph (D-15).
 *
 * The retry callback always re-fires the WHOLE batched enrichment query
 * (`fetchEpicEnrichmentMap`) owned by the parent page — it is never a
 * per-epic fetch. These components are purely presentational; they hold no
 * query state of their own.
 */

export interface EpicProgressCounts {
  total: number;
  done: number;
  inProgress: number;
  todo: number;
  points: number;
  donePoints: number;
}

export type EnrichmentCellState =
  | { kind: 'pending' }
  | { kind: 'error' }
  | { kind: 'ready'; counts: EpicProgressCounts };

const RETRY_BUTTON_CLASS = cn(
  'inline-flex items-center justify-center rounded p-0.5 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors',
);

export function EpicProgressCell(props: { state: EnrichmentCellState; onRetry: () => void }) {
  const { state, onRetry } = props;

  if (state.kind === 'pending') {
    return (
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-1.5 w-16 rounded-full" data-testid="epic-progress-pending" />
        <Skeleton className="h-3 w-8 rounded" />
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <button
        type="button"
        title="Failed to load — click to retry"
        aria-label="Retry loading epic progress"
        data-testid="epic-progress-retry"
        className={RETRY_BUTTON_CLASS}
        onClick={(e) => {
          e.stopPropagation();
          onRetry();
        }}
      >
        <AlertTriangle className="w-3.5 h-3.5" />
      </button>
    );
  }

  const { counts } = state;
  if (counts.total === 0) {
    return <span className="text-xs text-muted-foreground">No stories</span>;
  }

  const { total, done, inProgress, todo } = counts;
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="flex h-1.5 w-16 overflow-hidden rounded-full bg-muted"
        title={`${done} Done · ${inProgress} In Progress · ${todo} To Do`}
        data-testid="epic-progress-bar"
      >
        <div
          className={statusCategoryDotClass('done')}
          style={{ width: `${(done / total) * 100}%` }}
          data-testid="epic-segment-done"
        />
        <div
          className={statusCategoryDotClass('indeterminate')}
          style={{ width: `${(inProgress / total) * 100}%` }}
          data-testid="epic-segment-inprogress"
        />
        <div
          className={statusCategoryDotClass('new')}
          style={{ width: `${(todo / total) * 100}%` }}
          data-testid="epic-segment-todo"
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {done}/{total}
      </span>
    </div>
  );
}

export function EpicPointsCell(props: { state: EnrichmentCellState; onRetry: () => void }) {
  const { state, onRetry } = props;

  if (state.kind === 'pending') {
    return <Skeleton className="h-3 w-12 rounded" data-testid="epic-points-pending" />;
  }

  if (state.kind === 'error') {
    return (
      <button
        type="button"
        title="Failed to load — click to retry"
        aria-label="Retry loading epic story points"
        data-testid="epic-points-retry"
        className={RETRY_BUTTON_CLASS}
        onClick={(e) => {
          e.stopPropagation();
          onRetry();
        }}
      >
        <AlertTriangle className="w-3.5 h-3.5" />
      </button>
    );
  }

  const { counts } = state;
  if (counts.total === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
      {counts.donePoints}/{counts.points} SP
    </span>
  );
}
