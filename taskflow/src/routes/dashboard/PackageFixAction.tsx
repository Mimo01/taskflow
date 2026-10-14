import { Button } from '@/components/ui/button';
import { formatWeekLabel, type PackageFix, packageFixLabel } from '@/lib/deployment-package';

/** What a fix will set, as readable text (the thing the user actually cares about). */
export function packageFixTarget(fix: PackageFix): string {
  if (fix.kind === 'set-fix-version') return `Fix version: ${fix.versionName}`;
  return fix.weekSummary
    ? `Package: ${formatWeekLabel(fix.weekSummary)} (${fix.childKey})`
    : `Package: ${fix.childKey}`;
}

interface PackageFixActionProps {
  fix: PackageFix;
  onApply: () => void;
  disabled?: boolean;
  /** Replaces the action (e.g. "Open in Jira" when the field is not editable). */
  actionLabel?: string;
}

/**
 * One suggested fix: the target as wrapping text plus a compact button. The
 * full sentence stays as the button's accessible name.
 */
export function PackageFixAction({ fix, onApply, disabled, actionLabel }: PackageFixActionProps) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span className="min-w-0 flex-1 basis-40 break-words text-muted-foreground">
        {packageFixTarget(fix)}
      </span>
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="shrink-0"
        disabled={disabled}
        aria-label={actionLabel ?? packageFixLabel(fix)}
        onClick={onApply}
      >
        {actionLabel ?? 'Apply'}
      </Button>
    </div>
  );
}
