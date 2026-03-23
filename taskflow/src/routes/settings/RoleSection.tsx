/**
 * RoleSection -- Role picker in Settings.
 *
 * Reads/writes useSettingsStore().role directly.
 * Shows a confirmation dialog before changing role since it resets
 * sidebar items and dashboard layout via applyPreset.
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
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useSettingsStore } from '@/stores/settings.store';

export default function RoleSection() {
  const { role, setRole, applyPreset } = useSettingsStore();
  const [pendingRole, setPendingRole] = useState<'developer' | 'pm' | 'tech-lead' | null>(null);

  const handleValueChange = (value: string) => {
    const newRole = value as 'developer' | 'pm' | 'tech-lead';
    if (newRole === role) return;
    setPendingRole(newRole);
  };

  const handleConfirm = () => {
    if (!pendingRole) return;
    setRole(pendingRole);
    applyPreset(pendingRole === 'pm' ? 'pm' : 'dev');
    setPendingRole(null);
  };

  const handleCancel = () => {
    setPendingRole(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-semibold">Role</h3>
        <p className="text-sm text-muted-foreground">
          Your role determines the default sidebar layout and dashboard widgets.
        </p>
      </div>

      <RadioGroup
        value={role ?? ''}
        onValueChange={handleValueChange}
        className="flex flex-col gap-3"
      >
        <div className="flex items-center space-x-3 border border-border rounded-lg p-3 cursor-pointer hover:bg-accent">
          <RadioGroupItem value="developer" id="settings-role-developer" />
          <Label htmlFor="settings-role-developer" className="cursor-pointer">
            Developer
          </Label>
        </div>

        <div className="flex items-center space-x-3 border border-border rounded-lg p-3 cursor-pointer hover:bg-accent">
          <RadioGroupItem value="pm" id="settings-role-pm" />
          <Label htmlFor="settings-role-pm" className="cursor-pointer">
            Project Manager
          </Label>
        </div>

        <div className="flex items-center space-x-3 border border-border rounded-lg p-3 cursor-pointer hover:bg-accent">
          <RadioGroupItem value="tech-lead" id="settings-role-tech-lead" />
          <Label htmlFor="settings-role-tech-lead" className="cursor-pointer">
            Tech Lead
          </Label>
        </div>
      </RadioGroup>

      <Dialog open={pendingRole !== null} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role?</DialogTitle>
            <DialogDescription>
              Changing your role will reset your sidebar layout and dashboard widgets to the default
              preset. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleConfirm}>Change Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
