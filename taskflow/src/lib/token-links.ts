/**
 * Builders for "create a personal access token" deep links.
 *
 * - GitLab scope is `api`, not `read_api`: release actions write (PUT milestone,
 *   PUT MR, POST branch, POST milestone) and would get 403 with read_api.
 * - GitLab cannot prefill expiry via URL.
 * - Jira Data Center cannot prefill anything, and its PATs have no scopes.
 * - The GitLab `user_settings` path 404s on GitLab older than about 16.x; accepted.
 *
 * Both builders return null when the typed URL is not a plausible http(s) base,
 * which hides the link.
 */
export const TOKEN_NAME = 'Taskflow';

/** Hint copy shared by the wizard and Settings so both read identically. */
export const JIRA_TOKEN_HINT = `— name it "${TOKEN_NAME}".`;
export const GITLAB_TOKEN_HINT = '— name and api scope prefilled.';

function baseRoot(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null;
    return u.origin + u.pathname.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export function gitlabTokenUrl(raw: string): string | null {
  const root = baseRoot(raw);
  if (!root) return null;
  const q = new URLSearchParams({
    name: TOKEN_NAME,
    description: 'Used by the Taskflow desktop app',
  });
  return `${root}/-/user_settings/personal_access_tokens?${q.toString()}&scopes=api`;
}

export function jiraTokenUrl(raw: string): string | null {
  const root = baseRoot(raw);
  if (!root) return null;
  if (new URL(root).hostname.toLowerCase().endsWith('.atlassian.net')) return null;
  return `${root}/secure/ViewProfile.jspa?selectedTab=com.atlassian.pats.pats-plugin:jira-user-personal-access-tokens`;
}
