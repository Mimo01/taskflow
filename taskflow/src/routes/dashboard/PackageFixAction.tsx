import { Button } from '@/components/ui/button';
import { formatWeekLabel, type PackageFix, packageFixLabel } from '@/lib/deployment-package';

/** What a fix will set, as readable text (the thing the user actually cares about). */
export function packageFixTarget(fix: PackageFix): string {
  if (fix.kind === 'set-fix-version') return fix.versionName;
  return fix.weekSummary ? `${formatWeekLabel(fix.weekSummary)} (${fix.childKey})` : fix.childKey;
}

interface PackageFixActionProps {
  fix: PackageFix;
  onApply: () => void;
  disabled?: boolean;
  /** Replaces the action (e.g. "Open in Jira" when the field is not editable). */
  actionLabel?: string;
}

/**
 * One suggested fix: "→ target" as wrapping text with an "Apply" button below it.
 * The full sentence stays as the button's accessible name.
 */
export function PackageFixAction({ fix, onApply, disabled, actionLabel }: PackageFixActionProps) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <span className="min-w-0 break-words text-muted-foreground">
        <span aria-hidden="true">→ </span>
        {packageFixTarget(fix)}
      </span>
      <Button
        type="button"
        variant="outline"
        size="xs"
        disabled={disabled}
        aria-label={actionLabel ?? packageFixLabel(fix)}
        onClick={onApply}
      >
        {actionLabel ?? 'Apply'}
      </Button>
    </div>
  );
}
