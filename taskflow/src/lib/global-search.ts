/**
 * Phase 92: pure ranking / tiering / grouping model for the global search palette.
 *
 * React-free on purpose: the palette calls `buildSearchIndex` (local GreenHopper
 * data) and `buildResultModel` (query + Jira body hits) and renders the sections.
 */

import type { JiraIssue } from '@/services/jira';
import {
  buildEntityMaps,
  resolveEpic,
  resolveStatus,
  resolveType,
} from '@/services/jira/greenhopper/entityMaps';
import type {
  GhAllDataResponse,
  GhBacklogResponse,
  GhIssue,
} from '@/services/jira/greenhopper/types';
import {
  buildSnippet,
  compareTextMatch,
  type HighlightRange,
  KIND_RANK,
  matchText,
  runsFromIndexes,
  stripWikiMarkup,
  type TextMatch,
  tokenize,
} from './search-text';

export type FieldTier = 0 | 1 | 2; // title | description | comment

export interface SearchTier {
  id: string;
  label: string;
  rank: number;
}

export interface SearchEntry {
  key: string;
  summary: string;
  typeName: string;
  isSubtask: boolean;
  isEpic: boolean;
  statusName: string;
  statusCategoryKey: 'new' | 'indeterminate' | 'done';
  done: boolean;
  assigneeName: string | null;
  avatarUrl: string | null;
  epic: { key: string; name: string; color: string } | null;
  parentKey: string | null;
  tierId: string;
}

export interface SearchIndex {
  entries: SearchEntry[];
  byKey: Map<string, SearchEntry>;
  tiers: Map<string, SearchTier>;
  epicsByKey: Map<string, { key: string; name: string; color: string }>;
}

/** Where a body (non-title) hit matched. */
export type MatchTag = 'desc' | 'comment' | 'other';

export interface ResultRow {
  entry: SearchEntry;
  field: FieldTier | null;
  titleRanges: HighlightRange[];
  snippet: { text: string; ranges: HighlightRange[] } | null;
  tag: MatchTag | null;
  dimmed: boolean;
  indent: boolean;
}

export interface ResultSection {
  tier: SearchTier;
  rows: ResultRow[];
  hiddenCount: number;
}

export const PER_TIER_CAP = 8;
export const TOTAL_CAP = 40;

const CURRENT_ID = 'current';
const BACKLOG_ID = 'backlog';
const CLOSED_ID = 'closed';
/** Open epics get their own section instead of mixing into Backlog as story rows. */
const EPICS_ID = 'epics';

type EpicInfo = { key: string; name: string; color: string };

function isEpicType(typeName: string | undefined): boolean {
  return (typeName ?? '').toLowerCase() === 'epic';
}

function upperKey(key: string): string {
  return key.toUpperCase();
}

