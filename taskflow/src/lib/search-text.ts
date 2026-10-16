import fuzzysort from 'fuzzysort';

/** Half-open [start, end) char offsets into the rendered string. */
export type HighlightRange = [start: number, end: number];

export interface TextMatch {
  kind: 'exact' | 'word-start' | 'fuzzy';
  /** 0..1, higher is better */
  score: number;
  indexes: number[];
}

/** Minimum fuzzysort score (0..1) for a token to count as a fuzzy hit. */
export const FUZZY_THRESHOLD = 0.35;

const MIN_FUZZY_TOKEN_LEN = 3;
const MAX_RUNS = 6;

export function tokenize(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Lower-case without changing the string length, so indexes found in the result line up
 * with the original text. A character whose lower-case form is longer ('İ' -> 'i̇') is kept.
 */
function lowerSameLength(text: string): string {
  const lower = text.toLowerCase();
  if (lower.length === text.length) return lower;
  let out = '';
  for (const ch of text) {
    const l = ch.toLowerCase();
    out += l.length === ch.length ? l : ch;
  }
  return out;
}

function isWordBoundary(text: string, i: number): boolean {
  return i === 0 || !/[a-z0-9]/i.test(text[i - 1]);
}

function findWordStart(text: string, token: string): number {
  let from = 0;
  while (from <= text.length) {
    const i = text.indexOf(token, from);
    if (i === -1) return -1;
    if (isWordBoundary(text, i)) return i;
    from = i + 1;
  }
  return -1;
}

function range(start: number, len: number): number[] {
  return Array.from({ length: len }, (_, k) => start + k);
}

function union(lists: number[][]): number[] {
  return [...new Set(lists.flat())].sort((a, b) => a - b);
}

export function matchText(
  query: string,
  target: string,
  opts: { fuzzy?: boolean } = {},
): TextMatch | null {
  const tokens = tokenize(query);
  if (tokens.length === 0 || !target) return null;
  const lower = lowerSameLength(target);
  const phrase = tokens.join(' ');

  const phraseAt = lower.indexOf(phrase);
  if (phraseAt !== -1) {
    return { kind: 'exact', score: 1, indexes: range(phraseAt, phrase.length) };
  }

  const penalty = Math.min(0.05, lower.length / 10000);

  const wordStarts = tokens.map((t) => findWordStart(lower, t));
  if (wordStarts.every((i) => i !== -1)) {
    return {
      kind: 'word-start',
      score: 0.9 - penalty,
      indexes: union(wordStarts.map((i, k) => range(i, tokens[k].length))),
    };
  }

  const plain = tokens.map((t) => lower.indexOf(t));
  if (plain.every((i) => i !== -1)) {
    return {
      kind: 'word-start',
      score: 0.7 - penalty,
      indexes: union(plain.map((i, k) => range(i, tokens[k].length))),
    };
  }

  if (opts.fuzzy === false) return null;

  const scores: number[] = [];
  const lists: number[][] = [];
  for (let k = 0; k < tokens.length; k++) {
    const token = tokens[k];
    if (plain[k] !== -1) {
      scores.push(0.7);
      lists.push(range(plain[k], token.length));
      continue;
    }
    if (token.length < MIN_FUZZY_TOKEN_LEN) return null;
    const res = fuzzysort.single(token, target);
    if (!res || res.score < FUZZY_THRESHOLD) return null;
    scores.push(res.score);
    lists.push([...res.indexes]);
  }
  return {
    kind: 'fuzzy',
    score: scores.reduce((a, b) => a + b, 0) / scores.length,
    indexes: union(lists),
  };
}

/** Match-kind order shared by every ranking comparison (lower ranks higher). */
export const KIND_RANK = { exact: 0, 'word-start': 1, fuzzy: 2 } as const;

/** Negative when `a` ranks higher than `b`. */
export function compareTextMatch(a: TextMatch, b: TextMatch): number {
  const r = KIND_RANK[a.kind] - KIND_RANK[b.kind];
  if (r !== 0) return r;
  return b.score - a.score;
}

export function runsFromIndexes(indexes: number[], max = MAX_RUNS): HighlightRange[] {
  const sorted = [...new Set(indexes)].sort((a, b) => a - b);
  const runs: HighlightRange[] = [];
  for (const i of sorted) {
    const last = runs[runs.length - 1];
    if (last && last[1] === i) last[1] = i + 1;
    else runs.push([i, i + 1]);
  }
  return runs.slice(0, max);
}

export function buildSnippet(
  text: string,
  query: string,
  radius = 48,
  /** Context kept before the match; smaller keeps the match visible when the row truncates the snippet. */
  before = radius,
): { text: string; ranges: HighlightRange[] } | null {
  const tokens = tokenize(query);
  if (tokens.length === 0) return null;
  const flat = text.replace(/\s+/g, ' ').trim();
  const lower = lowerSameLength(flat);

  let pos = lower.indexOf(tokens.join(' '));
  let len = tokens.join(' ').length;
  if (pos === -1) {
    for (const t of tokens) {
      const i = lower.indexOf(t);
      if (i !== -1 && (pos === -1 || i < pos)) {
        pos = i;
        len = t.length;
      }
    }
  }
  if (pos === -1) return null;

  // Start from the beginning when it is only a little further back than the lead-in window.
  let start = pos <= before * 1.5 ? 0 : pos - before;
  // Prefer opening at the start of the match's sentence (no leading fragment of the previous one).
  const lead = flat.slice(start, pos);
  const sentence = Math.max(lead.lastIndexOf('. '), lead.lastIndexOf('! '), lead.lastIndexOf('? '));
  let atSentence = start === 0;
  if (sentence !== -1) {
    start += sentence + 2;
    atSentence = true;
  } else if (start > 0 && /\S/.test(flat[start - 1] ?? '')) {
    // Don't open the snippet mid-word: skip forward to the next word start (never past the match).
    const space = flat.indexOf(' ', start);
    if (space !== -1 && space < pos) start = space + 1;
  }
  const end = Math.min(flat.length, pos + len + radius);
  const prefix = start > 0 && !atSentence ? '…' : '';
  const suffix = end < flat.length ? '…' : '';
  const body = flat.slice(start, end);
  const lowerBody = lower.slice(start, end);

  const indexes: number[] = [];
  for (const t of tokens) {
    let from = 0;
    for (;;) {
      const i = lowerBody.indexOf(t, from);
      if (i === -1) break;
      for (let k = 0; k < t.length; k++) indexes.push(i + k + prefix.length);
      from = i + t.length;
    }
  }
  return {
    text: prefix + body + suffix,
    ranges: runsFromIndexes(indexes),
  };
}

export function stripWikiMarkup(text: string): string {
  return text
    .replace(/^\s*h[1-6]\.\s+/gm, '')
    .replace(/\{(?:code|noformat|quote|color|panel)(?::[^}]*)?\}/g, ' ')
    .replace(/!\S+?(?:\|[^!]*)?!/g, ' ')
    .replace(/\[~([^\]]+)\]/g, '$1')
    .replace(/\[([^\]|]+)\|[^\]]*\]/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
