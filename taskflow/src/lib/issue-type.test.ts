import { describe, expect, it } from 'vitest';
import { isEpicTypeName } from './issue-type';

describe('isEpicTypeName', () => {
  it('matches Epic case-insensitively', () => {
    expect(isEpicTypeName('Epic')).toBe(true);
    expect(isEpicTypeName('epic')).toBe(true);
  });
  it('rejects other types and empty values', () => {
    expect(isEpicTypeName('Story')).toBe(false);
    expect(isEpicTypeName('Task')).toBe(false);
    expect(isEpicTypeName('')).toBe(false);
    expect(isEpicTypeName(undefined)).toBe(false);
  });
});