export function buildSearchIndex(
  backlog: GhBacklogResponse | undefined,
  allData?: GhAllDataResponse,
): SearchIndex {
  const tiers = new Map<string, SearchTier>();
  const entries: SearchEntry[] = [];
  const byKey = new Map<string, SearchEntry>();
  const epicsByKey = new Map<string, EpicInfo>();

  const addEpics = (epics: GhAllDataResponse['entityData']['epics'] | undefined) => {
    for (const e of Object.values(epics ?? {})) {
      epicsByKey.set(e.epicField.epicKey, {
        key: e.epicField.epicKey,
        name: e.epicField.text,
        color: e.epicField.epicColor,
      });
    }
  };

  // Tiers (D-05 / D-06)
  let futurePos = 0;
  const issueIdToTier = new Map<number, SearchTier>();
  for (const s of backlog?.sprints ?? []) {
    let tier: SearchTier;
    if (s.state === 'ACTIVE') {
      tier = tiers.get(CURRENT_ID) ?? { id: CURRENT_ID, label: 'Current sprint', rank: 0 };
    } else if (s.state === 'FUTURE') {
      futurePos += 1;
      tier = {
        id: `sprint:${s.id}`,
        label: futurePos === 1 ? `${s.name} (next)` : s.name,
        rank: futurePos,
      };
    } else {
      continue; // BL-01: CLOSED sprints do not form a tier
    }
    tiers.set(tier.id, tier);
    for (const id of s.issuesIds) {
      const prev = issueIdToTier.get(id);
      if (!prev || tier.rank < prev.rank) issueIdToTier.set(id, tier);
    }
  }
  if (!tiers.has(CURRENT_ID)) {
    tiers.set(CURRENT_ID, { id: CURRENT_ID, label: 'Current sprint', rank: 0 });
  }
  tiers.set(BACKLOG_ID, { id: BACKLOG_ID, label: 'Backlog', rank: 1000 });
  tiers.set(EPICS_ID, { id: EPICS_ID, label: 'Epics', rank: 1500 });
  tiers.set(CLOSED_ID, { id: CLOSED_ID, label: 'Closed', rank: 2000 });

  const index: SearchIndex = { entries, byKey, tiers, epicsByKey };
  if (!backlog) {
    addEpics(allData?.entityData.epics);
    addSubtasks(index, allData);
    return index;
  }

  addEpics(backlog.entityData.epics);
  addEpics(allData?.entityData.epics);
  const maps = buildEntityMaps(backlog);

  const build = (gh: GhIssue, tierId: string): SearchEntry => {
    const status = resolveStatus(gh.statusId, maps);
    const type = resolveType(gh.typeId, maps);
    const epic = resolveEpic(gh.epicId, maps);
    return {
      key: gh.key,
      summary: gh.summary,
      typeName: type.name,
      isSubtask: !!gh.parentKey,
      isEpic: isEpicType(type.name),
      statusName: status.name,
      statusCategoryKey: gh.done ? 'done' : status.statusCategory.key,
      done: gh.done,
      assigneeName: gh.assigneeName ?? null,
      avatarUrl: gh.avatarUrl ?? null,
      epic: epic ? { key: epic.key, name: epic.name, color: epic.color } : null,
      parentKey: gh.parentKey ?? null,
      tierId,
    };
  };

  const add = (e: SearchEntry) => {
    if (byKey.has(e.key)) return;
    entries.push(e);
    byKey.set(e.key, e);
  };

  // Non-subtasks first so subtasks can inherit the parent's tier.
  for (const gh of backlog.issues) {
    if (gh.parentKey) continue;
    let tierId = issueIdToTier.get(gh.id)?.id ?? BACKLOG_ID;
    if (gh.done && tierId !== CURRENT_ID) tierId = CLOSED_ID;
    else if (tierId === BACKLOG_ID && isEpicType(resolveType(gh.typeId, maps).name)) {
      tierId = EPICS_ID;
    }
    add(build(gh, tierId));
  }
  for (const gh of backlog.issues) {
    if (!gh.parentKey) continue;
    const parentTier = byKey.get(gh.parentKey)?.tierId;
    let tierId = parentTier ?? issueIdToTier.get(gh.id)?.id ?? BACKLOG_ID;
    if (gh.done && tierId !== CURRENT_ID) tierId = CLOSED_ID;
    add(build(gh, tierId));
  }

  addSubtasks(index, allData);
  return index;
}

/** D-19: cached sprint-board subtasks, de-duplicated by key (backlog wins). */
function addSubtasks(index: SearchIndex, allData: GhAllDataResponse | undefined) {
  if (!allData) return;
  const maps = buildEntityMaps(allData);
  for (const gh of allData.issuesData.issues) {
    if (!gh.parentKey || index.byKey.has(gh.key)) continue;
    const status = resolveStatus(gh.statusId, maps);
    const type = resolveType(gh.typeId, maps);
    const epic = resolveEpic(gh.epicId, maps);
    // Same rule as the backlog subtask path: done outside the current sprint -> Closed (D-15).
    let tierId = index.byKey.get(gh.parentKey)?.tierId ?? CURRENT_ID;
    if (gh.done && tierId !== CURRENT_ID) tierId = CLOSED_ID;
    const entry: SearchEntry = {
      key: gh.key,
      summary: gh.summary,
      typeName: type.name,
      isSubtask: true,
      isEpic: false,
      statusName: status.name,
      statusCategoryKey: gh.done ? 'done' : status.statusCategory.key,
      done: gh.done,
      assigneeName: gh.assigneeName ?? null,
      avatarUrl: gh.avatarUrl ?? null,
      epic: epic ? { key: epic.key, name: epic.name, color: epic.color } : null,
      parentKey: gh.parentKey,
      tierId,
    };
    index.entries.push(entry);
    index.byKey.set(entry.key, entry);
  }
}

export function findIndexEntry(index: SearchIndex, key: string): SearchEntry | null {
  const wanted = upperKey(key);
  const direct = index.byKey.get(key) ?? index.byKey.get(wanted);
  if (direct) return direct;
  for (const e of index.entries) {
    if (upperKey(e.key) === wanted) return e;
  }
  return null;
}

