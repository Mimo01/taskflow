/**
 * BulkProgressIndicator -- inline progress display during bulk operations.
 *
 * Shows a progress bar, status text, and per-issue failure details.
 * Auto-dismisses after 3 seconds on all-success.
 */

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface BulkProgressIndicatorProps {
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  failures: Array<{ key: string; error: string }>;
  isComplete: boolean;
  onDismiss: () => void;
}

export function BulkProgressIndicator({
  total,
  completed,
  succeeded,
  failed,
  failures,
  isComplete,
  onDismiss,
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

  let statusText: string;
  let statusClass = 'text-muted-foreground';
  if (!isComplete) {
    statusText = `Updating ${total} issues...`;
  } else if (failed === 0) {
    statusText = `${succeeded} updated successfully`;
    statusClass = 'text-green-600 dark:text-green-400';
  } else if (succeeded === 0) {
    statusText = `All ${total} updates failed`;
    statusClass = 'text-destructive';
  } else {
    statusText = `${succeeded} updated, ${failed} failed`;
    statusClass = 'text-destructive';
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <div
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={total}
        className="w-full bg-muted rounded-full h-1.5 overflow-hidden"
      >
        <div
          className="h-1.5 bg-primary rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
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
