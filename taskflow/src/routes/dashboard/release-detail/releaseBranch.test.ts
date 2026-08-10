import { describe, expect, it } from 'vitest';
import type { BranchState } from './releaseBranch';
import {
  deriveReleaseBranchName,
  extractVersionFromMilestoneTitle,
  isValidGitRefName,
  findReleaseTag,
  resolveBranchState,
} from './releaseBranch';

describe('extractVersionFromMilestoneTitle', () => {
  it('extracts the version component from a real-format title', () => {
    expect(extractVersionFromMilestoneTitle('33.5.0 (21.07.2026)')).toBe('33.5.0');
  });

  it('extracts a bare version with no date suffix', () => {
    expect(extractVersionFromMilestoneTitle('33.5.0')).toBe('33.5.0');
  });

  it('trims leading/trailing whitespace before matching', () => {
    expect(extractVersionFromMilestoneTitle('  1.0.0 (01.01.2026)  ')).toBe('1.0.0');
  });

  it('returns null when the version token is prefixed (e.g. "v33.5.0")', () => {
    expect(extractVersionFromMilestoneTitle('v33.5.0 (21.07.2026)')).toBeNull();
  });

  it('returns null for a title with no version token', () => {
    expect(extractVersionFromMilestoneTitle('Sprint 42')).toBeNull();
  });

  it('returns null for a two-part version (not X.Y.Z)', () => {
    expect(extractVersionFromMilestoneTitle('33.5 (21.07.2026)')).toBeNull();
  });

  it('returns null for null, undefined, and empty string', () => {
    expect(extractVersionFromMilestoneTitle(null)).toBeNull();
    expect(extractVersionFromMilestoneTitle(undefined)).toBeNull();
    expect(extractVersionFromMilestoneTitle('')).toBeNull();
  });
});

describe('deriveReleaseBranchName', () => {
  it('derives "release/33.5.0" from a real-format title (D-09)', () => {
    expect(deriveReleaseBranchName('33.5.0 (21.07.2026)')).toBe('release/33.5.0');
  });

  it('derives from a bare version with no date suffix', () => {
    expect(deriveReleaseBranchName('33.5.0')).toBe('release/33.5.0');
  });

  it('trims whitespace before deriving', () => {
    expect(deriveReleaseBranchName('  1.0.0 (01.01.2026)  ')).toBe('release/1.0.0');
  });

  it('returns null for a prefixed version token', () => {
    expect(deriveReleaseBranchName('v33.5.0 (21.07.2026)')).toBeNull();
  });

  it('returns null for a title with no version token (never a sanitized guess, D-11)', () => {
    expect(deriveReleaseBranchName('Sprint 42')).toBeNull();
  });

  it('returns null for a two-part version', () => {
    expect(deriveReleaseBranchName('33.5 (21.07.2026)')).toBeNull();
  });

  it('returns null for null, undefined, and empty string', () => {
    expect(deriveReleaseBranchName(null)).toBeNull();
    expect(deriveReleaseBranchName(undefined)).toBeNull();
    expect(deriveReleaseBranchName('')).toBeNull();
  });
});

