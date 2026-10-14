import { Check } from 'lucide-react';
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
 * One suggested fix: "→ target" as wrapping text plus a small check icon button.
 * The full sentence stays as the button's accessible name.
 */
export function PackageFixAction({ fix, onApply, disabled, actionLabel }: PackageFixActionProps) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="min-w-0 flex-1 break-words pt-0.5 text-muted-foreground">
        <span aria-hidden="true">→ </span>
        {packageFixTarget(fix)}
      </span>
      {actionLabel ? (
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="shrink-0"
          disabled={disabled}
          onClick={onApply}
        >
          {actionLabel}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          className="shrink-0"
          disabled={disabled}
          title="Apply"
          aria-label={packageFixLabel(fix)}
          onClick={onApply}
        >
          <Check aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
