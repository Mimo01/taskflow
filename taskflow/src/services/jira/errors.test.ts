import { describe, expect, it } from 'vitest';
import { flattenJiraError } from './errors';

describe('flattenJiraError', () => {
  it('joins a populated errorMessages array with a semicolon', () => {
    expect(flattenJiraError({ errorMessages: ['Permission denied'] })).toBe('Permission denied');
    expect(flattenJiraError({ errorMessages: ['a', 'b'] })).toBe('a; b');
  });

  it('uses a bare errorMessages string as-is (defensive non-array)', () => {
    expect(flattenJiraError({ errorMessages: 'a bare string' })).toBe('a bare string');
  });

  it('falls back to the errors object when errorMessages is empty (locked CONTEXT example)', () => {
    expect(
      flattenJiraError({
        errorMessages: [],
        errors: { fixVersions: "Field 'fixVersions' cannot be set" },
      }),
    ).toBe("fixVersions: Field 'fixVersions' cannot be set");
  });

  it('flattens a multi-field errors object joined with semicolons', () => {
    expect(flattenJiraError({ errors: { a: 'x', b: 'y' } })).toBe('a: x; b: y');
  });

  it('joins an array field detail with a comma', () => {
    expect(flattenJiraError({ errors: { fixVersions: ['too long', 'archived'] } })).toBe(
      'fixVersions: too long, archived',
    );
  });

  it('serialises a nested-object field detail instead of stringifying it', () => {
    const result = flattenJiraError({ errors: { f: { nested: { deeper: 1 } } } });
    expect(result).toContain('{"nested":{"deeper":1}}');
    expect(result).not.toMatch(/\[object Object\]/);
  });

  it('prefers errorMessages over errors when both are present', () => {
    expect(flattenJiraError({ errorMessages: ['primary'], errors: { f: 'secondary' } })).toBe(
      'primary',
    );
  });

  it('returns undefined (not an empty string) for an empty-flattening errorMessages/errors', () => {
    expect(flattenJiraError({ errorMessages: [] })).toBeUndefined();
    expect(flattenJiraError({ errorMessages: {} })).toBeUndefined();
    expect(flattenJiraError({ errorMessages: '' })).toBeUndefined();
    expect(flattenJiraError({ errors: {} })).toBeUndefined();
    expect(flattenJiraError({ errorMessages: [], errors: {} })).toBeUndefined();
  });

  it('returns undefined when both keys are missing', () => {
    expect(flattenJiraError({ status: 400 })).toBeUndefined();
  });

  it('returns undefined for null, undefined, a bare string, and a number', () => {
    expect(flattenJiraError(null)).toBeUndefined();
    expect(flattenJiraError(undefined)).toBeUndefined();
    expect(flattenJiraError('a string')).toBeUndefined();
    expect(flattenJiraError(42)).toBeUndefined();
  });

  it('never returns a string containing [object Object]', () => {
    const cases: unknown[] = [
      { errorMessages: ['Permission denied'] },
      { errorMessages: ['a', 'b'] },
      { errorMessages: 'a bare string' },
      { errorMessages: [], errors: { fixVersions: "Field 'fixVersions' cannot be set" } },
      { errors: { a: 'x', b: 'y' } },
      { errors: { fixVersions: ['too long', 'archived'] } },
      { errors: { f: { nested: { deeper: 1 } } } },
      { errorMessages: ['primary'], errors: { f: 'secondary' } },
    ];
    for (const c of cases) {
      expect(flattenJiraError(c)).not.toMatch(/\[object Object\]/);
    }
  });
});
