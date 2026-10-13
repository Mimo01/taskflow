import { cn } from '@/lib/utils';
import { useAioCyclesSelectionStore } from '@/stores/aio-cycles-selection.store';

/**
 * Header of the AIO Cycles dashboard pane: folder title, open/closed counts and the
 * persisted Open|All control that scopes the execution metrics, owner chart and list.
 */
export function AioCyclesScopeBar({
  folderLabel,
  folderTitle,
  openCount,
  closedCount,
  loading,
}: {
  folderLabel: string;
  folderTitle: string;
  openCount: number;
  closedCount: number;
  /** Cycles not loaded yet: hide the counts rather than show 0 · 0. */
  loading: boolean;
}) {
  const statusFilter = useAioCyclesSelectionStore((s) => s.statusFilter);
  const setStatusFilter = useAioCyclesSelectionStore((s) => s.setStatusFilter);

  return (
    <div className="flex items-center gap-3">
      <h2 className="truncate text-base font-semibold" title={folderTitle}>
        {folderLabel}
      </h2>
      {!loading && (
        <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
          {openCount} open · {closedCount} closed
        </span>
      )}
      <fieldset className="m-0 ml-auto inline-flex rounded-lg border-0 bg-muted p-0.5">
        <legend className="sr-only">Cycle status</legend>
        {(
          [
            { value: 'open', label: 'Open' },
            { value: 'all', label: 'All' },
          ] as const
        ).map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={statusFilter === value}
            onClick={() => setStatusFilter(value)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              statusFilter === value
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </fieldset>
    </div>
  );
}
