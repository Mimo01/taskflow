/**
 * Unit tests for standup-date.ts
 *
 * Covers STAND-02: weekend + Tempo holiday skip in resolveYesterdayDate()
 * Covers STAND-05: Jira key extraction from commit messages and branch names
 */

import { describe, expect, it, vi } from 'vitest';
import {
  extractJiraKeyFromBranch,
  extractJiraKeyFromMessage,
  getScheduleLookbackRange,
  resolveYesterdayDate,
} from './standup-date';

// ─── resolveYesterdayDate ──────────────────────────────────────────────────────

describe('resolveYesterdayDate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('STAND-02: Monday resolves to Friday (skips weekend)', () => {
    // 2026-05-25 is a Monday
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-25T10:00:00Z'));
    expect(resolveYesterdayDate()).toBe('2026-05-22');
  });

  it('STAND-02: Tuesday resolves to Monday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-26T10:00:00Z'));
    expect(resolveYesterdayDate()).toBe('2026-05-25');
  });

  it('STAND-02: Sunday resolves to Friday (skips Sunday and Saturday)', () => {
    // 2026-05-24 is a Sunday
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-24T10:00:00Z'));
    expect(resolveYesterdayDate()).toBe('2026-05-22');
  });

  it('STAND-02: Saturday resolves to Friday', () => {
    // 2026-05-23 is a Saturday
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-23T10:00:00Z'));
    expect(resolveYesterdayDate()).toBe('2026-05-22');
  });

  it('STAND-02: skips a Tempo HOLIDAY when scheduleMap is provided', () => {
    // Today is Tuesday 2026-05-26; Monday 2026-05-25 is a holiday
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-26T10:00:00Z'));
    const scheduleMap = new Map<string, 'WORKING_DAY' | 'NON_WORKING_DAY' | 'HOLIDAY'>([
      ['2026-05-25', 'HOLIDAY'],
      ['2026-05-24', 'NON_WORKING_DAY'], // Sunday (already skipped by weekend rule)
      ['2026-05-23', 'NON_WORKING_DAY'], // Saturday (already skipped by weekend rule)
      ['2026-05-22', 'WORKING_DAY'],
    ]);
    // Should skip Monday (holiday) and return Friday
    expect(resolveYesterdayDate(scheduleMap)).toBe('2026-05-22');
  });

  it('STAND-02: WORKING_DAY entries do not affect weekend-skip behavior', () => {
    // Monday should still return Friday even if Monday is "WORKING_DAY"
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-25T10:00:00Z'));
    const scheduleMap = new Map<string, 'WORKING_DAY' | 'NON_WORKING_DAY' | 'HOLIDAY'>([
      ['2026-05-22', 'WORKING_DAY'],
      ['2026-05-23', 'NON_WORKING_DAY'],
      ['2026-05-24', 'NON_WORKING_DAY'],
    ]);
    expect(resolveYesterdayDate(scheduleMap)).toBe('2026-05-22');
  });

  it('STAND-02: returns a YYYY-MM-DD string in all paths', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-26T10:00:00Z'));
    const result = resolveYesterdayDate();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('STAND-02: a schedule map with only WORKING_DAY entries behaves like no-arg call', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-26T10:00:00Z')); // Tuesday
    const scheduleMap = new Map<string, 'WORKING_DAY' | 'NON_WORKING_DAY' | 'HOLIDAY'>([
      ['2026-05-25', 'WORKING_DAY'],
    ]);
    expect(resolveYesterdayDate(scheduleMap)).toBe('2026-05-25');
    expect(resolveYesterdayDate()).toBe('2026-05-25');
  });
});

// ─── getScheduleLookbackRange ──────────────────────────────────────────────────

describe('getScheduleLookbackRange', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns { from, to } with to = today and from = 14 days before', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-26T10:00:00Z'));
    const { from, to } = getScheduleLookbackRange();
    expect(to).toBe('2026-05-26');
    expect(from).toBe('2026-05-12');
  });

  it('returns YYYY-MM-DD strings', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'));
    const { from, to } = getScheduleLookbackRange();
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ─── extractJiraKeyFromMessage ─────────────────────────────────────────────────

describe('extractJiraKeyFromMessage', () => {
  it('STAND-05: extracts key from bracketed format', () => {
    expect(extractJiraKeyFromMessage('fix [PROJ-123] bug')).toBe('PROJ-123');
  });

  it('STAND-05: extracts first key when multiple keys are present', () => {
    expect(extractJiraKeyFromMessage('PROJ-123 relates to PROJ-456')).toBe('PROJ-123');
  });

  it('STAND-05: returns null when no key is present', () => {
    expect(extractJiraKeyFromMessage('no key here')).toBeNull();
  });

  it('STAND-05: does not match lowercase project prefixes', () => {
    expect(extractJiraKeyFromMessage('abc-1 fix something')).toBeNull();
  });

  it('STAND-05: matches multi-segment prefixes like AB12-9', () => {
    expect(extractJiraKeyFromMessage('AB12-9 is referenced here')).toBe('AB12-9');
  });

  it('STAND-05: repeated calls return consistent results (no lastIndex drift)', () => {
    expect(extractJiraKeyFromMessage('PROJ-123 fix')).toBe('PROJ-123');
    expect(extractJiraKeyFromMessage('PROJ-123 fix')).toBe('PROJ-123');
    expect(extractJiraKeyFromMessage('PROJ-123 fix')).toBe('PROJ-123');
  });

  it('STAND-05: returns null for empty string', () => {
    expect(extractJiraKeyFromMessage('')).toBeNull();
  });

  it('STAND-05: handles commit message with key at start', () => {
    expect(extractJiraKeyFromMessage('ESHOP-456: implement cart')).toBe('ESHOP-456');
  });
});

// ─── extractJiraKeyFromBranch ──────────────────────────────────────────────────

describe('extractJiraKeyFromBranch', () => {
  it('STAND-05: extracts key from feature branch format', () => {
    expect(extractJiraKeyFromBranch('feature/PROJ-456-thing')).toBe('PROJ-456');
  });

  it('STAND-05: returns null for main branch', () => {
    expect(extractJiraKeyFromBranch('main')).toBeNull();
  });

  it('STAND-05: returns null for develop branch', () => {
    expect(extractJiraKeyFromBranch('develop')).toBeNull();
  });

  it('STAND-05: does not match lowercase keys', () => {
    expect(extractJiraKeyFromBranch('feature/proj-456-thing')).toBeNull();
  });

  it('STAND-05: extracts key from branch without leading path', () => {
    expect(extractJiraKeyFromBranch('ESHOP-123-cart-fix')).toBe('ESHOP-123');
  });

  it('STAND-05: repeated calls return consistent results (no lastIndex drift)', () => {
    expect(extractJiraKeyFromBranch('feature/ESHOP-789-fix')).toBe('ESHOP-789');
    expect(extractJiraKeyFromBranch('feature/ESHOP-789-fix')).toBe('ESHOP-789');
  });
});
