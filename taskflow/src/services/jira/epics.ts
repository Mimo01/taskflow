/**
 * Epic search + lightweight epic lookup for the shared EpicPicker.
 *
 * Search is SERVER-SIDE (open epics only): never filter one capped page client-side.
 */

import { apiFetch } from '../../lib/apiFetch';

export interface EpicOption {
  key: string;
  /** Epic Name field, falling back to the summary. */
  name: string;
  summary: string;
  /** Raw Jira epic colour (`ghx-label-N` / hex) or null. */
  color: string | null;
}

const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/**
 * Injection-safe JQL for the open-epic picker. Reserved characters become token separators
 * (not deletions); each token is its own quoted `text ~` clause and the last gets a `*`
 * suffix for as-you-type matching. A key-shaped term (PROJ-12) or bare number (12) ORs in
 * an exact `key =` clause. Empty query lists the most recently updated open epics.
 */
export function buildEpicSearchJql(
  projectKey: string,
  query: string,
  opts?: { withKey?: boolean },
): string {
  const scope = `project = "${esc(projectKey)}" AND issuetype = Epic AND statusCategory != Done`;
  const order = 'ORDER BY updated DESC';
  const trimmed = query.trim();
  const tokens = trimmed
    .replace(/[+\-&|!(){}[\]^~*?:\\/#@"']/g, ' ')
    .split(/\s+/)
    .filter((t) => /[\p{L}\p{N}]/u.test(t) && !/^(AND|OR|NOT)$/.test(t));

  let keyTerm: string | null = null;
  if (opts?.withKey !== false) {
    if (/^[A-Za-z][A-Za-z0-9]*-\d+$/.test(trimmed)) keyTerm = trimmed.toUpperCase();
    else if (/^\d+$/.test(trimmed)) keyTerm = `${projectKey}-${trimmed}`;
  }

  if (tokens.length === 0) return `${scope} ${order}`;
  const text = tokens
    .map((t, i) => `text ~ "${esc(i === tokens.length - 1 ? `${t}*` : t)}"`)
    .join(' AND ');
  const match = keyTerm ? `(${text} OR key = "${esc(keyTerm)}")` : text;
  return `${scope} AND ${match} ${order}`;
}

interface SearchOpts {
  epicNameFieldKey: string;
  epicColorFieldKey: string;
  maxResults?: number;
}

export async function searchOpenEpics(
  baseUrl: string,
  token: string,
  projectKey: string,
  query: string,
  opts: SearchOpts,
): Promise<EpicOption[]> {
  const base = baseUrl.replace(/\/$/, '');
  const fields = `summary,${opts.epicNameFieldKey},${opts.epicColorFieldKey}`;
  const run = async (jql: string) => {
    const url = `${base}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=${encodeURIComponent(fields)}&maxResults=${opts.maxResults ?? 30}`;
    return apiFetch(
      'jira',
      url,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
      'Search Epics',
    );
  };

  try {
    const withKey = buildEpicSearchJql(projectKey, query);
    let resp = await run(withKey);
    if (!resp.ok) {
      const withoutKey = buildEpicSearchJql(projectKey, query, { withKey: false });
      if (withoutKey === withKey) return [];
      resp = await run(withoutKey);
      if (!resp.ok) return [];
    }
    const data = (await resp.json()) as {
      issues?: Array<{ key: string; fields: Record<string, unknown> }>;
    };
    return (data.issues ?? []).map((i) => {
      const summary = (i.fields.summary as string | undefined) ?? '';
      return {
        key: i.key,
        name: (i.fields[opts.epicNameFieldKey] as string | null | undefined) || summary,
        summary,
        color: (i.fields[opts.epicColorFieldKey] as string | null | undefined) ?? null,
      };
    });
  } catch {
    return [];
  }
}

/** Lightweight single-epic fetch; shared shape with the ['jira-issue-name'] cache. */
export async function fetchEpicSummary(
  baseUrl: string,
  token: string,
  key: string,
  epicNameFieldKey: string,
  epicColorFieldKey: string,
): Promise<{ fields: { summary: string; [k: string]: unknown } } | null> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${key}?fields=summary,${epicNameFieldKey},${epicColorFieldKey}`;
  const resp = await apiFetch(
    'jira',
    url,
    { headers: { Authorization: `Bearer ${token}` } },
    'Load Issue Detail',
  );
  if (!resp.ok) return null;
  return resp.json() as Promise<{ fields: { summary: string; [k: string]: unknown } }>;
}
