/**
 * Pure helpers for rendering Jira changelog histories (quick 261002-h9e).
 *
 * Deliberately NOT exported from services/jira (ActivityTimeline.test mocks that module).
 * Nothing here throws on unexpected shapes; unknown input degrades to 'short'.
 */
import { diffWords } from 'diff';
import type { ChangelogHistory, TimelineEntry } from '@/services/jira';

export type FieldKind = 'long' | 'short' | 'status' | 'multi' | 'duration';

export const LONG_TEXT_THRESHOLD = 120;

const LONG_FIELDS = new Set(['description', 'summary', 'environment']);
const MULTI_FIELDS = new Set([
  'labels',
  'fix version',
  'fixversions',
  'version',
  'versions',
  'component',
  'components',
  'attachment',
  'link',
]);
const DURATION_FIELDS = new Set(['timeestimate', 'timeoriginalestimate', 'timespent']);

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

export function classifyField(
  field: string,
  fromString: string | null,
  toStr: string | null,
): FieldKind {
  const name = (typeof field === 'string' ? field : '').trim().toLowerCase();
  if (name === 'status') return 'status';
  if (DURATION_FIELDS.has(name)) return 'duration';
  if (LONG_FIELDS.has(name)) return 'long';
  if (MULTI_FIELDS.has(name)) return 'multi';
  const values = [str(fromString), str(toStr)];
  if (name === 'sprint') {
    return values.some((v) => v?.includes(',')) ? 'multi' : 'short';
  }
  if (values.some((v) => v != null && (v.includes('\n') || v.length > LONG_TEXT_THRESHOLD))) {
    return 'long';
  }
  return 'short';
}

function splitTokens(field: string, value: string | null): string[] {
  const v = str(value)?.trim();
  if (!v) return [];
  const name = (field ?? '').toLowerCase();
  let raw: string[];
  if (name === 'labels') raw = v.split(/\s+/);
  else if (name === 'sprint' || v.includes(',')) raw = v.split(/,\s*/);
  else raw = [v];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw) {
    const tok = t.trim();
    if (tok && !seen.has(tok)) {
      seen.add(tok);
      out.push(tok);
    }
  }
  return out;
}

export function tokenSetDiff(
  field: string,
  fromString: string | null,
  toStr: string | null,
): { added: string[]; removed: string[] } {
  const from = splitTokens(field, fromString);
  const to = splitTokens(field, toStr);
  const fromSet = new Set(from);
  const toSet = new Set(to);
  return {
    added: to.filter((t) => !fromSet.has(t)),
    removed: from.filter((t) => !toSet.has(t)),
  };
}

export interface DiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export interface WordDiffResult {
  parts: DiffPart[];
  addedWords: number;
  removedWords: number;
  whitespaceOnly: boolean;
  fallback: boolean;
}

