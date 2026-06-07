/**
 * effectiveIdentity — pure identity-mapping helper for the Standup "watched person" picker.
 *
 * The standup page can show either the logged-in user's standup (default) or a
 * watched teammate's standup. A watched Jira person carries only Jira identity
 * (`{ displayName, name, key? }`) — there is NO GitLab numeric id available.
 *
 * resolveEffectiveIdentity threads a single "effective identity" through the page's
 * react-query keys so switching person triggers a fresh fetch.
 *
 * CRITICAL CORRECTNESS GUARD (Pitfall 3 / locked CONTEXT decision):
 * For a watched person, gitlabUserId / gitlabUsername / gitlabEmail are FORCED to
 * null. The GitLab-ID-keyed sections (MR events, reviewer MRs, participating MRs)
 * must render empty when unresolved and MUST NEVER fall back to the logged-in
 * user's gitlabUserId. This branch deliberately never references auth.gitlabUserId,
 * auth.gitlabUsername, or auth.gitlabEmail.
 */

import type { JiraAssignableUser } from '@/services/jira/types';

/** The subset of auth-store identity fields the standup queries are keyed on. */
export interface AuthIdentity {
  jiraUsername: string | null;
  jiraUserKey: string | null;
  jiraUserDisplayName: string | null;
  gitlabUserId: number | null;
  gitlabUsername: string | null;
  gitlabName: string | null;
  gitlabEmail: string | null;
}

/** The resolved identity the page threads into its query keys + props. */
export interface EffectiveIdentity {
  jiraUsername: string | null;
  jiraUserKey: string | null;
  jiraUserDisplayName: string | null;
  gitlabUserId: number | null;
  gitlabUsername: string | null;
  gitlabName: string | null;
  gitlabEmail: string | null;
  /** false = logged-in user (me); true = a watched teammate. Drives the "not matched" hint. */
  isWatched: boolean;
}

/**
 * Resolve the effective identity from the auth store and an optional watched user.
 *
 * - watchedUser === null  → return the auth identity unchanged (isWatched: false).
 * - watchedUser set       → map Jira fields from the watched user, feed displayName
 *                           as gitlabName for best-effort commit matching, and FORCE
 *                           gitlabUserId/gitlabUsername/gitlabEmail to null.
 */
export function resolveEffectiveIdentity(
  auth: AuthIdentity,
  watchedUser: JiraAssignableUser | null,
): EffectiveIdentity {
  if (watchedUser === null) {
    return { ...auth, isWatched: false };
  }

  return {
    jiraUsername: watchedUser.name,
    jiraUserKey: watchedUser.key ?? null,
    jiraUserDisplayName: watchedUser.displayName,
    // best-effort commit matching by display name; empty if no git match is acceptable
    gitlabName: watchedUser.displayName,
    // CRITICAL GUARD — never inherit the logged-in user's GitLab identity
    gitlabUserId: null,
    gitlabUsername: null,
    gitlabEmail: null,
    isWatched: true,
  };
}
