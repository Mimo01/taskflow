/**
 * RoleSection — Role picker in Settings.
 *
 * Reads/writes useSettingsStore().role directly.
 * No save button — change takes effect immediately.
 */

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useSettingsStore } from '@/stores/settings.store';

export default function RoleSection() {
  const { role, setRole } = useSettingsStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-semibold">Role</h3>
        <p className="text-sm text-muted-foreground">
          Your role determines the default dashboard layout.
        </p>
      </div>

      <RadioGroup
        value={role ?? ''}
        onValueChange={(v) => setRole(v as 'developer' | 'pm' | 'tech-lead')}
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
    </div>
  );
}
