import { useEffect, useRef } from 'react';
import { purgeAllDraftFiles, purgeOrphanDraftFiles } from '@/lib/issue-draft-files';
import { useAuthStore } from '@/stores/auth.store';
import { useDraftsHydrated, useDraftsStore } from '@/stores/drafts.store';
import { useIssueDraftsHydrated, useIssueDraftsStore } from '@/stores/issue-drafts.store';

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
  const issueDraftsHydrated = useIssueDraftsHydrated();
  const orphansPurged = useRef(false);
  useEffect(() => {
    if (!authHydrated || !draftsHydrated) return;
    const owner = draftOwnerFrom({ jiraBaseUrl, jiraUsername });
    if (owner) useDraftsStore.getState().reconcileOwner(owner);
  }, [jiraBaseUrl, jiraUsername, authHydrated, draftsHydrated]);

  // Issue drafts (Phase 101 D-16): clear on account change and delete staged files.
  useEffect(() => {
    if (!authHydrated || !issueDraftsHydrated) return;
    const owner = draftOwnerFrom({ jiraBaseUrl, jiraUsername });
    if (!owner) return;
    if (useIssueDraftsStore.getState().reconcileOwner(owner)) void purgeAllDraftFiles();
    // Startup only, before any user staging: remove staged copies with no live draft.
    if (!orphansPurged.current) {
      orphansPurged.current = true;
      void purgeOrphanDraftFiles(new Set(Object.keys(useIssueDraftsStore.getState().drafts)));
    }
  }, [jiraBaseUrl, jiraUsername, authHydrated, issueDraftsHydrated]);
}
