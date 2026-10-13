import { FolderTree } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody } from '@/components/ui/tooltip-body';
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
  subfolders = [],
}: {
  folderLabel: string;
  folderTitle: string;
  openCount: number;
  closedCount: number;
  /** Cycles not loaded yet: hide the counts rather than show 0 · 0. */
  loading: boolean;
  /** Names of the selected folder's direct subfolders; non-empty marks a parent folder. */
  subfolders?: string[];
}) {
  const statusFilter = useAioCyclesSelectionStore((s) => s.statusFilter);
  const setStatusFilter = useAioCyclesSelectionStore((s) => s.setStatusFilter);

  return (
    <div className="flex items-center gap-3">
      <h2 className="truncate text-base font-semibold" title={folderTitle}>
        {folderLabel}
      </h2>
      {subfolders.length > 0 && (
        <Tooltip>
          <TooltipTrigger
            delay={0}
            render={<Badge tone="blue" />}
            data-testid="parent-folder-badge"
            className="cursor-default"
          >
            <FolderTree aria-hidden />
            Parent folder · {subfolders.length}{' '}
            {subfolders.length === 1 ? 'subfolder' : 'subfolders'}
          </TooltipTrigger>
          <TooltipContent>
            <TooltipBody
              title="Includes every cycle in"
              note={subfolders.length > 4 ? `+${subfolders.length - 4} more` : undefined}
            >
              {subfolders.slice(0, 4).map((name) => (
                <div key={name} className="truncate">
                  {name}
                </div>
              ))}
            </TooltipBody>
          </TooltipContent>
        </Tooltip>
      )}
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
