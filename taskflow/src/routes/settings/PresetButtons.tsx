/**
 * PresetButtons -- Dev/PM preset buttons with confirmation dialog.
 *
 * Opens a confirmation Dialog before applying preset to prevent accidental
 * layout resets. Cancel button is auto-focused per a11y best practice.
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useSettingsStore } from '@/stores/settings.store';

type PresetType = 'dev' | 'pm';

export default function PresetButtons() {
  const applyPreset = useSettingsStore((s) => s.applyPreset);
  const [pendingPreset, setPendingPreset] = useState<PresetType | null>(null);

  function handleConfirm() {
    if (pendingPreset) {
      applyPreset(pendingPreset);
    }
    setPendingPreset(null);
  }

  const presetLabel = pendingPreset === 'pm' ? 'PM' : 'Dev';

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setPendingPreset('dev')}>
          Apply Dev Preset
        </Button>
        <Button variant="outline" onClick={() => setPendingPreset('pm')}>
          Apply PM Preset
        </Button>
      </div>

      <Dialog open={pendingPreset != null} onOpenChange={(open) => !open && setPendingPreset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Layout</DialogTitle>
            <DialogDescription>
              This will replace your current sidebar and dashboard layout with the {presetLabel}{' '}
              defaults. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingPreset(null)} autoFocus>
              Cancel
            </Button>
            <Button onClick={handleConfirm}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
