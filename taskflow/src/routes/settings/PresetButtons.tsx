/**
 * PresetButtons -- Quick preset buttons for sidebar layout.
 *
 * Allows user to reset sidebar items to developer or PM preset.
 * Shows a confirmation dialog before applying.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSettingsStore } from '@/stores/settings.store';

export default function PresetButtons() {
  const { applyPreset } = useSettingsStore();
  const [pendingPreset, setPendingPreset] = useState<'dev' | 'pm' | null>(null);

  const handleConfirm = () => {
    if (!pendingPreset) return;
    applyPreset(pendingPreset);
    setPendingPreset(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">Quick Presets</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setPendingPreset('dev')}>
          Developer Preset
        </Button>
        <Button variant="outline" size="sm" onClick={() => setPendingPreset('pm')}>
          PM Preset
        </Button>
      </div>

      <Dialog
        open={pendingPreset !== null}
        onOpenChange={(open) => !open && setPendingPreset(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Preset?</DialogTitle>
            <DialogDescription>
              This will reset your sidebar items to the{' '}
              {pendingPreset === 'pm' ? 'Project Manager' : 'Developer'} preset. Your current
              sidebar customization will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingPreset(null)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm}>Apply Preset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
