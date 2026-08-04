/**
 * aggregateTimeTracking — pure aggregation of an issue's own time tracking with
 * its subtasks' time tracking, for the Worklog view progress bar.
 *
 * - Subtask issue: only its own spent/estimate seconds (subtasks arg ignored).
 * - Story/Task issue: own spent/estimate PLUS the sum across all subtasks.
 * - Missing `timetracking` on the issue or any subtask contributes 0, never NaN.
 * - `subtasks` undefined (enrichment still pending) falls back to own values only.
 */

export interface TimeTrackingSeconds {
  timeSpentSeconds?: number;
  originalEstimateSeconds?: number;
}

export interface SubtaskWithTimeTracking {
  fields: {
    timetracking?: TimeTrackingSeconds;
  };
}

export interface AggregatedTimeTracking {
  spentSeconds: number;
  estimateSeconds: number;
}

export function aggregateTimeTracking(
  own: TimeTrackingSeconds | undefined,
  subtasks: SubtaskWithTimeTracking[] | undefined,
  opts: { isSubtask: boolean },
): AggregatedTimeTracking {
  const ownSpent = own?.timeSpentSeconds ?? 0;
  const ownEstimate = own?.originalEstimateSeconds ?? 0;

  if (opts.isSubtask || !subtasks || subtasks.length === 0) {
    return { spentSeconds: ownSpent, estimateSeconds: ownEstimate };
  }

  let spentSeconds = ownSpent;
  let estimateSeconds = ownEstimate;
  for (const subtask of subtasks) {
    spentSeconds += subtask.fields.timetracking?.timeSpentSeconds ?? 0;
    estimateSeconds += subtask.fields.timetracking?.originalEstimateSeconds ?? 0;
  }

  return { spentSeconds, estimateSeconds };
}
