import { describe, expect, it } from 'vitest';
import { APPROVED_EXAMPLE, CURRENT_FORMAT_EXAMPLE, WORDY_ENTRY } from './__fixtures__/samples';
import { ALLOWED_HEADINGS, LIMITS, lintReleaseNotes } from './lint';

const wrap = (bullet: string) => `One summary sentence.\n\n### Fixed\n${bullet}`;

describe('lintReleaseNotes', () => {
  it('passes the current format with zero errors', () => {
    expect(lintReleaseNotes(CURRENT_FORMAT_EXAMPLE).errors).toEqual([]);
  });

  it('rejects the older bold-title format for new notes', () => {
    const { errors } = lintReleaseNotes(APPROVED_EXAMPLE);
    expect(errors.some((e) => /plain sentence/.test(e))).toBe(true);
  });

  it('fails a wordy 1.14.20-style entry', () => {
    const { errors } = lintReleaseNotes(WORDY_ENTRY);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /headline/i.test(e))).toBe(true);
  });

  it('passes a bullet exactly at the limit', () => {
    expect(lintReleaseNotes(wrap(`- ${'x'.repeat(LIMITS.bullet)}`)).errors).toEqual([]);
  });

  it('fails a bullet one char over the limit, naming the limit', () => {
    const { errors } = lintReleaseNotes(wrap(`- ${'x'.repeat(LIMITS.bullet + 1)}`));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(new RegExp(`${LIMITS.bullet}-char bullet limit`));
  });

  it('rejects bold bullets', () => {
    expect(lintReleaseNotes(wrap('- **Title** — detail')).errors).toHaveLength(1);
    expect(lintReleaseNotes(wrap('- Has **bold** inside')).errors).toHaveLength(1);
  });

  it('flags missing headline, long headline and multi-sentence headline', () => {
    expect(lintReleaseNotes('### Fixed\n- A').errors.some((e) => /Missing headline/.test(e))).toBe(
      true,
    );
    expect(
      lintReleaseNotes(`${'h'.repeat(LIMITS.headline + 1)}\n\n### Fixed\n- A`).errors.some((e) =>
        /Headline is over/.test(e),
      ),
    ).toBe(true);
    expect(
      lintReleaseNotes('One. Two.\n\n### Fixed\n- A').errors.some((e) => /single sentence/.test(e)),
    ).toBe(true);
  });

  it('flags too many bullets per section, Fixed bullets and in total', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => `- Bullet ${i}`).join('\n');
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
    expect(lintReleaseNotes('H.\n\n- A').errors.some((e) => /No ### section/.test(e))).toBe(true);
  });

  it('accepts only the current section headings', () => {
    for (const h of ALLOWED_HEADINGS) {
      expect(lintReleaseNotes(`H.\n\n### ${h}\n- A`).errors).toEqual([]);
    }
    for (const h of ['Added', 'Changed', 'Misc']) {
      expect(
        lintReleaseNotes(`H.\n\n### ${h}\n- A`).errors.some((e) => e.includes(`### ${h}`)),
      ).toBe(true);
    }
  });
});
