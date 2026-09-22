/**
 * SprintBoardHeader -- fixed chrome showing the active sprint's name (with a
 * state badge) on the first line and, when present, its goal on a second
 * line below it.
 *
 * Styled to match the Backlog page header band (untinted `px-4 py-3
 * border-b`, `text-lg font-semibold` title) so the Sprint Board reads as an
 * app-level page rather than a sub-toolbar. Returns null when there is
 * nothing to show (no name and no goal).
 */
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface SprintBoardHeaderProps {
  name?: string | null;
  goal?: string | null;
  state?: string | null;
}

export function SprintBoardHeader({ name, goal, state }: SprintBoardHeaderProps) {
  const trimmedName = name?.trim();
  const trimmedGoal = goal?.trim();

  if (!trimmedName && !trimmedGoal) return null;

  return (
    // biome-ignore lint/a11y/noInteractiveElementToNoninteractiveRole: explicit role="banner" needed — this <header> is nested and would not compute an implicit banner landmark role
    <header
      role="banner"
      aria-label="Sprint header"
      className="flex flex-col gap-1 min-w-0 border-b px-4 py-3"
    >
      <div className="flex items-center gap-2 min-w-0">
        {trimmedName && (
          <h1 className="min-w-0 max-w-[60%] truncate text-lg font-semibold text-foreground">
            {trimmedName}
          </h1>
        )}
        {state && (
          <Badge variant="secondary" tone="green" className="shrink-0">
            {state}
          </Badge>
        )}
      </div>
      {trimmedGoal && (
        <span
          className="min-w-0 truncate pr-0.5 text-xs text-muted-foreground"
          title={goal ?? undefined}
        >
          {trimmedGoal}
        </span>
      )}
    </header>
  );
}

/** Placeholder occupying the same header slot while the sprint is loading. */
export function SprintBoardHeaderSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading sprint header"
      className="flex flex-col gap-2 min-w-0 border-b px-4 py-3"
    >
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-3.5 w-72" />
    </div>
  );
}
