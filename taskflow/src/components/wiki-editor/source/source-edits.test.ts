import { describe, expect, it } from 'vitest';
import { applyInsert } from './source-edits';

describe('applyInsert', () => {
  it('inserts a pair at the caret', () => {
    expect(applyInsert('ab', 1, 1, '*', '*')).toEqual({ value: 'a**b', selStart: 2, selEnd: 2 });
  });
  it('wraps a selection and keeps it selected', () => {
    expect(applyInsert('abc', 0, 3, '*', '*')).toEqual({ value: '*abc*', selStart: 1, selEnd: 4 });
  });
  it('block snippets start on their own line', () => {
    expect(applyInsert('ab', 1, 1, '{code}\n', '\n{code}').value).toBe('a\n{code}\n\n{code}b');
    expect(applyInsert('a\nb', 2, 2, '{code}\n', '\n{code}').value).toBe('a\n{code}\n\n{code}b');
  });
});
