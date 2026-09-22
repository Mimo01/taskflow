/**
 * SprintBoardHeader -- fixed, single-line chrome showing the active sprint's
 * name (with a state badge) and, when present, its goal as de-emphasized
 * inline text.
 *
 * Styled to match the Backlog page header band (untinted `px-4 py-3
 * border-b`, `text-lg font-semibold` title) so the Sprint Board reads as an
 * app-level page rather than a sub-toolbar. Returns null when there is
 * nothing to show (no name and no goal).
 */
import { Badge } from '@/components/ui/badge';

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
      className="flex items-center gap-2 min-w-0 border-b px-4 py-3"
    >
      {trimmedName && (
        <h1 className="min-w-0 max-w-[40%] truncate text-lg font-semibold text-foreground">
          {trimmedName}
        </h1>
      )}
      {state && (
        <Badge variant="secondary" tone="green" className="shrink-0">
          {state}
        </Badge>
      )}
      {trimmedGoal && (
        <>
          <span className="shrink-0 text-muted-foreground/50" aria-hidden="true">
            &middot;
          </span>
          <span
            className="flex-1 min-w-0 truncate pr-0.5 text-xs text-muted-foreground"
            title={goal ?? undefined}
          >
            {trimmedGoal}
          </span>
        </>
      )}
    </header>
  );
}
