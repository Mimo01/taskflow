import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useDraftsHydrated, useDraftsStore } from '@/stores/drafts.store';

export function draftOwnerFrom(a: {
  jiraBaseUrl: string | null;
  jiraUsername: string | null;
}): string | null {
  if (a.jiraBaseUrl == null || a.jiraUsername == null) return null;
  return `${a.jiraBaseUrl}|${a.jiraUsername}`;
}

/** D-21: clear drafts when the connected Jira account changes. */
export function useDraftsAccountGuard() {
  const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl);
  const jiraUsername = useAuthStore((s) => s.jiraUsername);
  const authHydrated = useAuthStore((s) => s._hasHydrated);
  const draftsHydrated = useDraftsHydrated();
  useEffect(() => {
    if (!authHydrated || !draftsHydrated) return;
    const owner = draftOwnerFrom({ jiraBaseUrl, jiraUsername });
    if (owner) useDraftsStore.getState().reconcileOwner(owner);
  }, [jiraBaseUrl, jiraUsername, authHydrated, draftsHydrated]);
}
