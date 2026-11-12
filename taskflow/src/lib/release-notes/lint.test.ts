import { describe, expect, it } from 'vitest';
import { APPROVED_EXAMPLE, WORDY_ENTRY } from './__fixtures__/samples';
import { LIMITS, lintReleaseNotes } from './lint';

const wrap = (bullet: string) => `One summary sentence.\n\n### Fixed\n${bullet}`;

describe('lintReleaseNotes', () => {
  it('passes the approved example with zero errors', () => {
    expect(lintReleaseNotes(APPROVED_EXAMPLE).errors).toEqual([]);
  });

  it('fails a wordy 1.14.20-style entry', () => {
    const { errors } = lintReleaseNotes(WORDY_ENTRY);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /headline/i.test(e))).toBe(true);
  });

  it('passes a plain bullet exactly at the limit', () => {
    const bullet = `- ${'x'.repeat(LIMITS.plainBullet)}`;
    expect(lintReleaseNotes(wrap(bullet)).errors).toEqual([]);
  });

  it('fails a plain bullet one char over the limit, naming the limit', () => {
    const { errors } = lintReleaseNotes(wrap(`- ${'x'.repeat(LIMITS.plainBullet + 1)}`));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(new RegExp(`${LIMITS.plainBullet}-char plain-bullet limit`));
  });

  it('fails a bold title over 50 chars naming the title limit', () => {
    const { errors } = lintReleaseNotes(wrap(`- **${'t'.repeat(51)}**`));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/50-char title limit/);
  });

  it('does not apply the title limit to plain bullets', () => {
    expect(lintReleaseNotes(wrap(`- ${'x'.repeat(60)}`)).errors).toEqual([]);
  });

  it('flags long or multi-sentence details on bold bullets', () => {
    expect(lintReleaseNotes(wrap(`- **T** — ${'d'.repeat(71)}`)).errors).toHaveLength(1);
    expect(lintReleaseNotes(wrap('- **T** — one. two')).errors).toHaveLength(1);
    expect(lintReleaseNotes(wrap('- **T** — a; b')).errors).toHaveLength(1);
  });

  it('flags missing headline, long headline and multi-sentence headline', () => {
    expect(
      lintReleaseNotes('### Fixed\n- **A**').errors.some((e) => /Missing headline/.test(e)),
    ).toBe(true);
    expect(
      lintReleaseNotes(`${'h'.repeat(121)}\n\n### Fixed\n- **A**`).errors.some((e) =>
        /Headline is over/.test(e),
      ),
    ).toBe(true);
    expect(
      lintReleaseNotes('One. Two.\n\n### Fixed\n- **A**').errors.some((e) =>
        /single sentence/.test(e),
      ),
    ).toBe(true);
  });

  it('flags too many bullets per section, Fixed bullets and in total', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => `- **B${i}**`).join('\n');
    expect(lintReleaseNotes(`H.\n\n### New\n${many(7)}`).errors.some((e) => /max 6/.test(e))).toBe(
      true,
    );
    expect(
      lintReleaseNotes(`H.\n\n### Fixed\n${many(6)}`).errors.some((e) => /Fixed has 6/.test(e)),
    ).toBe(true);
    const total = `H.\n\n### New\n${many(6)}\n\n### Improved\n${many(6)}\n\n### Removed\n${many(3)}`;
    expect(lintReleaseNotes(total).errors.some((e) => /15 bullets in total/.test(e))).toBe(true);
  });

  it('errors when there is no ### section', () => {
    expect(lintReleaseNotes('H.\n\n- **A**').errors.some((e) => /No ### section/.test(e))).toBe(
      true,
    );
  });

  it('only warns for an unknown heading', () => {
    const r = lintReleaseNotes('H.\n\n### Misc\n- **A**');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['Unknown heading "Misc".']);
  });
});
