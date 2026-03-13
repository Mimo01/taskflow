/**
 * DoneStep — Final step in the onboarding wizard.
 *
 * On mount, marks onboarding as complete in the settings store (persisted).
 * 'Go to Dashboard' navigates to /dashboard.
 */
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSettingsStore } from '@/stores/settings.store';

export default function DoneStep() {
  const navigate = useNavigate();
  const { setOnboardingComplete } = useSettingsStore();

  const handleGoToDashboard = () => {
    setOnboardingComplete(true);
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
