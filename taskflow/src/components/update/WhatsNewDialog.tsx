/**
 * WhatsNewDialog — Post-update changelog dialog.
 *
 * Shows when the user launches after an update:
 *   buildInfo.version !== settings.lastSeenVersion && settings.lastSeenChangelog !== null
 *
 * "Let's go" sets lastSeenVersion to current version — dialog won't reappear.
 * "See all updates" does the same, then opens Settings → Updates.
 * Notes shown: this build's bundled CHANGELOG.md section, else lastSeenChangelog.
 * lastSeenChangelog is NOT cleared on dismiss (kept for future reference per UI-SPEC)
 * and stays a raw markdown string (written by older clients too).
 */

import { validate } from 'compare-versions';
import { CircleCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { useReleaseHistory } from '@/hooks/useReleaseHistory';
import { buildInfo } from '@/lib/build-info';
import { bundledNotesFor } from '@/lib/release-notes/bundled';
import { parseReleaseNotes } from '@/lib/release-notes/parse';
import { selectRollup } from '@/services/releases';
import { useSettingsStore } from '@/stores/settings.store';
import { ReleaseNotesBody } from './ReleaseNotesBody';
import { ReleaseRollup } from './ReleaseRollup';
import { UpdateHero } from './UpdateHero';

export function WhatsNewDialog() {
  const lastSeenVersion = useSettingsStore((s) => s.lastSeenVersion);
  const lastSeenChangelog = useSettingsStore((s) => s.lastSeenChangelog);
  const setLastSeenVersion = useSettingsStore((s) => s.setLastSeenVersion);
  const navigate = useNavigate();

  const open = lastSeenVersion !== buildInfo.version && lastSeenChangelog !== null;

  const fromVersion = lastSeenVersion && validate(lastSeenVersion) ? lastSeenVersion : null;
  const rollupEnabled =
    open && !buildInfo.version.includes('-dev') && validate(buildInfo.version) && !!fromVersion;
  const { data: history } = useReleaseHistory({ enabled: rollupEnabled });
  const skipped =
    rollupEnabled && history ? selectRollup(history, fromVersion, buildInfo.version) : [];

  const notes = bundledNotesFor(buildInfo.version) ?? lastSeenChangelog;

  function handleDismiss() {
    setLastSeenVersion(buildInfo.version);
  }

  function handleSeeAll() {
    setLastSeenVersion(buildInfo.version);
    navigate('/settings?section=updates');
  }

  return (
    <Dialog open={open} onOpenChange={handleDismiss}>
      <DialogContent showCloseButton={false} className="sm:max-w-[36rem]">
        <UpdateHero
          eyebrow={
            <span className="inline-flex items-center gap-1.5 text-green-600 dark:text-green-400">
              <CircleCheck aria-hidden="true" className="size-3.5" />
              Update installed
            </span>
          }
          title={`Welcome to Taskflow ${buildInfo.version}`}
          headline={parseReleaseNotes(notes).headline}
          meta={fromVersion ? `Updated from ${fromVersion}` : undefined}
          notes={notes}
        />
        <div className="-mx-2 flex max-h-[45vh] flex-col gap-4 overflow-y-auto px-2">
          <ReleaseNotesBody notes={notes} details hideHeadline />
          <ReleaseRollup releases={skipped} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleSeeAll}>
            See all updates
          </Button>
          <Button variant="default" onClick={handleDismiss}>
            Let&apos;s go
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
