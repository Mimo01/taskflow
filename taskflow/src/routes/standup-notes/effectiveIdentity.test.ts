/**
 * Unit tests for resolveEffectiveIdentity — the standup "watched person" guard.
 *
 * The critical correctness invariant (Pitfall 3 / CONTEXT locked decision):
 * when a watched (non-me) person is selected, the GitLab-ID-dependent identity
 * fields (gitlabUserId / gitlabUsername / gitlabEmail) MUST be forced to null so
 * the MR queries auto-disable and NEVER fall back to the logged-in user's MRs.
 */

import { describe, expect, it } from 'vitest';
import type { JiraAssignableUser } from '@/services/jira/types';
import { type AuthIdentity, resolveEffectiveIdentity } from './effectiveIdentity';

const auth: AuthIdentity = {
  jiraUsername: 'me.user',
  jiraUserKey: 'JIRAUSER111',
  jiraUserDisplayName: 'Me User',
  gitlabUserId: 42,
  gitlabUsername: 'me-gl',
  gitlabName: 'Me GitLab',
  gitlabEmail: 'me@example.com',
};

const watched: JiraAssignableUser = {
  displayName: 'Teammate Person',
  name: 'teammate.person',
  key: 'JIRAUSER222',
  avatarUrls: { '48x48': 'https://example.com/a.png' },
};

describe('resolveEffectiveIdentity', () => {
  it('returns the auth identity unchanged when watchedUser is null (me)', () => {
    const id = resolveEffectiveIdentity(auth, null);
    expect(id.jiraUsername).toBe(auth.jiraUsername);
    expect(id.jiraUserKey).toBe(auth.jiraUserKey);
    expect(id.jiraUserDisplayName).toBe(auth.jiraUserDisplayName);
    expect(id.gitlabUserId).toBe(auth.gitlabUserId);
    expect(id.gitlabUsername).toBe(auth.gitlabUsername);
    expect(id.gitlabName).toBe(auth.gitlabName);
    expect(id.gitlabEmail).toBe(auth.gitlabEmail);
  });

  it('maps Jira fields from the watched user and feeds displayName as gitlabName', () => {
    const id = resolveEffectiveIdentity(auth, watched);
    expect(id.jiraUsername).toBe('teammate.person');
    expect(id.jiraUserKey).toBe('JIRAUSER222');
    expect(id.jiraUserDisplayName).toBe('Teammate Person');
    // best-effort commit matching by display name
    expect(id.gitlabName).toBe('Teammate Person');
  });

  it('maps jiraUserKey to null when the watched user carries no key', () => {
    const { key: _key, ...noKey } = watched;
    const id = resolveEffectiveIdentity(auth, noKey as JiraAssignableUser);
    expect(id.jiraUserKey).toBeNull();
  });

  it('CRITICAL GUARD: forces gitlabUserId/gitlabUsername/gitlabEmail to null for a watched person and never inherits auth GitLab id', () => {
    const id = resolveEffectiveIdentity(auth, watched);
    expect(id.gitlabUserId).toBeNull();
    expect(id.gitlabUsername).toBeNull();
    expect(id.gitlabEmail).toBeNull();
    // explicit non-inheritance assertion
    expect(id.gitlabUserId).not.toBe(auth.gitlabUserId);
  });

  it('exposes isWatched: false for null watchedUser and true for a watched person', () => {
    expect(resolveEffectiveIdentity(auth, null).isWatched).toBe(false);
    expect(resolveEffectiveIdentity(auth, watched).isWatched).toBe(true);
  });
});
