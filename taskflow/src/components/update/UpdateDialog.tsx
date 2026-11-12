/**
 * UpdateDialog — Update lifecycle dialog component.
 *
 * Driven by useUpdateStore status:
 *   available   → notes body (shared ReleaseNotesBody) + skipped-releases roll-up, "Later" / "Update now"
 *   downloading → same body, progress bar replaces the footer, non-dismissable
 *   error       → ErrorView: error message, "Dismiss" / "Retry"
 *
 * After download completes, the app restarts immediately via plugin:process|restart.
 * Per D-06: downloading state is non-dismissable (no onOpenChange, no close button).
 */

import { invoke } from '@tauri-apps/api/core';
import { validate } from 'compare-versions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useReleaseHistory } from '@/hooks/useReleaseHistory';
import { buildInfo } from '@/lib/build-info';
import { persistChangelogBeforeRestart } from '@/lib/tauri-storage';
import { selectRollup } from '@/services/releases';
import { updaterService } from '@/services/updater';
import { useUpdateStore } from '@/stores/update.store';
import { ReleaseNotesBody } from './ReleaseNotesBody';
import { ReleaseRollup } from './ReleaseRollup';

// ─── Main UpdateDialog ──────────────────────────────────────────────────────

export function UpdateDialog() {
  const {
    status,
    availableVersion,
    changelog,
    releaseDate,
    downloadProgress,
    errorMessage,
    setDownloading,
    setProgress,
    setError,
    resetToIdle,
  } = useUpdateStore();

  const open = status === 'available' || status === 'downloading' || status === 'error';

  // Non-dismissable state: downloading
  const isDismissable = status === 'available' || status === 'error';

  // Skipped-releases roll-up: only while the notice is showing, never in dev
  // builds, and never blocking — loading/error just means local notes only.
  const rollupEnabled =
    status === 'available' &&
    !buildInfo.version.includes('-dev') &&
    validate(buildInfo.version) &&
    !!availableVersion &&
    validate(availableVersion);
  const { data: history } = useReleaseHistory({ enabled: rollupEnabled });
  const skipped =
    rollupEnabled && history && availableVersion
      ? selectRollup(history, buildInfo.version, availableVersion)
      : [];

  async function handleUpdateNow() {
    setDownloading();
    let accumulated = 0;
    try {
      await updaterService.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          accumulated = 0;
        } else if (event.event === 'Progress') {
          const data = event.data as { chunkLength?: number; contentLength?: number } | undefined;
          if (data?.chunkLength && data?.contentLength) {
            accumulated += data.chunkLength;
            const pct = Math.min(100, Math.round((accumulated / data.contentLength) * 100));
            setProgress(pct);
          }
        } else if (event.event === 'Finished') {
          setProgress(100);
        }
      });
      // Persist changelog directly to Tauri store (fully awaited) before restart.
      // Zustand's persist middleware fires storage.setItem() without awaiting the
      // returned Promise, so calling setLastSeenChangelog() and then immediately
      // invoke('plugin:process|restart') kills the process before the async
      // store.save() completes. persistChangelogBeforeRestart() bypasses Zustand
      // and awaits the write+save explicitly so the value survives the restart.
      await persistChangelogBeforeRestart(changelog);
      await invoke('plugin:process|restart');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={isDismissable ? () => resetToIdle() : undefined}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        {(status === 'available' || status === 'downloading') && (
          <>
            <DialogHeader>
              <DialogTitle>Update available</DialogTitle>
              <DialogDescription>
                {buildInfo.version} &rarr; {availableVersion}
                {releaseDate &&
                  ` · ${new Date(releaseDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}`}
                {skipped.length > 0 && ` (${skipped.length + 1} releases)`}
              </DialogDescription>
            </DialogHeader>
            <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
              <ReleaseNotesBody notes={changelog} />
              <ReleaseRollup releases={skipped} />
            </div>
            {status === 'available' ? (
              <DialogFooter>
                <Button variant="outline" onClick={resetToIdle}>
                  Later
                </Button>
                <Button variant="default" onClick={handleUpdateNow}>
                  Update now
                </Button>
              </DialogFooter>
            ) : (
              <div className="flex flex-col gap-1">
                <div
                  className="w-full bg-muted rounded-full h-2"
                  role="progressbar"
                  aria-label="Downloading update"
                  aria-valuenow={downloadProgress ?? 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-200"
                    style={{ width: `${downloadProgress ?? 0}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  Downloading update… {downloadProgress ?? 0}%
                </p>
              </div>
            )}
          </>
        )}

        {status === 'error' && (
          <>
            <DialogHeader>
              <DialogTitle>Download Failed</DialogTitle>
              <DialogDescription className="text-destructive">
                {errorMessage ?? 'Download failed. Check your connection and try again.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={resetToIdle}>
                Dismiss
              </Button>
              <Button variant="destructive" onClick={handleUpdateNow}>
                Retry
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
