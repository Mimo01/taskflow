/** Canonical Jira issue-key pattern, shared by the read view (WikiRenderer) and the editor. */
export const ISSUE_KEY_GLOBAL_RE = /\b[A-Z][A-Z0-9_]+-\d+\b/g;
export const ISSUE_KEY_EXACT_RE = /^[A-Z][A-Z0-9_]+-\d+$/;

/** Link look of a decorated/linkified issue key. */
export const ISSUE_KEY_LINK_CLASS = 'text-primary hover:underline';

/**
 * Whether a key's project prefix is trusted. A string (or null) keeps the legacy
 * single-active-project semantics; an array checks membership.
 */
export function isKnownPrefix(key: string, known: string | null | readonly string[]): boolean {
  if (!known) return false;
  const prefix = key.split('-')[0];
  if (typeof known === 'string') return prefix === known;
  return known.includes(prefix);
}
