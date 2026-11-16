/**
 * Corpus equivalence harness (SAFE-02, D-04).
 *
 * This phase ships the identity round-trip plus mutation self-tests proving the
 * gate bites. Phase 97 adds `checkCorpus(WIKI_CORPUS, (s) => emit(parse(s)), MAPS)`
 * here. Mutation tests assert that failures are REPORTED, so the suite stays
 * green under pre-commit.
 */
import { describe, expect, it } from 'vitest';
import { HARNESS_ATTACHMENTS, HARNESS_USERS, WIKI_CORPUS } from './corpus.fixtures';
import { checkCorpus, formatCorpusFailures } from './equivalence';
import { JIRA_EMOTICON_MAP } from './preprocess';

const MAPS = { attachments: HARNESS_ATTACHMENTS, users: HARNESS_USERS };

const wikiOf = (path: string): string => WIKI_CORPUS.find((f) => f.path === path)?.wiki ?? '';

describe('corpus equivalence harness', () => {
  it('corpus is large enough', () => {
    expect(WIKI_CORPUS.length).toBeGreaterThanOrEqual(37);
  });

  it('identity round-trip is equivalent over the whole corpus', () => {
    const failures = checkCorpus(WIKI_CORPUS, (s) => s, MAPS);
    expect(failures, formatCorpusFailures(failures)).toEqual([]);
  });
});

describe('mutation self-tests (the gate bites)', () => {
  it('target guard: mutation targets contain their construct', () => {
    expect(wikiOf('emoticons/all-emoticons.wiki')).toContain('(/)');
    expect(wikiOf('emoticons/inline-emoticons.wiki')).toContain('(/)');
    expect(wikiOf('lists/mixed-nesting.wiki')).toMatch(/^[*#]{2,}\s/m);
    expect(wikiOf('lists/nested-bullets.wiki')).toMatch(/^[*#]{2,}\s/m);
    expect(wikiOf('panels/panel-titled.wiki')).toContain('{panel:title=');
  });

  it('emoticon dropped is reported', () => {
    const failures = checkCorpus(WIKI_CORPUS, (s) => s.split('(/)').join('OK'), MAPS);
    expect(failures.map((f) => f.path)).toEqual(
      expect.arrayContaining(['emoticons/all-emoticons.wiki', 'emoticons/inline-emoticons.wiki']),
    );
  });

  it('nesting flattened is reported', () => {
    const failures = checkCorpus(WIKI_CORPUS, (s) => s.replace(/^[*#]{2,}(?=\s)/gm, '*'), MAPS);
    expect(failures.map((f) => f.path)).toEqual(
      expect.arrayContaining(['lists/mixed-nesting.wiki', 'lists/nested-bullets.wiki']),
    );
  });

  it('panel title dropped is reported', () => {
    const failures = checkCorpus(
      WIKI_CORPUS,
      (s) => s.replace(/\{panel:title=[^}]*\}/g, '{panel}'),
      MAPS,
    );
    expect(failures.map((f) => f.path)).toContain('panels/panel-titled.wiki');
  });

  it('report format shows path, diff hunk and emitted text', () => {
    const failures = checkCorpus(WIKI_CORPUS, (s) => s.split('(/)').join('OK'), MAPS);
    const out = formatCorpusFailures(failures);
    expect(out).toContain('emoticons/all-emoticons.wiki');
    expect(out).toContain('@@');
    expect(out).toContain('OK');
    expect(out).toContain('Emitted wiki:');
  });
});

// The CONTEXT example "(/) to emoji spelling" is render-equivalent, so it is
// deliberately a negative control here; the positive mutations above use
// render-visible lossy transforms. Byte-level loss that renders identically
// (line endings, emoticon spelling) is Phase 97 SAFE-03 (byte-identical no-op save).
describe('negative controls (render-equivalent, not flagged)', () => {
  it('CRLF to LF', () => {
    expect(checkCorpus(WIKI_CORPUS, (s) => s.split('\r\n').join('\n'), MAPS)).toEqual([]);
  });

  it('emoji spelling of (/)', () => {
    const emoji = JIRA_EMOTICON_MAP.find(([re]) => re.source.includes('/'))?.[1];
    expect(emoji).toBeDefined();
    const failures = checkCorpus(WIKI_CORPUS, (s) => s.split('(/)').join(emoji ?? ''), MAPS);
    expect(failures, formatCorpusFailures(failures)).toEqual([]);
  });
});
