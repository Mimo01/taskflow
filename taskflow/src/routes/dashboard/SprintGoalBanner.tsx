/**
 * SprintGoalBanner -- displays the active sprint's goal as a subtle inline accent.
 *
 * Renders above the filter area as a compact, single-line strip with a muted
 * left-border accent. Designed to inform without dominating the board layout.
 * Hidden entirely when no goal is set (returns null).
 */
import { Target } from 'lucide-react';

interface SprintGoalBannerProps {
  goal: string | undefined | null;
}

export function SprintGoalBanner({ goal }: SprintGoalBannerProps) {
  if (!goal?.trim()) return null;

  return (
    <header
      aria-label="Sprint goal"
      className="flex items-center gap-2 border-b border-border/40 bg-muted/30 px-4 py-2"
    >
      <Target className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="text-xs font-medium text-muted-foreground">Goal</span>
      <span className="text-xs text-foreground/80 truncate">{goal}</span>
    </header>
  );
}
