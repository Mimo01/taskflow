import { CalendarDays, Folder, Pin } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCycleDates, isOverdue, toDateKey } from '@/lib/aio-cycle-list';
import { formatDateKey } from '@/lib/epic-progress';
import { relativeTime } from '@/lib/relative-time';
import { aioCycleStatusPillClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import type { AioCycle } from '@/services/aio';
import { UserChip } from './UserChip';

/** Epoch-ms number or ISO string -> ISO string; unknown shapes -> null. */
function toIso(raw: unknown): string | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return new Date(raw).toISOString();
  if (typeof raw === 'string' && raw && !Number.isNaN(new Date(raw).getTime())) return raw;
  return null;
}

/**
 * Cycle title row (name, key, status pill, Pin) plus a metadata line. Every metadata
 * item is conditional: an absent field renders no element and no separator.
 */
export function CycleHeader({
  cycle,
  cycleKey,
  ownerID,
  lastExecuted,
  pinned,
  onTogglePin,
  jiraBaseUrl,
  token,
}: {
  cycle: AioCycle | undefined;
  cycleKey: string;
  ownerID: string | undefined;
  /** ISO date of the most recent run update, or null. */
  lastExecuted: string | null;
  pinned: boolean;
  onTogglePin: () => void;
  jiraBaseUrl: string | null | undefined;
  token: string | null | undefined;
}) {
  const today = toDateKey(Date.now()) ?? '';
  const name = cycle?.name ?? cycleKey;
  const isClosed = cycle ? /^closed$/i.test(cycle.status) : false;

  const dates = cycle ? formatCycleDates(cycle.startDate, cycle.endDate, today) : null;
  const overdue = cycle ? isOverdue({ isClosed, endDate: cycle.endDate ?? null }, today) : false;
  const closedKey = isClosed ? toDateKey(cycle?.closedDate) : null;
  const updatedIso = !closedKey ? toIso(cycle?.updatedDate) : null;
  const lastRunKey = toDateKey(lastExecuted);

  const items: { id: string; node: ReactNode }[] = [];
  if (ownerID) {
    items.push({
      id: 'owner',
      node: (
        <span data-testid="cycle-meta-owner" className="flex min-w-0 items-center">
          <UserChip userId={ownerID} jiraBaseUrl={jiraBaseUrl} token={token} size={18} />
        </span>
      ),
    });
  }
  if (cycle?.folder) {
    items.push({
      id: 'folder',
      node: (
        <span data-testid="cycle-meta-folder" className="flex min-w-0 items-center gap-1">
          <Folder className="size-3.5 flex-none" aria-hidden />
          <span className="truncate">{cycle.folder}</span>
        </span>
      ),
    });
  }
  if (dates) {
    items.push({
      id: 'dates',
      node: (
        <span
          data-testid="cycle-meta-dates"
          className={cn('flex items-center gap-1', overdue && 'text-red-600 dark:text-red-400')}
        >
          <CalendarDays className="size-3.5 flex-none" aria-hidden />
          {dates}
        </span>
      ),
    });
  }
  if (closedKey) {
    items.push({
      id: 'closed',
      node: <span data-testid="cycle-meta-closed">Closed {formatDateKey(closedKey)}</span>,
    });
  } else if (updatedIso) {
    items.push({
      id: 'updated',
      node: <span data-testid="cycle-meta-updated">Updated {relativeTime(updatedIso)}</span>,
    });
  }
  for (const f of cycle?.customFields ?? []) {
    items.push({
      id: `cf-${f.name}`,
      node: (
        <span data-testid="cycle-meta-field" className="flex min-w-0 items-center gap-1">
          <span>{f.name}:</span>
          <span className="truncate font-medium text-foreground">{f.value}</span>
        </span>
      ),
    });
  }
  if (lastRunKey) {
    items.push({
      id: 'lastrun',
      node: <span data-testid="cycle-meta-lastrun">Last run {formatDateKey(lastRunKey)}</span>,
    });
  }

  return (
    <div className="flex flex-none flex-col gap-1 px-6 pt-3 pb-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="min-w-0 truncate text-lg font-semibold">{name}</h1>
          <span className="flex-none font-mono text-xs text-muted-foreground">{cycleKey}</span>
          {cycle && (
            <div className="flex flex-none">
              <span className={aioCycleStatusPillClass(cycle.status)}>{cycle.status}</span>
            </div>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="flex-none gap-1.5 text-xs"
          aria-label={pinned ? `Unpin cycle ${cycleKey}` : `Pin cycle ${cycleKey}`}
          title={pinned ? 'Unpin from tabs' : 'Pin to tabs'}
          onClick={onTogglePin}
        >
          <Pin className={`size-3.5 ${pinned ? 'fill-current text-primary' : ''}`} />
          {pinned ? 'Unpin' : 'Pin'}
        </Button>
      </div>
      {!cycle && <Skeleton className="h-4 w-72" />}
      {items.length > 0 && (
        <div
          data-testid="cycle-meta"
          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
        >
          {items.map((it, i) => (
            <Fragment key={it.id}>
              {i > 0 && (
                <span aria-hidden className="text-border">
                  ·
                </span>
              )}
              {it.node}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