/** Same shape Jira allows for project keys (letter first, then letters/digits/_), any case. */
export function isKeyLikeQuery(trimmed: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]*-\d+$/.test(trimmed);
}

export function resolveKeyLookup(trimmed: string, activeProject: string | null): string {
  if (isKeyLikeQuery(trimmed)) return trimmed.toUpperCase();
  if (/^\d+$/.test(trimmed) && activeProject) return `${activeProject}-${trimmed}`.toUpperCase();
  return '';
}

export function entryFromJiraIssue(
  issue: JiraIssue,
  index: SearchIndex,
  epicLinkFieldKey: string,
  scope: 'open' | 'closed',
): SearchEntry {
  const f = (issue.fields ?? {}) as Partial<JiraIssue['fields']>;
  const existing = findIndexEntry(index, issue.key);
  const parentKey = typeof f.parent?.key === 'string' ? f.parent.key : null;
  const isSubtask = !!f.issuetype?.subtask || !!parentKey;

  const rawEpic = (f as Record<string, unknown>)[epicLinkFieldKey];
  const epicFromField =
    typeof rawEpic === 'string' ? (index.epicsByKey.get(rawEpic) ?? null) : null;

  const catKey = f.status?.statusCategory?.key ?? 'indeterminate';
  let tierId: string;
  if (existing) tierId = existing.tierId;
  else if (parentKey && findIndexEntry(index, parentKey)) {
    tierId = findIndexEntry(index, parentKey)?.tierId ?? BACKLOG_ID;
  } else if (scope === 'closed') tierId = CLOSED_ID;
  else tierId = isEpicType(f.issuetype?.name) ? EPICS_ID : BACKLOG_ID;
  // Same rule as the index paths: done outside the current sprint -> Closed (D-15).
  if (catKey === 'done' && tierId !== CURRENT_ID) tierId = CLOSED_ID;
  return {
    key: issue.key,
    summary: f.summary ?? existing?.summary ?? '',
    typeName: f.issuetype?.name ?? existing?.typeName ?? '',
    isSubtask,
    isEpic: isEpicType(f.issuetype?.name),
    statusName: f.status?.name ?? existing?.statusName ?? '',
    statusCategoryKey: catKey,
    done: catKey === 'done',
    assigneeName: f.assignee?.displayName ?? null,
    avatarUrl: f.assignee?.avatarUrls?.['48x48'] ?? null,
    epic: epicFromField ?? existing?.epic ?? null,
    parentKey,
    tierId,
  };
}

export function classifyBodyHit(
  query: string,
  issue: JiraIssue,
): { field: 1 | 2; snippet: { text: string; ranges: HighlightRange[] } | null } {
  // Enough context for the two-line excerpt under the title (~40 chars before, 160 after).
  const snippetOf = (raw: unknown) => {
    const text = stripWikiMarkup(typeof raw === 'string' ? raw : '');
    return text && matchText(query, text, { fuzzy: false })
      ? buildSnippet(text, query, 160, 40)
      : null;
  };
  const desc = snippetOf(issue.fields?.description);
  if (desc) return { field: 1, snippet: desc };
  // Comments come back with the body search (fields=comment); newest first.
  const comments =
    (issue.fields as { comment?: { comments?: Array<{ body?: unknown }> } } | undefined)?.comment
      ?.comments ?? [];
  for (let i = comments.length - 1; i >= 0; i--) {
    const snip = snippetOf(comments[i]?.body);
    if (snip) return { field: 2, snippet: snip };
  }
  // Matched another text field (or a prefix the local matcher can't confirm): label only.
  return { field: 2, snippet: null };
}

export function matchesSecondary(
  query: string,
  ...labels: Array<string | undefined | null>
): boolean {
  const tokens = tokenize(query);
  if (tokens.length === 0) return false;
  const hay = labels
    .filter((l): l is string => !!l)
    .join(' ')
    .toLowerCase();
  return tokens.every((t) => hay.includes(t));
}

// ─── Result model ────────────────────────────────────────────────────────────

interface Hit {
  entry: SearchEntry;
  field: FieldTier;
  match: TextMatch | null;
  titleRanges: HighlightRange[];
  snippet: { text: string; ranges: HighlightRange[] } | null;
  tag: MatchTag | null;
}

