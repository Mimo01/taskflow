/**
 * Find-in-page engine: accent/case-insensitive matching over text runs,
 * DOM text collection, scope resolution and scroll helpers.
 * No module-level mutable state.
 */

export interface FoldedText {
  folded: string;
  starts: number[];
  ends: number[];
}

/** Fold text to lowercase, accent-free form with a per-unit map to original offsets. */
export function foldText(text: string): FoldedText {
  let folded = '';
  const starts: number[] = [];
  const ends: number[] = [];
  let i = 0;
  for (const ch of text) {
    // Whitespace runs (incl. nbsp/newlines) collapse to one space, like rendered text
    let f = /\s/.test(ch) ? (folded.endsWith(' ') ? '' : ' ') : ch;
    f = f.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    for (let k = 0; k < f.length; k++) {
      starts.push(i);
      ends.push(i + ch.length);
    }
    folded += f;
    i += ch.length;
  }
  return { folded, starts, ends };
}

export interface RunMatch {
  run: number;
  start: number;
  end: number;
}

export const FIND_CAP = 1000;

export function findInRuns(
  runs: string[],
  query: string,
  cap = FIND_CAP,
): { matches: RunMatch[]; capped: boolean } {
  const q = foldText(query.trim()).folded;
  const matches: RunMatch[] = [];
  if (!q) return { matches, capped: false };
  for (let r = 0; r < runs.length; r++) {
    const { folded, starts, ends } = foldText(runs[r]);
    let pos = folded.indexOf(q);
    while (pos !== -1) {
      if (matches.length >= cap) return { matches, capped: true };
      matches.push({ run: r, start: starts[pos], end: ends[pos + q.length - 1] });
      pos = folded.indexOf(q, pos + q.length);
    }
  }
  return { matches, capped: false };
}

export interface TextRun {
  text: string;
  segments: { node: Text; start: number }[];
  parent: Element;
}

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'TEXTAREA',
  'INPUT',
  'SELECT',
  'svg',
  'SVG',
]);

function isExcludedElement(el: Element): boolean {
  if (SKIP_TAGS.has(el.tagName)) return true;
  return (
    el.hasAttribute('hidden') ||
    el.getAttribute('aria-hidden') === 'true' ||
    el.hasAttribute('inert') ||
    el.hasAttribute('data-find-bar')
  );
}

export function defaultIsVisible(el: Element): boolean {
  const e = el as Element & {
    checkVisibility?: (o?: { visibilityProperty?: boolean; opacityProperty?: boolean }) => boolean;
  };
  if (typeof e.checkVisibility === 'function') {
    return e.checkVisibility({ visibilityProperty: true, opacityProperty: false });
  }
  return el.getClientRects().length > 0;
}

/** Collect runs of consecutive sibling text nodes (no element between them). */
export function collectRuns(scope: Element): TextRun[] {
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        return isExcludedElement(node as Element)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const runs: TextRun[] = [];
  let current: TextRun | null = null;
  let lastNode: Text | null = null;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text;
    const parent = t.parentElement;
    if (!parent) continue;
    // Continue the run only if the previous accepted node is the immediate
    // previous sibling-ish text (whitespace-only text nodes are tolerated
    // only when directly adjacent siblings).
    const contiguous =
      current !== null &&
      lastNode !== null &&
      current.parent === parent &&
      onlyTextBetween(lastNode, t);
    if (!contiguous) {
      // Whitespace-only nodes never start a run, but are kept inside one so
      // "foo{' '}bar" stays "foo bar" rather than "foobar".
      if ((t.nodeValue ?? '').trim() === '') continue;
      current = { text: '', segments: [], parent };
      runs.push(current);
    }
    const run = current as TextRun;
    run.segments.push({ node: t, start: run.text.length });
    run.text += t.nodeValue ?? '';
    lastNode = t;
  }
  return runs;
}

function onlyTextBetween(a: Text, b: Text): boolean {
  for (let s = a.nextSibling; s; s = s.nextSibling) {
    if (s === b) return true;
    if (s.nodeType !== Node.TEXT_NODE) return false;
  }
  return false;
}

