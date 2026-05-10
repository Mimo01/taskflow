import type { GitLabMR } from '@/services/gitlab';

/**
 * Extract sprint name from various Jira API response formats.
 *
 * Jira returns the sprint custom field differently depending on version/platform:
 *  1. Array of objects: [{id, name, state, ...}]  (Jira Cloud, newer DC)
 *  2. Array of strings: ["com.atlassian...Sprint@...[...,name=Sprint 1,...]"]  (older Jira DC toString format)
 *  3. Single object: {id, name, state, ...}  (Agile API / some DC versions)
 *  4. Plain string: "Sprint 1"  (rare edge case)
 *  5. null / undefined  (no sprint assigned)
 */
export function extractSprintName(raw: unknown): string | null {
  if (raw == null) return null;

  // Case 4: plain string
  if (typeof raw === 'string') {
    // Could be a Java toString representation or a plain name
    return parseSprintToStringName(raw) ?? raw;
  }

  // Case 3: single object with .name
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.name === 'string') return obj.name;
    return null;
  }

  // Case 1 & 2: array
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null;

    const first = raw[0];

    // Case 1: array of objects -- prefer active sprint
    if (typeof first === 'object' && first !== null) {
      const items = raw as Array<Record<string, unknown>>;
      const active = items.find((s) => {
        const state = typeof s.state === 'string' ? s.state.toLowerCase() : '';
        return state === 'active';
      });
      const chosen = active ?? items[0];
      return typeof chosen.name === 'string' ? chosen.name : null;
    }

    // Case 2: array of Java toString strings -- prefer active sprint
    if (typeof first === 'string') {
      const strings = raw as string[];
      const active = strings.find((s) => /state=ACTIVE/i.test(s));
      const chosen = active ?? strings[0];
      return parseSprintToStringName(chosen);
    }
  }

  return null;
}

/**
 * Parse sprint name from the Jira DC Java toString format:
 * "com.atlassian.greenhopper.service.sprint.Sprint@abc[id=1,...,name=Sprint 1,...,state=ACTIVE,...]"
 * Returns the name value, or null if the string isn't in this format.
 */
function parseSprintToStringName(str: string): string | null {
  const match = str.match(/name=([^,\]]+)/);
  return match ? match[1] : null;
}

/**
 * Extract the sprint ID from various Jira sprint field formats.
 * Prefers active sprint when multiple are present.
 */
export function extractSprintId(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return ((raw as Record<string, unknown>).id as number) ?? null;
  }
  if (Array.isArray(raw) && raw.length > 0) {
    const first = raw[0];
    // Case 1: array of objects — prefer active sprint
    if (typeof first === 'object' && first !== null) {
      const items = raw as Array<Record<string, unknown>>;
      const active = items.find((s) => String(s.state).toLowerCase() === 'active');
      return ((active ?? items[0]).id as number) ?? null;
    }
    // Case 2: array of Java toString strings — parse id from "id=123"
    if (typeof first === 'string') {
      const strings = raw as string[];
      const active = strings.find((s) => /state=ACTIVE/i.test(s));
      const chosen = active ?? strings[0];
      const match = chosen.match(/id=(\d+)/);
      return match ? Number(match[1]) : null;
    }
  }
  return null;
}

// MR state color helpers
export function mrStateClasses(state: GitLabMR['state']): string {
  if (state === 'opened') return 'bg-green-500/10 text-green-700 dark:text-green-400';
  if (state === 'merged') return 'bg-purple-500/10 text-purple-700 dark:text-purple-400';
  return 'bg-muted text-muted-foreground';
}

export function mrDot(state: GitLabMR['state']): string {
  if (state === 'opened') return 'bg-green-500';
  if (state === 'merged') return 'bg-purple-500';
  return 'bg-gray-400';
}