function countWords(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

export function wordDiff(
  oldText: string | null,
  newText: string | null,
  maxEditLength = 2000,
): WordDiffResult {
  const a = (str(oldText) ?? '').replace(/\r\n/g, '\n');
  const b = (str(newText) ?? '').replace(/\r\n/g, '\n');
  const collapse = (s: string) => s.trim().replace(/\s+/g, ' ');
  if (collapse(a) === collapse(b)) {
    return {
      parts: [{ value: b }],
      addedWords: 0,
      removedWords: 0,
      whitespaceOnly: true,
      fallback: false,
    };
  }
  const result = diffWords(a, b, { maxEditLength }) as DiffPart[] | undefined;
  if (!result) {
    return {
      parts: [
        ...(a ? [{ value: a, removed: true }] : []),
        ...(b ? [{ value: b, added: true }] : []),
      ],
      addedWords: countWords(b),
      removedWords: countWords(a),
      whitespaceOnly: false,
      fallback: true,
    };
  }
  let addedWords = 0;
  let removedWords = 0;
  for (const p of result) {
    if (p.added) addedWords += countWords(p.value);
    else if (p.removed) removedWords += countWords(p.value);
  }
  return { parts: result, addedWords, removedWords, whitespaceOnly: false, fallback: false };
}

export type ChangeGroup = {
  type: 'change-group';
  timestamp: string;
  histories: ChangelogHistory[];
};

export type DisplayEntry = Exclude<TimelineEntry, { type: 'change' }> | ChangeGroup;

/** Null when the author is missing (anonymous/system) — such histories never merge. */
function authorKey(h: ChangelogHistory): string | null {
  return h.author?.name ?? h.author?.displayName ?? null;
}

/** The most recent history in a group, independent of the timeline sort order. */
export function latestHistory(histories: ChangelogHistory[]): ChangelogHistory | undefined {
  let latest: ChangelogHistory | undefined;
  for (const h of histories) {
    if (!latest || Date.parse(h.created) > Date.parse(latest.created)) latest = h;
  }
  return latest;
}

export function groupChangeBursts(entries: TimelineEntry[], windowMs = 5 * 60_000): DisplayEntry[] {
  const out: DisplayEntry[] = [];
  for (const entry of entries) {
    if (entry.type !== 'change') {
      out.push(entry);
      continue;
    }
    const prev = out[out.length - 1];
    if (prev && prev.type === 'change-group') {
      // Anchor the window to the group's first edit so a steady stream of edits
      // can't chain into one unbounded group.
      const anchor = prev.histories[0];
      const gap = Math.abs(Date.parse(entry.data.created) - Date.parse(anchor.created));
      const key = authorKey(entry.data);
      if (key !== null && authorKey(anchor) === key && Number.isFinite(gap) && gap <= windowMs) {
        prev.histories.push(entry.data);
        continue;
      }
    }
    out.push({ type: 'change-group', timestamp: entry.timestamp, histories: [entry.data] });
  }
  return out;
}

export interface MergedItem {
  key: string;
  field: string;
  kind: FieldKind;
  from: string | null;
  to: string | null;
  fromId: string | null;
  toId: string | null;
  added: string[];
  removed: string[];
  /** True once a later history in the burst touched the same field. */
  merged: boolean;
}

export function mergeGroupItems(histories: ChangelogHistory[]): MergedItem[] {
  const sorted = [...histories].sort((x, y) => {
    const dx = Date.parse(x.created);
    const dy = Date.parse(y.created);
    if (Number.isNaN(dx) || Number.isNaN(dy)) return 0;
    return dx - dy;
  });
  const map = new Map<string, MergedItem>();
  for (const h of sorted) {
    for (const item of h.items ?? []) {
      const field = str(item?.field) ?? '';
      const from = str(item?.fromString);
      const to = str(item?.toString);
      const fromId = str(item?.from);
      const toId = str(item?.to);
      const lower = field.toLowerCase();
      const existing = map.get(lower);
      if (!existing) {
        const kind = classifyField(field, from, to);
        const { added, removed } = tokenSetDiff(field, from, to);
        map.set(lower, {
          key: '',
          field,
          kind,
          from,
          to,
          fromId,
          toId,
          added,
          removed,
          merged: false,
        });
        continue;
      }
      existing.merged = true;
      if (existing.kind === 'multi' || classifyField(field, from, to) === 'multi') {
        const d = tokenSetDiff(field, from, to);
        // A token added then removed (or vice versa) within the burst cancels out.
        const added = existing.added.filter((t) => !d.removed.includes(t));
        const removed = existing.removed.filter((t) => !d.added.includes(t));
        for (const t of d.added) {
          if (!existing.removed.includes(t) && !added.includes(t)) added.push(t);
        }
        for (const t of d.removed) {
          if (!existing.added.includes(t) && !removed.includes(t)) removed.push(t);
        }
        existing.added = added;
        existing.removed = removed;
        existing.kind = 'multi';
        existing.to = to;
      } else {
        existing.to = to;
        existing.toId = toId;
        existing.kind = classifyField(field, existing.from, to);
      }
    }
  }
  // Drop fields an edit burst reverted (A → B → A); a single history is always shown as-is.
  const net = [...map.values()].filter((m) =>
    !m.merged
      ? true
      : m.kind === 'multi'
        ? m.added.length > 0 || m.removed.length > 0
        : m.from !== m.to,
  );
  return net.map((m, i) => ({ ...m, key: `${m.field}-${i}` }));
}
