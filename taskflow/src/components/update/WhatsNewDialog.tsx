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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useSettingsStore } from '@/stores/settings.store';
import { buildInfo } from '@/lib/build-info';

export function WhatsNewDialog() {
  const { lastSeenVersion, lastSeenChangelog, setLastSeenVersion } = useSettingsStore();

  const open = lastSeenVersion !== buildInfo.version && lastSeenChangelog !== null;

  function handleDismiss() {
    setLastSeenVersion(buildInfo.version);
  }

  return (
    <Dialog open={open} onOpenChange={handleDismiss}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>What&apos;s New in v{buildInfo.version}</DialogTitle>
        </DialogHeader>
        <div className="max-h-64 overflow-y-auto prose prose-sm dark:prose-invert">
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
