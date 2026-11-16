import { compareTextMatch, matchText, type TextMatch } from '@/lib/search-text';
import type { GitLabMR } from '@/services/gitlab';

/**
 * Looser than the global-search default: MR titles are short, and dropped-letter typos
 * ("refactr", "wrklog") score ~0.3 in fuzzysort.
 */
const MR_FUZZY_THRESHOLD = 0.25;

/** Text fields an MR row can be found by, in display-priority order. */
function mrSearchFields(mr: GitLabMR): string[] {
  return [
    mr.title,
    `!${mr.iid}`,
    mr.source_branch,
    mr.author?.name,
    mr.author?.username,
    ...(mr.labels ?? []).map((l) => l.name),
    mr.milestone?.title,
  ].filter((s): s is string => !!s);
}

/** Best match of `query` against any of the MR's visible fields. */
export function matchMR(query: string, mr: GitLabMR): TextMatch | null {
  // "!123" / "123" → exact iid hit ranks first.
  const iidQuery = query.trim().replace(/^!/, '');
  if (/^\d+$/.test(iidQuery) && String(mr.iid) === iidQuery) {
    return { kind: 'exact', score: 1.01, indexes: [] };
  }
  let best: TextMatch | null = null;
  for (const field of mrSearchFields(mr)) {
    const m = matchText(query, field, { fuzzyThreshold: MR_FUZZY_THRESHOLD });
    if (m && (!best || compareTextMatch(m, best) < 0)) best = m;
  }
  return best;
}

/**
 * Filter + rank MRs for the list-page search.
 *
 * `local` is the already-loaded page for the current state; it is matched client-side
 * (substring + fuzzy over title, !iid, branch, author, labels, milestone).
 * `server` is GitLab's own `search=` result for the same project/state (substring on
 * title + description, no page cap on what's searched) — kept even without a local
 * field match, since it may have matched the description.
 */
export function searchMRs(query: string, local: GitLabMR[], server: GitLabMR[] = []): GitLabMR[] {
  if (!query.trim()) return local;
  const byId = new Map<number, GitLabMR>();
  for (const mr of [...local, ...server]) if (!byId.has(mr.id)) byId.set(mr.id, mr);
  const serverIds = new Set(server.map((mr) => mr.id));

  const scored: { mr: GitLabMR; match: TextMatch }[] = [];
  for (const mr of byId.values()) {
    const match =
      matchMR(query, mr) ??
      (serverIds.has(mr.id) ? ({ kind: 'fuzzy', score: 0, indexes: [] } as TextMatch) : null);
    if (match) scored.push({ mr, match });
  }
  scored.sort(
    (a, b) => compareTextMatch(a.match, b.match) || b.mr.updated_at.localeCompare(a.mr.updated_at),
  );
  return scored.map((s) => s.mr);
}