describe('isValidGitRefName', () => {
  it('accepts a well-formed release branch name', () => {
    expect(isValidGitRefName('release/33.5.0')).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(isValidGitRefName('')).toBe(false);
  });

  it('rejects a name longer than 255 characters', () => {
    expect(isValidGitRefName(`release/${'x'.repeat(256)}`)).toBe(false);
  });

  it('rejects a name containing a space', () => {
    expect(isValidGitRefName('release/33.5.0 (21.07.2026)')).toBe(false);
  });

  it('rejects a name containing ".."', () => {
    expect(isValidGitRefName('release/33..5.0')).toBe(false);
  });

  it('rejects a trailing .lock suffix', () => {
    expect(isValidGitRefName('release/33.5.0.lock')).toBe(false);
  });

  it('rejects a trailing "."', () => {
    expect(isValidGitRefName('release/33.5.0.')).toBe(false);
  });

  it('rejects a leading "/"', () => {
    expect(isValidGitRefName('/release/33.5.0')).toBe(false);
  });

  it('rejects a trailing "/"', () => {
    expect(isValidGitRefName('release/33.5.0/')).toBe(false);
  });

  it('rejects a double slash', () => {
    expect(isValidGitRefName('release//33.5.0')).toBe(false);
  });

  it('rejects a name containing "@{"', () => {
    expect(isValidGitRefName('release/@{33.5.0')).toBe(false);
  });

  it('rejects the literal name "@"', () => {
    expect(isValidGitRefName('@')).toBe(false);
  });

  it('rejects a name containing an ASCII control character', () => {
    expect(isValidGitRefName('release/33.5.0\u0001')).toBe(false); // SOH control char
  });

  it('rejects a name containing a DEL character', () => {
    expect(isValidGitRefName('release/33.5.0\u007F')).toBe(false); // DEL
  });

  it('rejects each disallowed special character', () => {
    expect(isValidGitRefName('release/33.5.0~1')).toBe(false);
    expect(isValidGitRefName('release/33.5.0^')).toBe(false);
    expect(isValidGitRefName('release/33.5.0:x')).toBe(false);
    expect(isValidGitRefName('release/33.5.0?')).toBe(false);
    expect(isValidGitRefName('release/33.5.0*')).toBe(false);
    expect(isValidGitRefName('release/33.5.0[x')).toBe(false);
    expect(isValidGitRefName('release/33.5.0\\x')).toBe(false);
  });

  it('rejects a path segment starting with "."', () => {
    expect(isValidGitRefName('release/.hidden')).toBe(false);
  });
});

describe('resolveBranchState', () => {
  it('returns blocked-no-milestone when no milestone is matched (D-10)', () => {
    const result: BranchState = resolveBranchState({
      hasMatchedMilestone: false,
      milestoneTitle: null,
      branchExists: undefined,
    });
    expect(result).toEqual({ kind: 'blocked-no-milestone' });
  });

  it('returns unresolvable when the matched milestone title has no version token (D-11)', () => {
    const result: BranchState = resolveBranchState({
      hasMatchedMilestone: true,
      milestoneTitle: 'Sprint 42',
      branchExists: undefined,
    });
    expect(result).toEqual({ kind: 'unresolvable' });
  });

  it('returns loading when the derived name is valid but branchExists is undefined', () => {
    const result: BranchState = resolveBranchState({
      hasMatchedMilestone: true,
      milestoneTitle: '33.5.0 (21.07.2026)',
      branchExists: undefined,
    });
    expect(result).toEqual({ kind: 'loading', branchName: 'release/33.5.0' });
  });

  it('returns exists when branchExists is true', () => {
    const result: BranchState = resolveBranchState({
      hasMatchedMilestone: true,
      milestoneTitle: '33.5.0 (21.07.2026)',
      branchExists: true,
    });
    expect(result).toEqual({ kind: 'exists', branchName: 'release/33.5.0' });
  });

  it('returns missing when branchExists is false', () => {
    const result: BranchState = resolveBranchState({
      hasMatchedMilestone: true,
      milestoneTitle: '33.5.0 (21.07.2026)',
      branchExists: false,
    });
    expect(result).toEqual({ kind: 'missing', branchName: 'release/33.5.0' });
  });

  it('returns check-failed when the branch-existence query errored (CR-03)', () => {
    const result: BranchState = resolveBranchState({
      hasMatchedMilestone: true,
      milestoneTitle: '33.5.0 (21.07.2026)',
      branchExists: undefined,
      branchCheckFailed: true,
    });
    expect(result).toEqual({ kind: 'check-failed', branchName: 'release/33.5.0' });
  });

  it('returns loading when branchCheckFailed is false', () => {
    const result: BranchState = resolveBranchState({
      hasMatchedMilestone: true,
      milestoneTitle: '33.5.0 (21.07.2026)',
      branchExists: undefined,
      branchCheckFailed: false,
    });
    expect(result).toEqual({ kind: 'loading', branchName: 'release/33.5.0' });
  });

  it('returns loading when branchCheckFailed is omitted (optional, defaults to not-failed)', () => {
    const result: BranchState = resolveBranchState({
      hasMatchedMilestone: true,
      milestoneTitle: '33.5.0 (21.07.2026)',
      branchExists: undefined,
    });
    expect(result).toEqual({ kind: 'loading', branchName: 'release/33.5.0' });
  });

  it('returns blocked-no-milestone even when branchCheckFailed is true (D-10 outranks CR-03)', () => {
    const result: BranchState = resolveBranchState({
      hasMatchedMilestone: false,
      milestoneTitle: null,
      branchExists: undefined,
      branchCheckFailed: true,
    });
    expect(result).toEqual({ kind: 'blocked-no-milestone' });
  });

  it('returns unresolvable even when branchCheckFailed is true (D-11 outranks CR-03)', () => {
    const result: BranchState = resolveBranchState({
      hasMatchedMilestone: true,
      milestoneTitle: 'Sprint 42',
      branchExists: undefined,
      branchCheckFailed: true,
    });
    expect(result).toEqual({ kind: 'unresolvable' });
  });

  it('returns check-failed even when branchExists is true (error wins over a stale successful value)', () => {
    const result: BranchState = resolveBranchState({
      hasMatchedMilestone: true,
      milestoneTitle: '33.5.0 (21.07.2026)',
      branchExists: true,
      branchCheckFailed: true,
    });
    expect(result).toEqual({ kind: 'check-failed', branchName: 'release/33.5.0' });
  });
});

