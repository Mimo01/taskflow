/**
 * SprintGoalBanner -- displays the active sprint's goal as a colored accent banner.
 *
 * Renders below the sprint name/header row and above the filter area.
 * Hidden entirely when no goal is set (returns null).
 * Full goal text is always shown -- no truncation, no expand/collapse.
 */

interface SprintGoalBannerProps {
  goal: string | undefined | null;
}

export function SprintGoalBanner({ goal }: SprintGoalBannerProps) {
  if (!goal?.trim()) return null;

  return (
    <div
      role="banner"
      aria-label="Sprint goal"
      className="bg-muted border-l-4 border-primary rounded-md px-4 py-3 mx-3 my-2"
    >
      <p className="text-sm text-foreground">{goal}</p>
    </div>
  );
}