interface Group {
  tier: SearchTier;
  parent: SearchEntry;
  parentHit: Hit | null;
  children: Hit[];
}

function compareHits(a: Hit, b: Hit): number {
  if (a.field !== b.field) return a.field - b.field;
  if (a.match && b.match) return compareTextMatch(a.match, b.match);
  if (a.match) return -1;
  if (b.match) return 1;
  return 0;
}

function bestMatchOf(g: Group): { kind: number; score: number } {
  const hits = [g.parentHit, ...g.children].filter((h): h is Hit => !!h);
  const best = [...hits].sort(compareHits)[0];
  return best?.match
    ? { kind: KIND_RANK[best.match.kind], score: best.match.score }
    : { kind: 3, score: 0 };
}

function groupField(g: Group): number {
  if (g.parentHit) return g.parentHit.field;
  return Math.min(...g.children.map((c) => c.field)) + 1;
}

function toRow(hit: Hit, indent: boolean): ResultRow {
  return {
    entry: hit.entry,
    field: hit.field,
    titleRanges: hit.titleRanges,
    snippet: hit.snippet,
    tag: hit.tag,
    dimmed: false,
    indent,
  };
}

export function buildResultModel(input: {
  index: SearchIndex;
  query: string;
  bodyIssues: JiraIssue[];
  closedIssues: JiraIssue[];
  includeClosed: boolean;
  expandedTiers: ReadonlySet<string>;
  epicLinkFieldKey: string;
}): ResultSection[] {
  const { index, query, includeClosed, expandedTiers, epicLinkFieldKey } = input;
  if (query.trim().length < 2) return [];

  const hits = new Map<string, Hit>();
  const jiraEntries = new Map<string, SearchEntry>();
  const visible = (e: SearchEntry) => e.tierId !== CLOSED_ID || includeClosed;

  const consider = (hit: Hit) => {
    const prev = hits.get(hit.entry.key);
    if (!prev || compareHits(hit, prev) < 0) {
      hits.set(hit.entry.key, hit);
      return;
    }
    // Keep the better-ranked hit but show the fresher (Jira) entry. A title hit's ranges
    // were computed on the old summary, so re-match them on the new one when it changed.
    if (prev.field !== 0 || prev.entry.summary === hit.entry.summary) {
      hits.set(prev.entry.key, { ...prev, entry: hit.entry });
      return;
    }
    const fresh = matchText(query, hit.entry.summary);
    hits.set(
      prev.entry.key,
      fresh
        ? { ...prev, entry: hit.entry, match: fresh, titleRanges: runsFromIndexes(fresh.indexes) }
        : hit, // the title no longer matches: the Jira body hit is the real result
    );
  };

  // 1. Title tier from the local index.
  for (const entry of index.entries) {
    if (!visible(entry)) continue;
    const match = matchText(query, entry.summary);
    if (match) {
      consider({
        entry,
        field: 0,
        match,
        titleRanges: runsFromIndexes(match.indexes),
        snippet: null,
        tag: null,
      });
    }
  }

  // 2. Body hits from Jira.
  const bodySources: Array<[JiraIssue[], 'open' | 'closed']> = [[input.bodyIssues, 'open']];
  if (includeClosed) bodySources.push([input.closedIssues, 'closed']);
  for (const [issues, scope] of bodySources) {
    for (const issue of issues) {
      const entry = entryFromJiraIssue(issue, index, epicLinkFieldKey, scope);
      if (!visible(entry)) continue;
      jiraEntries.set(entry.key, entry);
      const match = matchText(query, entry.summary);
      if (match) {
        consider({
          entry,
          field: 0,
          match,
          titleRanges: runsFromIndexes(match.indexes),
          snippet: null,
          tag: null,
        });
        continue;
      }
      const body = classifyBodyHit(query, issue);
      consider({
        entry,
        field: body.field,
        match: null,
        titleRanges: [],
        snippet: body.snippet,
        // A body hit with neither description nor comment text matched another field.
        tag: body.field === 1 ? 'desc' : body.snippet ? 'comment' : 'other',
      });
    }
  }

  // 3. Group subtasks under their parent (D-07).
  const tierOf = (id: string): SearchTier =>
    index.tiers.get(id) ??
    index.tiers.get(BACKLOG_ID) ?? { id: BACKLOG_ID, label: 'Backlog', rank: 1000 };
  const groups = new Map<string, Group>();
  const resolveParent = (key: string): SearchEntry | undefined =>
    hits.get(key)?.entry ?? findIndexEntry(index, key) ?? jiraEntries.get(key) ?? undefined;

  for (const hit of hits.values()) {
    const parent =
      hit.entry.isSubtask && hit.entry.parentKey ? resolveParent(hit.entry.parentKey) : undefined;
    if (parent && !parent.isSubtask) {
      let g = groups.get(parent.key);
      if (!g) {
        g = {
          tier: tierOf(parent.tierId),
          parent,
          parentHit: hits.get(parent.key) ?? null,
          children: [],
        };
        groups.set(parent.key, g);
      }
      g.children.push(hit);
    } else {
      const existing = groups.get(hit.entry.key);
      if (existing) existing.parentHit = hit;
      else
        groups.set(hit.entry.key, {
          tier: tierOf(hit.entry.tierId),
          parent: hit.entry,
          parentHit: hit,
          children: [],
        });
    }
  }

  // 4. Sort groups, 5. emit sections with caps.
  const sorted = [...groups.values()].sort((a, b) => {
    if (a.tier.rank !== b.tier.rank) return a.tier.rank - b.tier.rank;
    const fa = groupField(a);
    const fb = groupField(b);
    if (fa !== fb) return fa - fb;
    const ma = bestMatchOf(a);
    const mb = bestMatchOf(b);
    if (ma.kind !== mb.kind) return ma.kind - mb.kind;
    if (ma.score !== mb.score) return mb.score - ma.score;
    return a.parent.key.localeCompare(b.parent.key);
  });

  const byTier = new Map<string, Group[]>();
  for (const g of sorted) {
    const list = byTier.get(g.tier.id) ?? [];
    list.push(g);
    byTier.set(g.tier.id, list);
  }

  const sections: ResultSection[] = [];
  let totalShown = 0;
  // Set once TOTAL_CAP hides a group: every later group (any tier) is hidden too, so a
  // lower-ranked tier never shows rows while a higher-ranked group is cut.
  let totalOverflowed = false;
  const orderedTiers = [...byTier.keys()].map(tierOf).sort((a, b) => a.rank - b.rank);
  for (const tier of orderedTiers) {
    const expanded = expandedTiers.has(tier.id);
    const rows: ResultRow[] = [];
    let hidden = 0;
    let overflowed = false;
    for (const g of byTier.get(tier.id) ?? []) {
      const children = [...g.children].sort(
        (a, b) => compareHits(a, b) || a.entry.key.localeCompare(b.entry.key),
      );
      const groupRows: ResultRow[] = [];
      if (g.parentHit) groupRows.push(toRow(g.parentHit, false));
      else {
        groupRows.push({
          entry: g.parent,
          field: null,
          titleRanges: [],
          snippet: null,
          tag: null,
          dimmed: true,
          indent: false,
        });
      }
      for (const c of children) {
        if (g.parentHit?.entry.key === c.entry.key) continue;
        groupRows.push(toRow(c, true));
      }
      const n = groupRows.length;
      const fitsTier = expanded || rows.length === 0 || rows.length + n <= PER_TIER_CAP;
      const fitsTotal = expanded || (!totalOverflowed && totalShown + n <= TOTAL_CAP);
      if (!overflowed && fitsTier && fitsTotal) {
        rows.push(...groupRows);
        totalShown += n;
      } else {
        if (!overflowed && fitsTier) totalOverflowed = true;
        overflowed = true;
        hidden += n;
      }
    }
    sections.push({ tier, rows, hiddenCount: hidden });
  }
  return sections;
}

/**
 * Remove the pinned Direct-match issue from the ranked sections. If that issue heads a
 * group (its matched subtasks follow, indented), keep it as a dimmed context row instead
 * so the subtasks never end up nested under the previous story.
 */
export function withoutDirectMatch(
  sections: ResultSection[],
  directKey: string | undefined,
): ResultSection[] {
  if (!directKey) return sections;
  return sections
    .map((sec) => ({
      ...sec,
      rows: sec.rows.flatMap((r, i): ResultRow[] => {
        if (r.entry.key !== directKey) return [r];
        if (!sec.rows[i + 1]?.indent) return [];
        return [{ ...r, dimmed: true, titleRanges: [], snippet: null, tag: null }];
      }),
    }))
    .filter((sec) => sec.rows.length > 0 || sec.hiddenCount > 0);
}
