/**
 * AboutDialog — displays app version, build metadata, platform, and live update status.
 *
 * Triggered by native menu bar "About Taskflow" item (macOS app menu and Windows/Linux Help menu).
 * Opened via menu-about event emitted from Rust, listened in main.tsx.
 */

import { ArrowUpCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { buildInfo } from '@/lib/build-info';
import { useUpdateStore } from '@/stores/update.store';

/** Derives a human-readable platform name from navigator.platform. */
function derivePlatform(): string {
  const p = navigator.platform;
  if (p.startsWith('Mac')) return 'macOS';
  if (p.startsWith('Win')) return 'Windows';
  return 'Linux';
}

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AboutDialog({ open, onClose }: AboutDialogProps) {
  const { status, availableVersion } = useUpdateStore();

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className="max-w-sm" showCloseButton={false}>
        {/* App icon */}
        <img src="/app-icon.svg" alt="Taskflow" className="h-16 w-16 mx-auto" />

        {/* App name */}
        <DialogTitle className="text-lg font-semibold text-center">Taskflow</DialogTitle>

        {/* Metadata rows */}
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center gap-2">
            <span className="text-sm font-semibold">Version</span>
            <span className="text-sm text-muted-foreground">{buildInfo.version}</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-sm font-semibold">Build Date</span>
            <span className="text-sm text-muted-foreground">{buildInfo.buildDate}</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-sm font-semibold">Commit</span>
            <span className="text-sm text-muted-foreground font-mono">{buildInfo.commitSha}</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-sm font-semibold">Platform</span>
            <span className="text-sm text-muted-foreground">{derivePlatform()}</span>
          </div>

          {/* Update status row */}
          <div className="flex justify-between items-center gap-2">
            <span className="text-sm font-semibold">Updates</span>
            {status === 'available' ? (
              <span className="flex items-center gap-1 text-sm text-yellow-500">
                <ArrowUpCircle className="h-4 w-4" />
                Update available ({availableVersion})
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm text-green-500">
                <CheckCircle className="h-4 w-4" />
                Up to date
              </span>
            )}
          </div>
        </div>

        {/* Footer with close button */}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
