// PM-03: Release linker — date matching between Jira fix versions and GitLab milestones/tags
import { describe, it, expect } from 'vitest';
import { matchGitLabToFixVersion } from './releaseLinker';

describe('matchGitLabToFixVersion — date matching', () => {
  it('returns exact for same date strings', () => {
    const result = matchGitLabToFixVersion('2026-03-15', {
      date: '2026-03-15',
      name: 'sprint-15',
      url: 'https://gitlab.example.com/milestone/1',
    });
    expect(result.type).toBe('exact');
    expect(result.candidateName).toBe('sprint-15');
    expect(result.candidateUrl).toBe('https://gitlab.example.com/milestone/1');
  });

  it('returns fuzzy for date exactly 1 day apart', () => {
    const result = matchGitLabToFixVersion('2026-03-15', {
      date: '2026-03-16',
      name: 'sprint-15',
      url: 'https://gitlab.example.com/milestone/1',
    });
    expect(result.type).toBe('fuzzy');
  });

  it('returns none for date 2 days apart', () => {
    const result = matchGitLabToFixVersion('2026-03-15', {
      date: '2026-03-17',
      name: 'sprint-15',
      url: 'https://gitlab.example.com/milestone/1',
    });
    expect(result.type).toBe('none');
  });

  it('returns none when fixVersionDate is null or undefined', () => {
    const result = matchGitLabToFixVersion(undefined, {
      date: '2026-03-15',
      name: 'sprint-15',
      url: 'https://gitlab.example.com/milestone/1',
    });
    expect(result.type).toBe('none');
  });

  it('returns none when candidate date is null', () => {
    const result = matchGitLabToFixVersion('2026-03-15', {
      date: null,
      name: 'sprint-15',
      url: 'https://gitlab.example.com/milestone/1',
    });
    expect(result.type).toBe('none');
  });

  it('handles UTC+14 timezone edge case: date-only strings do not drift to adjacent day', () => {
    // Both are "2026-03-15" date strings, parsed as UTC midnight
    // Even if local timezone is UTC+14 (Kiribati), the comparison must yield exact
    const result = matchGitLabToFixVersion('2026-03-15', {
      date: '2026-03-15',
      name: 'v1.0',
      url: 'https://gitlab.example.com/milestone/2',
    });
    expect(result.type).toBe('exact');
  });

  it('handles ISO 8601 tag date by flooring to UTC midnight', () => {
    // Tag commit.created_at in UTC+13 that maps to 2026-03-15 UTC
    // "2026-03-15T23:59:59Z" should floor to 2026-03-15 UTC (same day)
    const result = matchGitLabToFixVersion('2026-03-15', {
      date: '2026-03-15T23:59:59Z',
      name: 'v1.0.0',
      url: 'https://gitlab.example.com/tag/v1.0.0',
    });
    expect(result.type).toBe('exact');
  });

  it('returns fuzzy for 1-day diff when candidate is ISO 8601 with timezone', () => {
    // "2026-03-16T00:00:00Z" → floors to 2026-03-16 UTC → 1 day from 2026-03-15
    const result = matchGitLabToFixVersion('2026-03-15', {
      date: '2026-03-16T00:00:00Z',
      name: 'v1.1.0',
      url: 'https://gitlab.example.com/tag/v1.1.0',
    });
    expect(result.type).toBe('fuzzy');
  });

  it('returns none for date more than 1 day apart even if names match', () => {
    // Name-based matching is not supported — only date matching
    const result = matchGitLabToFixVersion('2026-03-15', {
      date: '2026-03-20',
      name: 'v2.1.0',
      url: 'https://gitlab.example.com/milestone/5',
    });
    expect(result.type).toBe('none');
  });
});
