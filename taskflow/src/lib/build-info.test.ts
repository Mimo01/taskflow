import { describe, expect, it } from 'vitest';
import { buildInfo } from './build-info';

describe('build-info', () => {
  it('exports version as a non-empty string', () => {
    expect(typeof buildInfo.version).toBe('string');
    expect(buildInfo.version.length).toBeGreaterThan(0);
  });

  it('version does not start with v prefix', () => {
    expect(buildInfo.version.startsWith('v')).toBe(false);
  });

  it('exports commitSha as a non-empty string', () => {
    expect(typeof buildInfo.commitSha).toBe('string');
    expect(buildInfo.commitSha.length).toBeGreaterThan(0);
  });

  it('exports buildDate as a non-empty string', () => {
    expect(typeof buildInfo.buildDate).toBe('string');
    expect(buildInfo.buildDate.length).toBeGreaterThan(0);
  });
});
