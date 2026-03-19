/**
 * WelcomeStep — first step of the onboarding wizard.
 *
 * Simple welcome screen that introduces the app and starts the wizard.
 * The "Get Started" button calls goNext() on the onboarding store.
 */
import { Button } from '@/components/ui/button';
import { useOnboardingStore } from '@/stores/onboarding.store';

export default function WelcomeStep() {
  const { goNext } = useOnboardingStore();

  return (
    <div className="flex flex-col items-center justify-center gap-8 py-12 text-center">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Welcome to Taskflow</h1>
        <p className="text-muted-foreground text-lg max-w-md">
          Your Jira and GitLab, in one place.
        </p>
      </div>

      <p className="text-sm text-muted-foreground max-w-lg">
        Connect your Jira and GitLab accounts to see tasks, merge requests, and sprint state without
        switching between tools.
      </p>

      <Button size="lg" onClick={goNext}>
        Get Started
      </Button>
    </div>
  );
}
