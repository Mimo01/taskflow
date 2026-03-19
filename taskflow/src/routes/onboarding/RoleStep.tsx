/**
 * RoleStep — Role selection step in the onboarding wizard.
 *
 * Writes to both the onboarding store (wizard state) and settings store
 * (persisted preference). Persisting to settings store here means the
 * role survives app restarts without re-running onboarding.
 */

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useOnboardingStore } from '@/stores/onboarding.store';
import { useSettingsStore } from '@/stores/settings.store';

export default function RoleStep() {
  const { role, set, goNext, goBack } = useOnboardingStore();
  const { setRole } = useSettingsStore();

  const handleValueChange = (value: 'developer' | 'pm' | 'tech-lead') => {
    set({ role: value });
    setRole(value);
  };

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto py-8">
      <div>
        <h2 className="text-xl font-semibold">Select Your Role</h2>
        <p className="text-sm text-muted-foreground mt-1">
          This helps us tailor the dashboard to your workflow.
        </p>
      </div>

      <RadioGroup
        value={role ?? ''}
        onValueChange={(v) => handleValueChange(v as 'developer' | 'pm' | 'tech-lead')}
        className="flex flex-col gap-4"
      >
        <div className="flex items-center space-x-3 border border-border rounded-lg p-4 cursor-pointer hover:bg-accent">
          <RadioGroupItem value="developer" id="role-developer" />
          <Label htmlFor="role-developer" className="cursor-pointer flex-1">
            <span className="font-medium">Developer</span>
            <p className="text-sm text-muted-foreground">View MRs, pipelines, and code activity</p>
          </Label>
        </div>

        <div className="flex items-center space-x-3 border border-border rounded-lg p-4 cursor-pointer hover:bg-accent">
          <RadioGroupItem value="pm" id="role-pm" />
          <Label htmlFor="role-pm" className="cursor-pointer flex-1">
            <span className="font-medium">Project Manager</span>
            <p className="text-sm text-muted-foreground">
              View sprint progress, tickets, and team velocity
            </p>
          </Label>
        </div>

        <div className="flex items-center space-x-3 border border-border rounded-lg p-4 cursor-pointer hover:bg-accent">
          <RadioGroupItem value="tech-lead" id="role-tech-lead" />
          <Label htmlFor="role-tech-lead" className="cursor-pointer flex-1">
            <span className="font-medium">Tech Lead</span>
            <p className="text-sm text-muted-foreground">Access all developer and PM views</p>
          </Label>
        </div>
      </RadioGroup>

      <div className="flex gap-3">
        <Button variant="ghost" onClick={goBack}>
          Back
        </Button>
        <Button onClick={goNext} disabled={!role}>
          Continue
        </Button>
      </div>
    </div>
  );
}
