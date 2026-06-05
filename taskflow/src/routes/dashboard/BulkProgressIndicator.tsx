/**
 * BulkProgressIndicator -- inline progress display during bulk operations.
 *
 * Shows a progress bar, status text, and per-issue failure details.
 * Auto-dismisses after 3 seconds on all-success.
 */

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface BulkProgressIndicatorProps {
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  failures: Array<{ key: string; error: string }>;
  isComplete: boolean;
  onDismiss: () => void;
  /** Verb used in status text. Defaults to 'Updating'. Pass 'Creating' for bulk subtask creation. */
  actionVerb?: string;
  /** Noun used in status text. Defaults to 'issues'. Pass 'subtasks' for bulk subtask creation. */
  noun?: string;
}

export function BulkProgressIndicator({
  total,
  completed,
  succeeded,
  failed,
  failures,
  isComplete,
  onDismiss,
  actionVerb = 'Updating',
  noun = 'issues',
}: BulkProgressIndicatorProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Auto-dismiss after 3 seconds on all-success
  useEffect(() => {
    if (isComplete && failed === 0) {
      const timer = setTimeout(onDismiss, 3000);
      return () => clearTimeout(timer);
    }
  }, [isComplete, failed, onDismiss]);

  const pct = total > 0 ? (completed / total) * 100 : 0;

  const nounPlural = noun;
  const nounSingular = noun.endsWith('s') ? noun.slice(0, -1) : noun;
  const pastTense =
    actionVerb === 'Creating'
      ? 'created'
      : actionVerb === 'Updating'
        ? 'updated'
        : `${actionVerb.toLowerCase()}d`;

  let statusText: string;
  let statusClass = 'text-muted-foreground';
  if (!isComplete) {
    statusText = `${actionVerb} ${total} ${nounPlural}...`;
  } else if (failed === 0) {
    const label = succeeded === 1 ? nounSingular : nounPlural;
    statusText = `${succeeded} ${label} ${pastTense}`;
    statusClass = 'text-green-600 dark:text-green-400';
  } else if (succeeded === 0) {
    statusText = `All ${total} ${nounPlural} failed`;
    statusClass = 'text-destructive';
  } else {
    statusText = `${succeeded} ${pastTense}, ${failed} failed`;
    statusClass = 'text-destructive';
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <Progress value={pct} />
      <div className="flex items-center justify-between">
        <p aria-live="polite" className={`text-sm font-medium ${statusClass}`}>
          {statusText}
        </p>
        {isComplete && failed > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails((prev) => !prev)}
            className="text-xs gap-1"
          >
            View Details
            {showDetails ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </Button>
        )}
        {isComplete && failed === 0 && (
          <Button variant="ghost" size="sm" onClick={onDismiss} className="text-xs">
            Dismiss
          </Button>
        )}
      </div>
      {showDetails && failures.length > 0 && (
        <ul className="text-xs text-destructive space-y-0.5 max-h-32 overflow-y-auto">
          {failures.map((f) => (
            <li key={f.key}>
              {f.key}: {f.error}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
