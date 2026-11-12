/**
 * Builders for "create a personal access token" deep links.
 *
 * - GitLab opens the fine-grained token form (`…/personal_access_tokens/granular/new`,
 *   GitLab ≥ 18.10, GA 19.2). That form reads no prefill params (only `source_token_id`
 *   for duplicating), so the name and permissions are spelled out in the hint instead.
 *   Every REST endpoint the app calls is covered by a fine-grained permission
 *   (docs.gitlab.com/auth/tokens/fine_grained_access_tokens_rest/); writes need
 *   Merge Request/Work Item Update and Branch/Work Item Create.
 * - Jira Data Center cannot prefill anything, and its PATs have no scopes.
 *
 * Both builders return null when the typed URL is not a plausible http(s) base,
 * which hides the link.
 */
export const TOKEN_NAME = 'Taskflow';

/** Hint copy shared by the wizard and Settings so both read identically. */
export const JIRA_TOKEN_HINT = `— name it "${TOKEN_NAME}" and set an expiry (your org may cap it, 365 days by default). No permissions to pick; the token acts as you.`;
export const GITLAB_TOKEN_HINT = `— GitLab can't prefill fine-grained tokens. Name it "${TOKEN_NAME}", allow all groups and projects you have access to, and grant:`;
/** Fine-grained permissions covering every GitLab endpoint the app calls. */
export const GITLAB_TOKEN_PERMISSIONS = [
  'Read: Project, Group, Merge Request, Branch, Commit, Repository, Repository Tag, Label, Work Item, Event, User (incl. instance)',
  'Update: Merge Request, Work Item',
  'Create: Branch, Work Item',
  'Use: Global Search',
];

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
  return `${root}/-/user_settings/personal_access_tokens/granular/new`;
}

export function jiraTokenUrl(raw: string): string | null {
  const root = baseRoot(raw);
  if (!root) return null;
  if (new URL(root).hostname.toLowerCase().endsWith('.atlassian.net')) return null;
  return `${root}/secure/ViewProfile.jspa?selectedTab=com.atlassian.pats.pats-plugin:jira-user-personal-access-tokens`;
}
