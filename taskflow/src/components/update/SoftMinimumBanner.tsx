/**
 * SoftMinimumBanner — Dismissible nag banner for soft minimum version violation.
 *
 * Appears when current app version is below softMinimum but NOT below hardMinimum.
 * Dismissible once per session (React useState in AppLayout — not persisted per D-14).
 * Reappears on next app launch.
 *
 * Follows stale-data-banner.tsx pattern.
 */
import { TriangleAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildInfo } from '@/lib/build-info';
import type { VersionPolicy } from '@/services/versionPolicy';

interface SoftMinimumBannerProps {
  policy: VersionPolicy;
  onDismiss: () => void;
  onUpdate: () => void;
}

export function SoftMinimumBanner({ policy, onDismiss, onUpdate }: SoftMinimumBannerProps) {
  const message =
    policy.message ??
    `Your version (v${buildInfo.version}) is outdated. Update for the latest fixes and features.`;

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-2 text-sm">
      <TriangleAlert className="size-4 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground flex-1">{message}</span>
      <Button variant="default" size="sm" onClick={onUpdate}>
        Update Now
      </Button>
      <Button variant="ghost" size="sm" onClick={onDismiss}>
        <X className="size-4" />
        <span className="sr-only">Dismiss update reminder</span>
      </Button>
    </div>
  );
}