export function buildMatchRanges(
  runs: TextRun[],
  query: string,
  isVisible: (el: Element) => boolean = defaultIsVisible,
): { ranges: Range[]; capped: boolean } {
  const { matches, capped } = findInRuns(
    runs.map((r) => r.text),
    query,
  );
  const visCache = new Map<Element, boolean>();
  const ranges: Range[] = [];
  for (const m of matches) {
    const run = runs[m.run];
    let vis = visCache.get(run.parent);
    if (vis === undefined) {
      vis = isVisible(run.parent);
      visCache.set(run.parent, vis);
    }
    if (!vis) continue;
    const s = locate(run, m.start, false);
    const e = locate(run, m.end, true);
    if (!s || !e) continue;
    const range = document.createRange();
    range.setStart(s.node, s.offset);
    range.setEnd(e.node, e.offset);
    ranges.push(range);
  }
  return { ranges, capped };
}

function locate(
  run: TextRun,
  offset: number,
  isEnd: boolean,
): { node: Text; offset: number } | null {
  for (let i = 0; i < run.segments.length; i++) {
    const seg = run.segments[i];
    const len = seg.node.nodeValue?.length ?? 0;
    const end = seg.start + len;
    if (isEnd ? offset > seg.start && offset <= end : offset >= seg.start && offset < end) {
      return { node: seg.node, offset: offset - seg.start };
    }
  }
  return null;
}

export type FindScopeKind = 'modal' | 'peek' | 'main';

const MODAL_SEL =
  '[data-slot="dialog-content"],[data-slot="sheet-content"],[role="dialog"][aria-modal="true"],[role="alertdialog"]';

export function resolveFindScope(
  doc: Document = document,
): { el: HTMLElement; kind: FindScopeKind } | null {
  const modals = [...doc.querySelectorAll<HTMLElement>(MODAL_SEL)].filter(
    (el) => el.isConnected && !el.closest('[data-closed],[inert]'),
  );
  const modal = modals[modals.length - 1];
  if (modal) return { el: modal, kind: 'modal' };
  const peek = doc.querySelector<HTMLElement>('[data-find-scope="peek"]');
  if (peek) return { el: peek, kind: 'peek' };
  const main = doc.querySelector<HTMLElement>('[data-find-scope="main"]');
  if (main) return { el: main, kind: 'main' };
  return null;
}

function scrollableAncestor(el: Element | null): HTMLElement | null {
  for (let p = el; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) {
      return p as HTMLElement;
    }
  }
  return null;
}

export function scrollRangeIntoView(range: Range): void {
  const el = range.startContainer.parentElement;
  el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  const anc = scrollableAncestor(el ?? null);
  if (!anc) return;
  const r = range.getBoundingClientRect();
  const a = anc.getBoundingClientRect();
  if (r.top < a.top || r.bottom > a.bottom) {
    anc.scrollTop += r.top - a.top - (a.height - r.height) / 2;
  }
}

export interface MatchBox {
  left: number;
  top: number;
  width: number;
  height: number;
  current: boolean;
}

interface ClipRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const CLIPPING = new Set(['hidden', 'auto', 'scroll', 'clip']);

/**
 * Viewport-space boxes for each match, clipped to every overflow-clipping
 * ancestor so matches scrolled out of an inner container aren't drawn over
 * its surroundings. Boxes fully clipped away are dropped.
 */
export function layoutMatchBoxes(ranges: Range[], currentIdx: number): MatchBox[] {
  const memo = new Map<Element, ClipRect>();
  const viewport: ClipRect = {
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
  };
  const clipFor = (el: Element | null): ClipRect => {
    if (!el || el === document.documentElement) return viewport;
    const cached = memo.get(el);
    if (cached) return cached;
    let clip = clipFor(el.parentElement);
    const style = getComputedStyle(el);
    const overflow = `${style.overflow} ${style.overflowX} ${style.overflowY}`.split(/\s+/);
    if (overflow.some((v) => CLIPPING.has(v))) {
      const r = el.getBoundingClientRect();
      clip = {
        left: Math.max(clip.left, r.left),
        top: Math.max(clip.top, r.top),
        right: Math.min(clip.right, r.right),
        bottom: Math.min(clip.bottom, r.bottom),
      };
    }
    memo.set(el, clip);
    return clip;
  };

  const boxes: MatchBox[] = [];
  ranges.forEach((range, i) => {
    // Includes the text's own parent, so e.g. `truncate` cuts the box at the ellipsis.
    const clip = clipFor(range.startContainer.parentElement);
    for (const r of range.getClientRects()) {
      const left = Math.max(r.left, clip.left);
      const top = Math.max(r.top, clip.top);
      const right = Math.min(r.right, clip.right);
      const bottom = Math.min(r.bottom, clip.bottom);
      if (right - left < 1 || bottom - top < 1) continue;
      boxes.push({
        left,
        top,
        width: right - left,
        height: bottom - top,
        current: i === currentIdx,
      });
    }
  });
  return boxes;
}
