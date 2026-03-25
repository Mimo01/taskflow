/**
 * UpdateDialog — Update lifecycle dialog component.
 *
 * Driven by useUpdateStore status:
 *   available   → AvailableView: show version info + changelog, "Later" / "Update Now"
 *   downloading → DownloadingView: progress bar, non-dismissable
 *   ready       → ReadyView: 10s countdown before auto-restart, cancellable
 *   error       → ErrorView: error message, "Dismiss" / "Retry"
 *
 * Per D-06: downloading and ready states are non-dismissable (no onOpenChange, no close button).
 */

import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
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

// ─── ReadyView (internal sub-component with countdown) ─────────────────────

interface ReadyViewProps {
  availableVersion: string | null;
  changelog: string | null;
  releaseDate: string | null;
  onRestartLater: () => void;
}

function ReadyView({ availableVersion, changelog, releaseDate, onRestartLater }: ReadyViewProps) {
  const [seconds, setSeconds] = useState(10);
  const { setLastSeenChangelog } = useSettingsStore();
  const { setAvailable } = useUpdateStore();

  useEffect(() => {
    if (seconds <= 0) {
      setLastSeenChangelog(changelog);
      // relaunch() — fires the process plugin relaunch IPC command
      invoke('plugin:process|relaunch').catch(() => {});
      return;
    }
    const timer = setInterval(() => {
      setSeconds((s) => s - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [seconds, changelog, setLastSeenChangelog]);

  const handleRestartLater = () => {
    // Stop countdown and return to available view
    setSeconds(10);
    if (availableVersion) {
      setAvailable(availableVersion, changelog, releaseDate);
    }
    onRestartLater();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Ready to Restart</DialogTitle>
        <DialogDescription>Restarting in {seconds}s&hellip;</DialogDescription>
      </DialogHeader>
      <p className="text-xl font-semibold text-center" aria-live="polite">
        {seconds}
      </p>
      <DialogFooter>
        <Button variant="outline" onClick={handleRestartLater}>
          Restart Later
        </Button>
      </DialogFooter>
    </>
  );
}

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
    setReady,
    setError,
    resetToIdle,
  } = useUpdateStore();
  const { setLastSeenChangelog } = useSettingsStore();

  const open =
    status === 'available' || status === 'downloading' || status === 'ready' || status === 'error';

  // Non-dismissable states: downloading and ready (during countdown)
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
      // Persist changelog before restart
      setLastSeenChangelog(changelog);
      setReady();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={isDismissable ? () => resetToIdle() : undefined}>
      <DialogContent showCloseButton={false}>
        {status === 'available' && (
          <>
            <DialogHeader>
              <DialogTitle>Update Available</DialogTitle>
              <DialogDescription>
                v{buildInfo.version} &rarr; v{availableVersion}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-48 overflow-y-auto prose prose-sm dark:prose-invert">
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

        {status === 'ready' && (
          <ReadyView
            availableVersion={availableVersion}
            changelog={changelog}
            releaseDate={releaseDate}
            onRestartLater={() => {}}
          />
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
