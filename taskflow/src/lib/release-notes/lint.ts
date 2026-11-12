// Release-notes lint for NEW notes: headline + plain short sentences (docs/RELEASE-NOTES.md).
// Display code still reads every legacy format; only authoring is strict. Used by
// scripts/lint-release-notes.mjs, scripts/bump-version.mjs and the tests.
// Erasable TS only; relative `.ts` imports (Node type stripping).
import { type NoteItem, parseReleaseNotes } from './parse.ts';

export const LIMITS = {
  /** Must fit the one-line summary column (Settings rows, dialog rows) untruncated. */
  headline: 65,
  bullet: 70,
  perSection: 6,
  fixed: 5,
  total: 14,
} as const;

/** Headings new notes may use. The app still reads legacy Added/Changed; new notes may not. */
export const ALLOWED_HEADINGS = ['New', 'Improved', 'Fixed', 'Removed', 'Security'] as const;

function plain(s: string): string {
  return s.replace(/\*\*|`/g, '');
}

function lintItem(item: NoteItem, errors: string[]): void {
  const text = item.raw.trim();
  const label = `"${plain(text).slice(0, 40)}"`;
  if (/\*\*/.test(text)) {
    errors.push(`Bullet ${label}: write one plain sentence (no bold, no "Title — detail").`);
  } else if (text.length > LIMITS.bullet) {
    errors.push(`Bullet ${label}: over the ${LIMITS.bullet}-char bullet limit.`);
  }
  for (const c of item.children) lintItem(c, errors);
}

function countAll(items: NoteItem[]): number {
  return items.reduce((n, i) => n + 1 + countAll(i.children), 0);
}

export function lintReleaseNotes(md: string): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const p = parseReleaseNotes(md);

  if (!p.headline) {
    errors.push('Missing headline: start with one summary sentence before the first ### section.');
  } else {
    if (p.headline.length > LIMITS.headline) {
      errors.push(`Headline is over ${LIMITS.headline} chars.`);
    }
    if (/[.!?]\s+\S/.test(p.headline)) {
      errors.push('Headline must be a single sentence.');
    }
  }

  if (!/^###\s+\S/m.test(p.raw)) {
    errors.push('No ### section found (use ### New / ### Improved / ### Fixed).');
  }
  for (const m of p.raw.matchAll(/^###\s+(.+?)\s*$/gm)) {
    if (!(ALLOWED_HEADINGS as readonly string[]).includes(m[1])) {
      errors.push(`Heading "### ${m[1]}": use ### ${ALLOWED_HEADINGS.join(' / ### ')}.`);
    }
  }

  let total = 0;
  let fixed = 0;
  for (const s of p.sections) {
    if (s.items.length > LIMITS.perSection) {
      errors.push(
        `Section ${s.label ?? s.kind} has ${s.items.length} bullets (max ${LIMITS.perSection}).`,
      );
    }
    if (s.kind === 'fixed') fixed += s.items.length;
    total += countAll(s.items);
    for (const i of s.items) lintItem(i, errors);
  }
  if (fixed > LIMITS.fixed) {
    errors.push(
      `Fixed has ${fixed} bullets (max ${LIMITS.fixed}); list only the fixes users notice.`,
    );
  }
  if (total > LIMITS.total) {
    errors.push(`${total} bullets in total (max ${LIMITS.total}).`);
  }
  return { errors, warnings };
}
