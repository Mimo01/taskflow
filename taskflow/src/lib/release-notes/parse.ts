// Release-notes parser shared by the app (modals, Settings history) and the
// release scripts (lint). Pure, dependency-free, erasable TS only, because Node
// imports this file directly via type stripping (see scripts/bump-version.mjs).

export type NoteKind = 'new' | 'improved' | 'fixed' | 'removed' | 'security' | 'other';

export interface NoteItem {
  title: string;
  detail: string | null;
  children: NoteItem[];
  raw: string;
}

export interface NoteSection {
  kind: NoteKind;
  label: string | null;
  items: NoteItem[];
}

export interface ParsedNotes {
  headline: string | null;
  sections: NoteSection[];
  extra: string[];
  structured: boolean;
  raw: string;
}

const TRAILER_RE = /^(Co-Authored-By|Signed-off-by):/i;
const HEADING_RE = /^#{1,4}\s+(.+?)\s*#*\s*$/;
const VERSION_HEADING_RE = /^\[?v?\d+(\.\d+)+/i;
const BULLET_RE = /^(\s*)([-*+])\s+(.+)$/;

function kindForHeading(label: string): NoteKind {
  const l = label
    .toLowerCase()
    .replace(/[*_`:]/g, '')
    .trim();
  if (/^(added|new|features?)$/.test(l)) return 'new';
  if (/^(changed|improved|improvements?)$/.test(l)) return 'improved';
  if (/^(fixed|fix(es)?|bug ?fix(es)?)$/.test(l)) return 'fixed';
  if (/^(removed|deprecated)$/.test(l)) return 'removed';
  if (l === 'security') return 'security';
  return 'other';
}

const NO_BOLD = '((?:(?!\\*\\*).)+)';
const SPLIT_A = new RegExp(`^\\*\\*${NO_BOLD}\\*\\*\\s*[—–:-]\\s+(.+)$`);
const SPLIT_B = new RegExp(`^\\*\\*${NO_BOLD}:\\*\\*\\s*(.*)$`);
const SPLIT_C = new RegExp(`^\\*\\*${NO_BOLD}\\*\\*$`);

function stripTrailingDot(s: string): string {
  return s.replace(/(?<!\.)\.$/, '').trim();
}

function splitTitle(text: string): { title: string; detail: string | null } {
  const t = text.trim();
  let m = SPLIT_A.exec(t);
  if (m) return { title: stripTrailingDot(m[1]), detail: m[2].trim() };
  m = SPLIT_B.exec(t);
  if (m) return { title: stripTrailingDot(m[1]), detail: m[2].trim() || null };
  m = SPLIT_C.exec(t);
  if (m) return { title: stripTrailingDot(m[1]), detail: null };
  return { title: stripTrailingDot(t), detail: null };
}

function makeItem(text: string): NoteItem {
  const { title, detail } = splitTitle(text);
  return { title, detail, children: [], raw: text.trim() };
}

function appendContinuation(item: NoteItem, line: string): void {
  const text = line.trim();
  item.raw = `${item.raw} ${text}`;
  item.detail = item.detail ? `${item.detail} ${text}` : text;
}

export function parseReleaseNotes(md: string | null | undefined): ParsedNotes {
  const cleaned = (md ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => !TRAILER_RE.test(l.trim()))
    .join('\n')
    .trim();

  const sections: NoteSection[] = [];
  const extra: string[] = [];
  let headline: string | null = null;
  let seenStructure = false;
  let current: NoteSection | null = null;
  let lastTop: NoteItem | null = null;
  let lastItem: NoteItem | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length === 0) return;
    const text = para.join(' ').trim();
    para = [];
    if (!text) return;
    if (headline === null && !seenStructure) headline = text;
    else extra.push(text);
  };

  for (const line of cleaned.split('\n')) {
    if (line.trim() === '') {
      flushPara();
      continue;
    }
    const h = HEADING_RE.exec(line.trim());
    if (h) {
      flushPara();
      const label = h[1].trim();
      if (VERSION_HEADING_RE.test(label)) continue;
      seenStructure = true;
      const clean = label.replace(/[*_`]/g, '').replace(/:$/, '').trim();
      const kind = kindForHeading(clean);
      current = { kind, label: kind === 'other' ? clean : null, items: [] };
      sections.push(current);
      lastTop = null;
      lastItem = null;
      continue;
    }
    const b = BULLET_RE.exec(line);
    if (b) {
      flushPara();
      seenStructure = true;
      const indent = b[1].replace(/\t/g, '  ').length;
      const item = makeItem(b[3]);
      if (indent >= 2 && lastTop) {
        lastTop.children.push(item);
      } else {
        if (!current) {
          current = { kind: 'other', label: null, items: [] };
          sections.push(current);
        }
        current.items.push(item);
        lastTop = item;
      }
      lastItem = item;
      continue;
    }
    if (/^\s/.test(line) && lastItem) {
      appendContinuation(lastItem, line);
      continue;
    }
    para.push(line.trim());
  }
  flushPara();

  const nonEmpty = sections.filter((s) => s.items.length > 0);
  return {
    headline,
    sections: nonEmpty,
    extra,
    structured: nonEmpty.length > 0,
    raw: cleaned,
  };
}

export function summarizeNotes(p: ParsedNotes): string | null {
  if (p.headline) return p.headline;
  for (const s of p.sections) {
    if (s.items[0]) return s.items[0].title;
  }
  const first = p.raw.split('\n').find((l) => l.trim() !== '');
  return first ? first.trim() : null;
}
