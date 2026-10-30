import { BreakdownErrorDash } from '@/components/release/ReleaseIssueGraph';
import { Skeleton } from '@/components/ui/skeleton';
import { dateStamp } from '@/lib/release-agenda';
import { breakdownTotal, type StatusBreakdown } from '@/lib/release-list';
import type { JiraFixVersion } from '@/services/jira';

/** Released versions: their own muted panel below the agenda, never on the rail. */
export function ReleasedPanel({
  versions,
  breakdowns,
  loadingIds,
  errorIds,
  hasMore,
  onShowMore,
  onOpen,
}: {
  versions: JiraFixVersion[];
  breakdowns: ReadonlyMap<string, StatusBreakdown>;
  loadingIds: ReadonlySet<string>;
  /** Ids whose counts fetch failed (no data, not loading). */
  errorIds: ReadonlySet<string>;
  hasMore: boolean;
  onShowMore: () => void;
  onOpen: (id: string) => void;
}) {
  if (versions.length === 0) return null;
  return (
    <section aria-label="Released" className="mt-7 rounded-xl bg-muted/55 px-2 pt-3 pb-2">
      <div className="flex items-baseline gap-2 px-3 pb-2">
        <span className="text-[11px] font-bold tracking-[.06em] text-green-600 uppercase dark:text-green-400">
          Released
        </span>
        <span className="text-xs text-muted-foreground">{versions.length} most recent</span>
      </div>
      {versions.map((v) => {
        const b = breakdowns.get(v.id);
        return (
          <button
            key={v.id}
            type="button"
            data-testid="released-row"
            title={v.name}
            onClick={() => onOpen(v.id)}
            className="grid w-full grid-cols-[74px_minmax(0,1fr)_auto] cursor-pointer items-center gap-3.5 rounded-lg px-3 py-[7px] text-left hover:bg-background"
          >
            <span className="text-right text-[12.5px] whitespace-nowrap text-muted-foreground tabular-nums">
              {v.releaseDate ? dateStamp(v.releaseDate).inline : '–'}
            </span>
            <span className="truncate text-[13.5px] text-muted-foreground">{v.name}</span>
            <span className="text-[12.5px] whitespace-nowrap">
              {b && breakdownTotal(b) === 0 ? (
                // Same wording and tone as the agenda's empty slot, never a green "✓ 0 done".
                <span className="text-muted-foreground/75">No issues yet</span>
              ) : b ? (
                <span className="font-medium text-green-600 dark:text-green-400">
                  {`✓ ${b.done} done`}
                </span>
              ) : loadingIds.has(v.id) ? (
                <Skeleton className="h-3 w-14" />
              ) : errorIds.has(v.id) ? (
                <BreakdownErrorDash />
              ) : null}
            </span>
          </button>
        );
      })}
      {hasMore && (
        <button
          type="button"
          onClick={onShowMore}
          className="cursor-pointer py-1.5 pr-3 pl-[100px] text-[12.5px] text-muted-foreground hover:text-foreground"
        >
          Show older releases ↓
        </button>
      )}
    </section>
  );
}
