/**
 * TimeTrackingSummary -- Sidebar time tracking progress bar and labels.
 *
 * Shows estimated/spent/remaining time with a horizontal progress bar.
 * Handles missing estimate gracefully (shows spent only, no bar).
 */
import { MetaRow } from './MetaRow';

interface TimeTrackingData {
  originalEstimate?: string;
  remainingEstimate?: string;
  timeSpent?: string;
  originalEstimateSeconds?: number;
  remainingEstimateSeconds?: number;
  timeSpentSeconds?: number;
}

interface TimeTrackingSummaryProps {
  timetracking: TimeTrackingData | undefined;
}

export function TimeTrackingSummary({ timetracking }: TimeTrackingSummaryProps) {
  const spent = timetracking?.timeSpentSeconds ?? 0;
  const estimate = timetracking?.originalEstimateSeconds ?? 0;
  const hasData = spent > 0 || estimate > 0;

  return (
    <MetaRow label="Time Tracking">
      {!hasData ? (
        <span className="text-xs text-muted-foreground">No time logged</span>
      ) : estimate > 0 ? (
        <div className="space-y-1 w-full">
          <div
            role="progressbar"
            aria-valuenow={spent}
            aria-valuemin={0}
            aria-valuemax={estimate}
            className="h-2 w-full bg-muted rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${Math.min(100, (spent / estimate) * 100)}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            <span>Estimated: {timetracking?.originalEstimate ?? '—'}</span>
            <span>Spent: {timetracking?.timeSpent ?? '—'}</span>
            <span>Remaining: {timetracking?.remainingEstimate ?? '—'}</span>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <span className="text-xs">Spent: {timetracking?.timeSpent ?? '—'}</span>
          <span className="text-xs text-muted-foreground ml-2">No estimate</span>
        </div>
      )}
    </MetaRow>
  );
}
