/**
 * WhatsNewDialog — Post-update changelog dialog.
 *
 * Shows when the user launches after an update:
 *   buildInfo.version !== settings.lastSeenVersion && settings.lastSeenChangelog !== null
 *
 * "Got it" sets lastSeenVersion to current version — dialog won't reappear.
 * lastSeenChangelog is NOT cleared on dismiss (kept for future reference per UI-SPEC).
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { buildInfo } from '@/lib/build-info';
import { useSettingsStore } from '@/stores/settings.store';

export function WhatsNewDialog() {
  const { lastSeenVersion, lastSeenChangelog, setLastSeenVersion } = useSettingsStore();

  const open = lastSeenVersion !== buildInfo.version && lastSeenChangelog !== null;

  function handleDismiss() {
    setLastSeenVersion(buildInfo.version);
  }

  return (
    <Dialog open={open} onOpenChange={handleDismiss}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>What&apos;s New in v{buildInfo.version}</DialogTitle>
          <DialogDescription>Here&apos;s what changed in this update</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto prose prose-sm dark:prose-invert max-w-none [&>h2]:text-sm [&>h2]:font-semibold [&>h2]:mt-3 [&>h2]:mb-1 [&>ul]:my-1 [&>ul]:pl-4 [&_li]:my-0 [&_p]:my-1">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{lastSeenChangelog ?? ''}</ReactMarkdown>
        </div>
        <DialogFooter>
          <Button variant="default" onClick={handleDismiss}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
