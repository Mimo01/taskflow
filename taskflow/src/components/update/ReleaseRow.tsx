/**
 * ReleaseRow — one release on a single line (version | summary | date); opening
 * it turns the row into a bordered card with the release notes underneath.
 * Shared by Settings → Updates and the skipped-release lists in the update dialogs.
 */

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ReleaseEntry } from '@/services/releases';
import { ReleaseNotesBody } from './ReleaseNotesBody';

/** Column grid: version | summary | date. Notes line up with the same columns. */
export const RELEASE_ROW_GRID = 'grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-x-3';

export function shortReleaseDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function ReleaseRow({
  release,
  summary,
  open,
  onToggle,
  installed = false,
  wrap = false,
}: {
  release: ReleaseEntry;
  summary: string | null;
  open: boolean;
  onToggle: () => void;
  installed?: boolean;
  /** Let the summary wrap to two lines (narrow containers such as dialogs). */
  wrap?: boolean;
}) {
  const plainSummary = summary?.replace(/\*\*|`/g, '') ?? '';
  return (
    <li
      className={cn(
        'list-none',
        // Opened release: its own bordered card, spaced off its neighbours.
        open && 'my-2 rounded-lg border border-border bg-muted/40',
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={cn(
          RELEASE_ROW_GRID,
          'min-h-9 w-full rounded-lg px-2 text-left text-sm',
          !open && 'hover:bg-muted/50',
        )}
      >
        <span className="font-medium tabular-nums">{release.version}</span>
        <span
          className={cn(
            // The installed row gives up width to its badge, so its summary may wrap
            // to a second line rather than truncate; every other row stays one line.
            installed || wrap ? 'line-clamp-2 py-1.5' : 'truncate',
            open ? 'text-foreground' : 'text-muted-foreground',
          )}
          title={plainSummary}
        >
          {plainSummary}
        </span>
        <span className="flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
          {installed && <Badge tone="green">Installed</Badge>}
          {release.publishedAt ? shortReleaseDate(release.publishedAt) : ''}
        </span>
      </button>
      {open && (
        <div className="px-2 pb-3 pt-1">
          <ReleaseNotesBody notes={release.body} details hideHeadline compact />
        </div>
      )}
    </li>
  );
}
