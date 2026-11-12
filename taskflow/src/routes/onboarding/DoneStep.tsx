/**
 * DoneStep — Final step in the onboarding wizard.
 *
 * On mount, marks onboarding as complete and records the current wizard version in the
 * settings store (persisted), so quitting here still counts as done. It also holds the wizard
 * open (rerunActive) — otherwise the onboardingComplete flip makes the route gates redirect
 * to /dashboard before this step is ever seen. 'Go to Dashboard' releases it and navigates.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { WIZARD_VERSION } from '@/lib/onboarding-rerun';
import { useOnboardingStore } from '@/stores/onboarding.store';
import { useSettingsStore } from '@/stores/settings.store';

export default function DoneStep() {
  const navigate = useNavigate();
  const { setOnboardingComplete, setOnboardingVersion } = useSettingsStore();

  useEffect(() => {
    setOnboardingComplete(true);
    setOnboardingVersion(WIZARD_VERSION);
    useOnboardingStore.getState().set({ rerunActive: true });
  }, [setOnboardingComplete, setOnboardingVersion]);

  const handleGoToDashboard = () => {
    useOnboardingStore.getState().set({ rerunActive: false });
    navigate('/dashboard');
  };

  return (
    <div className="flex flex-col items-center gap-6 max-w-lg mx-auto py-16 text-center">
      <div className="text-5xl">✓</div>
      <div>
        <h2 className="text-2xl font-semibold">You're all set!</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Your credentials and preferences have been saved. You can update them anytime in Settings.
        </p>
      </div>

      <Button onClick={handleGoToDashboard} size="lg">
        Go to Dashboard
      </Button>
    </div>
  );
}
