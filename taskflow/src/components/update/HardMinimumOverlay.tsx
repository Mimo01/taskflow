/**
 * HardMinimumOverlay — Full-screen blocking overlay for hard minimum version violation.
 *
 * Covers entire app with z-[200] fixed overlay. No dismiss mechanism.
 * "Update Now" triggers update check — opens UpdateDialog via update store state.
 * Fails gracefully: shows inline error if update check fails.
 *
 * Per D-15: prevents all app interaction when version is below hardMinimum.
 */
import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildInfo } from '@/lib/build-info';
import { updaterService } from '@/services/updater';
import { useUpdateStore } from '@/stores/update.store';
import type { VersionPolicy } from '@/services/versionPolicy';

interface HardMinimumOverlayProps {
  policy: VersionPolicy;
}

export function HardMinimumOverlay({ policy }: HardMinimumOverlayProps) {
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const { setChecking: storeSetChecking, setAvailable } = useUpdateStore();

  const body =
    policy.message ??
    `v${buildInfo.version} is no longer supported. Please update to continue using Taskflow.`;

  async function handleUpdate() {
    setCheckError(null);
    setChecking(true);
    try {
      storeSetChecking();
      const info = await updaterService.check();
      if (info) {
        setAvailable(info.version, info.body, info.date);
        // UpdateDialog will open automatically via update store status='available'
      }
    } catch {
      setCheckError("Couldn't check for updates. Check your connection.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-background p-8">
      <Lock className="size-12 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Update Required</h1>
      <p className="text-sm text-muted-foreground text-center max-w-md">{body}</p>
      <Button variant="default" onClick={handleUpdate} disabled={checking}>
        {checking ? 'Checking...' : 'Update Now'}
      </Button>
      {checkError && <p className="text-sm text-destructive">{checkError}</p>}
    </div>
  );
}
