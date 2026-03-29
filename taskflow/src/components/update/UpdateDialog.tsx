/**
 * UpdateDialog — Update lifecycle dialog component.
 *
 * Driven by useUpdateStore status:
 *   available   → AvailableView: show version info + changelog, "Later" / "Update Now"
 *   downloading → DownloadingView: progress bar, non-dismissable
 *   error       → ErrorView: error message, "Dismiss" / "Retry"
 *
 * After download completes, the app relaunches immediately via plugin:process|relaunch.
 * Per D-06: downloading state is non-dismissable (no onOpenChange, no close button).
 */

import { invoke } from '@tauri-apps/api/core';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
// Calls plugin:process|relaunch via invoke — @tauri-apps/plugin-process not installed
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { buildInfo } from '@/lib/build-info';
import { updaterService } from '@/services/updater';
import { useSettingsStore } from '@/stores/settings.store';
import { useUpdateStore } from '@/stores/update.store';

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
  const { setLastSeenChangelog } = useSettingsStore();

  const open = status === 'available' || status === 'downloading' || status === 'error';

  // Non-dismissable state: downloading
  const isDismissable = status === 'available' || status === 'error';

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
      // Persist changelog before restart, then relaunch immediately
      setLastSeenChangelog(changelog);
      await invoke('plugin:process|relaunch');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={isDismissable ? () => resetToIdle() : undefined}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        {status === 'available' && (
          <>
            <DialogHeader>
              <DialogTitle>Update Available</DialogTitle>
              <DialogDescription>
                v{buildInfo.version} &rarr; v{availableVersion}
              </DialogDescription>
            </DialogHeader>
            {releaseDate && (
              <p className="text-xs text-muted-foreground -mt-2">
                Released{' '}
                {new Date(releaseDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            )}
            <div className="max-h-72 overflow-y-auto prose prose-sm dark:prose-invert max-w-none [&>h2]:text-sm [&>h2]:font-semibold [&>h2]:mt-3 [&>h2]:mb-1 [&>ul]:my-1 [&>ul]:pl-4">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{changelog ?? ''}</ReactMarkdown>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetToIdle}>
                Later
              </Button>
              <Button variant="default" onClick={handleUpdateNow}>
                Update Now
              </Button>
            </DialogFooter>
          </>
        )}

        {status === 'downloading' && (
          <>
            <DialogHeader>
              <DialogTitle>Downloading Update</DialogTitle>
              <DialogDescription>v{availableVersion}</DialogDescription>
            </DialogHeader>
            <div
              className="w-full bg-muted rounded-full h-2"
              role="progressbar"
              aria-valuenow={downloadProgress ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="bg-primary h-2 rounded-full transition-all duration-200"
                style={{ width: `${downloadProgress ?? 0}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right mt-1">
              {downloadProgress ?? 0}%
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={resetToIdle}>
                Stop Download
              </Button>
            </DialogFooter>
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
