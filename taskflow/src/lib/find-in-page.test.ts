import { afterEach, describe, expect, it } from 'vitest';
import {
  buildMatchRanges,
  collectRuns,
  findInRuns,
  foldText,
  resolveFindScope,
} from './find-in-page';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('foldText', () => {
  it('folds case and accents', () => {
    expect(foldText('žlutý café').folded).toBe('zluty cafe');
  });
  it('maps decomposed e + combining mark to both original units', () => {
    const f = foldText('café');
    expect(f.folded).toBe('cafe');
    expect(f.starts[3]).toBe(3);
    expect(f.ends[3]).toBe(4);
    const r = findInRuns(['café'], 'cafe');
    expect(r.matches[0]).toEqual({ run: 0, start: 0, end: 4 });
  });
  it('maps expanding chars back to the single original char', () => {
    const f = foldText('Ǆ');
    expect(new Set(f.starts)).toEqual(new Set([0]));
    expect(new Set(f.ends)).toEqual(new Set([1]));
    const i = foldText('İ');
    expect(new Set(i.starts)).toEqual(new Set([0]));
  });
  it('folds a standalone combining mark to empty', () => {
    expect(foldText('́').folded).toBe('');
  });
});

describe('findInRuns', () => {
  it('is case and accent insensitive', () => {
    expect(findInRuns(['Café au lait'], 'CAFE').matches).toEqual([{ run: 0, start: 0, end: 4 }]);
    expect(findInRuns(['Žlutý kůň'], 'zluty').matches).toHaveLength(1);
  });
  it('does not overlap', () => {
    expect(findInRuns(['aaaa'], 'aa').matches).toHaveLength(2);
  });
  it('empty or whitespace query yields nothing', () => {
    expect(findInRuns(['abc'], '').matches).toHaveLength(0);
    expect(findInRuns(['abc'], '   ').matches).toHaveLength(0);
  });
  it('caps at 1000', () => {
    const r = findInRuns(['a'.repeat(1500)], 'a');
    expect(r.matches).toHaveLength(1000);
    expect(r.capped).toBe(true);
  });
  it('treats query literally', () => {
    expect(findInRuns(['abc', 'a.*b'], '.*').matches).toEqual([{ run: 1, start: 1, end: 3 }]);
  });
});

describe('collectRuns', () => {
  it('joins sibling text nodes into one run', () => {
    const p = document.createElement('p');
    p.append(document.createTextNode('3'), document.createTextNode(' items'));
    document.body.append(p);
    const runs = collectRuns(document.body);
    expect(runs).toHaveLength(1);
    expect(runs[0].text).toBe('3 items');
    const { ranges } = buildMatchRanges(runs, '3 items', () => true);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].startContainer).not.toBe(ranges[0].endContainer);
    expect(ranges[0].toString()).toBe('3 items');
  });
  it('keeps whitespace-only text nodes inside a run', () => {
    const p = document.createElement('p');
    p.append(
      document.createTextNode('foo'),
      document.createTextNode(' '),
      document.createTextNode('bar'),
    );
    document.body.append(p);
    const runs = collectRuns(document.body);
    expect(runs.map((r) => r.text)).toEqual(['foo bar']);
    expect(buildMatchRanges(runs, 'foobar', () => true).ranges).toHaveLength(0);
    expect(buildMatchRanges(runs, 'foo bar', () => true).ranges).toHaveLength(1);
  });
  it('matches collapsed whitespace and nbsp against a single space', () => {
    expect(findInRuns(['foo\u00a0 \n bar'], 'foo bar').matches).toEqual([
      { run: 0, start: 0, end: 10 },
    ]);
  });
  it('does not match across element boundaries', () => {
    document.body.innerHTML = '<table><tr><td>Status</td><td>Done</td></tr></table>';
    const runs = collectRuns(document.body);
    expect(buildMatchRanges(runs, 'statusdone', () => true).ranges).toHaveLength(0);
    expect(buildMatchRanges(runs, 'done', () => true).ranges).toHaveLength(1);
  });
  it('prunes excluded subtrees', () => {
    document.body.innerHTML =
      '<script>x</script><style>x</style><textarea>x</textarea><div hidden>x</div>' +
      '<div aria-hidden="true">x</div><div inert>x</div><div data-find-bar>x</div>' +
      '<svg><text>x</text></svg><p>x</p>';
    const runs = collectRuns(document.body);
    expect(runs).toHaveLength(1);
    expect(runs[0].parent.tagName).toBe('P');
  });
  it('drops matches for invisible parents', () => {
    document.body.innerHTML = '<p id="a">foo</p><p id="b">foo</p>';
    const runs = collectRuns(document.body);
    const { ranges } = buildMatchRanges(runs, 'foo', (el) => el.id !== 'a');
    expect(ranges).toHaveLength(1);
  });
});

describe('resolveFindScope', () => {
  it('prefers modal > peek > main', () => {
    document.body.innerHTML =
      '<main data-find-scope="main"></main><div data-find-scope="peek"></div>' +
      '<div data-slot="dialog-content" id="d"></div>';
    expect(resolveFindScope()?.el.id).toBe('d');
    expect(resolveFindScope()?.kind).toBe('modal');
    document.getElementById('d')?.remove();
    expect(resolveFindScope()?.kind).toBe('peek');
    document.querySelector('[data-find-scope="peek"]')?.remove();
    expect(resolveFindScope()?.kind).toBe('main');
  });
  it('ignores plain role=dialog popovers', () => {
    document.body.innerHTML = '<main data-find-scope="main"></main><div role="dialog"></div>';
    expect(resolveFindScope()?.kind).toBe('main');
  });
  it('last dialog wins; closed/inert ignored', () => {
    document.body.innerHTML =
      '<div data-slot="dialog-content" id="a"></div><div data-slot="dialog-content" id="b"></div>' +
      '<div data-closed><div data-slot="dialog-content" id="c"></div></div>' +
      '<div inert><div data-slot="sheet-content" id="e"></div></div>';
    expect(resolveFindScope()?.el.id).toBe('b');
  });
  it('returns null when nothing matches', () => {
    expect(resolveFindScope()).toBeNull();
  });
});
