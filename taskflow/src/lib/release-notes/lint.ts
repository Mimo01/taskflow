// Release-notes lint. Keeps notes short: headline + titles. Used by
// scripts/lint-release-notes.mjs, scripts/bump-version.mjs and the tests.
// Erasable TS only; relative `.ts` imports (Node type stripping).
import { type NoteItem, parseReleaseNotes } from './parse.ts';

export const LIMITS = {
  headline: 120,
  boldTitle: 50,
  detail: 70,
  plainBullet: 90,
  perSection: 6,
  fixed: 3,
  total: 14,
} as const;

function plain(s: string): string {
  return s.replace(/\*\*|`/g, '');
}

function lintItem(item: NoteItem, errors: string[]): void {
  const label = `"${plain(item.title).slice(0, 40)}"`;
  if (item.raw.startsWith('**')) {
    if (plain(item.title).length > LIMITS.boldTitle) {
      errors.push(`Bullet ${label}: title is over the ${LIMITS.boldTitle}-char title limit.`);
    }
    if (item.detail) {
      if (item.detail.length > LIMITS.detail) {
        errors.push(`Bullet ${label}: detail is over ${LIMITS.detail} chars.`);
      }
      if (/\. |;/.test(item.detail)) {
        errors.push(`Bullet ${label}: detail must be one short clause (no '. ' or ';').`);
      }
    }
  } else if (item.raw.trim().length > LIMITS.plainBullet) {
    errors.push(
      `Bullet ${label}: plain bullet is over the ${LIMITS.plainBullet}-char plain-bullet limit.`,
    );
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

  let total = 0;
  let fixed = 0;
  for (const s of p.sections) {
    if (s.kind === 'other' && s.label) warnings.push(`Unknown heading "${s.label}".`);
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
    errors.push(`Fixed has ${fixed} bullets (max ${LIMITS.fixed}); collapse fixes.`);
  }
  if (total > LIMITS.total) {
    errors.push(`${total} bullets in total (max ${LIMITS.total}).`);
  }
  return { errors, warnings };
}
