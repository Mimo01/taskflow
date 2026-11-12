import { describe, expect, it } from 'vitest';
import { lintReleaseNotes } from './lint';
import { bundledNotes, bundledNotesFor, parseChangelog, withBundledNotes } from './bundled';

const SAMPLE = `# Changelog

Intro.

## [2.0.1] — 2026-02-02

Short headline.

### Fixed
- **A fix**

## [2.0] — 2026-01-02

Milestone header, skipped.

## [2.0.0] — 2026-01-01

First.

### New
- **Thing**
`;

describe('parseChangelog', () => {
  it('maps X.Y.Z sections to their bodies and skips milestone headers', () => {
    const m = parseChangelog(SAMPLE);
    expect([...m.keys()]).toEqual(['2.0.1', '2.0.0']);
    expect(m.get('2.0.1')).toBe('Short headline.\n\n### Fixed\n- **A fix**');
    expect(m.get('2.0.0')).toContain('### New');
  });
});

describe('withBundledNotes', () => {
  it('replaces known versions and keeps the GitHub body for unknown ones', () => {
    const notes = parseChangelog(SAMPLE);
    const out = withBundledNotes(
      [
        { version: '2.0.1', body: 'wordy github body' },
        { version: '9.9.9', body: 'newer than this build' },
      ],
      notes,
    );
    expect(out[0].body).toBe(notes.get('2.0.1'));
    expect(out[1].body).toBe('newer than this build');
  });
});

describe('shipped CHANGELOG.md', () => {
  it('is bundled and every X.Y.Z section passes the release-notes lint', () => {
    const notes = bundledNotes();
    expect(notes.size).toBeGreaterThan(40);
    for (const [version, body] of notes) {
      expect({ version, errors: lintReleaseNotes(body).errors }).toEqual({ version, errors: [] });
    }
  });

  it('looks up a version', () => {
    expect(bundledNotesFor('1.14.20')).toMatch(/^Notifications got a full redesign/);
    expect(bundledNotesFor('0.0.0')).toBeNull();
    expect(bundledNotesFor(null)).toBeNull();
  });
});