describe('findReleaseTag', () => {
  it('matches a v-prefixed tag for the version', () => {
    expect(findReleaseTag(['v33.5.0', 'v33.6.0'], '33.6.0')).toBe('v33.6.0');
  });

  it('matches an unprefixed tag', () => {
    expect(findReleaseTag(['33.6.0'], '33.6.0')).toBe('33.6.0');
  });

  it('returns null when the version has no tag — tags are an incomplete record', () => {
    expect(findReleaseTag(['v33.4.0', 'v33.6.0'], '33.5.0')).toBeNull();
  });

  it('does not match a tag that merely contains the version', () => {
    expect(findReleaseTag(['v8.33.5.0', 'v33.5.0-rc1'], '33.5.0')).toBeNull();
  });

  it('returns null for a null version', () => {
    expect(findReleaseTag(['v33.6.0'], null)).toBeNull();
  });
});

describe('resolveBranchState — released versions', () => {
  const base = {
    hasMatchedMilestone: true,
    milestoneTitle: '33.6.0 (04.08.2026)',
  };

  it('reports released (not missing) when a released version has no branch', () => {
    const state = resolveBranchState({
      ...base,
      branchExists: false,
      versionReleased: true,
      releaseTagName: 'v33.6.0',
    });
    expect(state).toEqual({
      kind: 'released',
      branchName: 'release/33.6.0',
      tagName: 'v33.6.0',
    });
  });

  it('reports released with a null tag when no tag was found', () => {
    const state = resolveBranchState({ ...base, branchExists: false, versionReleased: true });
    expect(state).toEqual({ kind: 'released', branchName: 'release/33.6.0', tagName: null });
  });

  it('still reports exists when a released version somehow retains its branch', () => {
    const state = resolveBranchState({ ...base, branchExists: true, versionReleased: true });
    expect(state.kind).toBe('exists');
  });

  it('keeps missing for an unreleased version with no branch', () => {
    const state = resolveBranchState({ ...base, branchExists: false, versionReleased: false });
    expect(state.kind).toBe('missing');
  });

  it('does not downgrade an in-flight check to released', () => {
    const state = resolveBranchState({
      ...base,
      branchExists: undefined,
      versionReleased: true,
    });
    expect(state.kind).toBe('loading');
  });

  it('does not downgrade a failed check to released — absence is unproven', () => {
    const state = resolveBranchState({
      ...base,
      branchExists: undefined,
      branchCheckFailed: true,
      versionReleased: true,
    });
    expect(state.kind).toBe('check-failed');
  });
});
