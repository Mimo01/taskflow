/**
 * SprintBoardHeader -- fixed, single-line chrome showing the active sprint's
 * name (with a state badge) and, when present, its goal as de-emphasized
 * inline text.
 *
 * Styled to match the Backlog section-header treatment (bg-muted/40 tint,
 * solid border-b) so the sticky chrome reads as one consistent app pattern
 * rather than a one-off. Returns null when there is nothing to show (no
 * name and no goal).
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
      className="flex items-center gap-2 min-w-0 bg-muted/40 border-b border-border px-3 py-1.5 density-compact:py-1 density-comfortable:py-2.5"
    >
      {trimmedName && (
        <span className="shrink-0 min-w-0 max-w-[40%] truncate text-sm font-semibold text-foreground">
          {trimmedName}
        </span>
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
