/**
 * ReAuthBanner — sticky non-dismissible banner for expired Jira token.
 *
 * Renders ONLY when:
 *   1. jiraConnected is false (token expired or revoked)
 *   2. Onboarding is complete (activeJiraProject is not null, used as proxy)
 *
 * This banner has NO dismiss button — locked UX decision from CONTEXT.md.
 * The user must go to Settings to re-authenticate.
 *
 * Uses shadcn/ui Alert with amber/yellow color to signal warning (not error).
 */
import { Link } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';

export default function ReAuthBanner() {
  const { jiraConnected } = useAuthStore();
  const { onboardingComplete } = useSettingsStore();

  if (jiraConnected || !onboardingComplete) return null;

  return (
    <Alert className="rounded-none border-x-0 border-t-0 border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:border-amber-600 dark:text-amber-200">
      <AlertDescription className="flex items-center justify-between">
        <span>Jira connection lost — check your URL and token in Settings</span>
        <Link to="/settings" className="underline font-medium hover:no-underline ml-4 shrink-0">
          Go to Settings
        </Link>
      </AlertDescription>
    </Alert>
  );
}

export function GitLabReAuthBanner() {
  const { gitlabConnected } = useAuthStore();
  const { onboardingComplete } = useSettingsStore();

  if (gitlabConnected || !onboardingComplete) return null;

  return (
    <Alert className="rounded-none border-x-0 border-t-0 border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:border-amber-600 dark:text-amber-200">
      <AlertDescription className="flex items-center justify-between">
        <span>GitLab connection lost — check your URL and token in Settings</span>
        <Link to="/settings" className="underline font-medium hover:no-underline ml-4 shrink-0">
          Go to Settings
        </Link>
      </AlertDescription>
    </Alert>
  );
}
