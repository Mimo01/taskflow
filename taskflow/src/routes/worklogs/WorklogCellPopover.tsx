/**
 * WorklogCellPopover — Cell drill-down popover for non-zero worklog data cells.
 *
 * Opens when the user clicks a non-zero (issueKey, date) cell in the hierarchy table.
 * Shows individual Tempo worklog entries with edit/delete affordances and an
 * "Add entry" section that reuses LogWorkPopover from issue-detail/.
 *
 * On any mutation success, invalidates the broad ['tempo', 'worklogs'] cache prefix
 * (D-14) so the hierarchy table refetches and reflects the updated hours.
 *
 * Pitfall 4 (PATTERNS §Pitfall 4 — nested Radix Popover): LogWorkPopover renders its
 * own nested Popover. This is acceptable with Base UI Popover (not Radix) — tested
 * in the human-verify checkpoint. If focus/dismiss conflicts appear, fall back to
 * extracting the inline form.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LogWorkPopover } from '@/routes/dashboard/issue-detail/LogWorkPopover';
import type { TempoWorklog } from '@/services/tempo';
import { WorklogEntryRow } from './WorklogEntryRow';

// formatSeconds and formatDayHeader are re-exported from WorklogsPage (see below).
// We import them here so WorklogCellPopover is decoupled from WorklogsPage internals.
import { formatSeconds, formatDayHeader } from './WorklogsPage';

interface WorklogCellPopoverProps {
  issueKey: string;
  date: string; // YYYY-MM-DD
  entries: TempoWorklog[]; // worklog entries for this (issueKey, date) cell
  jiraBaseUrl: string;
  totalSeconds: number; // pre-aggregated cell total, used as trigger label
  dayColClassName?: string; // schedule-day background class from parent
  children?: never;
}

export function WorklogCellPopover({
  issueKey,
  date,
  entries,
  jiraBaseUrl,
  totalSeconds,
  dayColClassName,
}: WorklogCellPopoverProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  function handleMutationSuccess() {
    queryClient.invalidateQueries({ queryKey: ['tempo', 'worklogs'] });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={`group w-full h-full min-h-[2rem] flex items-center justify-center cursor-pointer hover:bg-accent/60 px-2 py-1.5 ${dayColClassName ?? ''}`}
        aria-label={`View worklogs for ${issueKey} on ${date}`}
      >
        {totalSeconds > 0 ? (
          <span className="font-medium">{formatSeconds(totalSeconds)}</span>
        ) : (
          // CSS ::after keeps DOM textContent empty (D-08: zero cells render as blank)
          <span className="after:content-['+'] opacity-0 group-hover:opacity-30 text-muted-foreground text-[10px] select-none transition-opacity" />
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4">
        {/* Header: issueKey · day label */}
        <p className="text-xs font-semibold mb-2">
          {issueKey} · {formatDayHeader(date)}
        </p>

        {/* Scrollable entry list */}
        <div className="max-h-48 overflow-y-auto space-y-1">
          {entries.map((entry, idx) => (
            <WorklogEntryRow
              key={entry.jiraWorklogId ?? entry.tempoWorklogId ?? idx}
              entry={entry}
              issueKey={issueKey}
              jiraBaseUrl={jiraBaseUrl}
              onMutationSuccess={handleMutationSuccess}
            />
          ))}
        </div>

        {/* Separator */}
        <div className="border-t border-border mt-2 pt-2">
          {/* Add-entry section using existing LogWorkPopover */}
          <LogWorkPopover
            issueKey={issueKey}
            jiraBaseUrl={jiraBaseUrl}
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ['tempo', 'worklogs'] })}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
