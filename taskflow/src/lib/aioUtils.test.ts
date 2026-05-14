import { describe, expect, it } from 'vitest';
import { AIO_STATUS_MAP, normalizeStatus, normalizeStatusById, normalizeStatusLabel } from './aioUtils';

describe('normalizeStatus', () => {
  it("returns 'pass' for 'PASS'", () => {
    expect(normalizeStatus('PASS')).toBe('pass');
  });

  it("returns 'pass' for 'pass' (case-insensitive)", () => {
    expect(normalizeStatus('pass')).toBe('pass');
  });

  it("returns 'fail' for 'FAIL'", () => {
    expect(normalizeStatus('FAIL')).toBe('fail');
  });

  it("returns 'blocked' for 'BLOCKED'", () => {
    expect(normalizeStatus('BLOCKED')).toBe('blocked');
  });

  it("returns 'notRun' for 'NOT_EXECUTED'", () => {
    expect(normalizeStatus('NOT_EXECUTED')).toBe('notRun');
  });

  it("returns 'notRun' for undefined", () => {
    expect(normalizeStatus(undefined)).toBe('notRun');
  });

  it("returns 'notRun' for empty string", () => {
    expect(normalizeStatus('')).toBe('notRun');
  });

  it("returns 'notRun' for unknown status 'CUSTOM_STATUS'", () => {
    expect(normalizeStatus('CUSTOM_STATUS')).toBe('notRun');
  });
});

describe('normalizeStatusLabel', () => {
  it("returns 'Pass' for 'PASS'", () => {
    expect(normalizeStatusLabel('PASS')).toBe('Pass');
  });

  it("returns 'Not Run' for 'NOT_EXECUTED'", () => {
    expect(normalizeStatusLabel('NOT_EXECUTED')).toBe('Not Run');
  });

  it("returns original raw for unknown non-empty input (e.g. 'CUSTOM' → 'CUSTOM')", () => {
    expect(normalizeStatusLabel('CUSTOM')).toBe('CUSTOM');
  });

  it("returns 'Not Run' for undefined", () => {
    expect(normalizeStatusLabel(undefined)).toBe('Not Run');
  });
});

// RED stubs — Phase 57 Wave 0. These fail until Plan 02 adds AIO_STATUS_MAP + normalizeStatusById.

describe('AIO_STATUS_MAP', () => {
  it('maps status ID 901 to "pass"', () => {
    expect(AIO_STATUS_MAP[901]).toBe('pass');
  });

  it('maps status ID 51 to "fail"', () => {
    expect(AIO_STATUS_MAP[51]).toBe('fail');
  });

  it('maps status ID 55 to "blocked"', () => {
    expect(AIO_STATUS_MAP[55]).toBe('blocked');
  });

  it('maps status ID 53 to "notRun"', () => {
    expect(AIO_STATUS_MAP[53]).toBe('notRun');
  });

  it('maps status ID 54 to "inProgress"', () => {
    expect(AIO_STATUS_MAP[54]).toBe('inProgress');
  });
});

describe('normalizeStatusById', () => {
  it('returns "pass" for ID 901', () => {
    expect(normalizeStatusById(901)).toBe('pass');
  });

  it('returns "fail" for ID 51', () => {
    expect(normalizeStatusById(51)).toBe('fail');
  });

  it('returns "blocked" for ID 55', () => {
    expect(normalizeStatusById(55)).toBe('blocked');
  });

  it('returns "notRun" for ID 53', () => {
    expect(normalizeStatusById(53)).toBe('notRun');
  });

  it('returns "inProgress" for ID 54', () => {
    expect(normalizeStatusById(54)).toBe('inProgress');
  });

  it('returns "notRun" for unknown ID (e.g. 0)', () => {
    expect(normalizeStatusById(0)).toBe('notRun');
  });

  it('returns "notRun" for unknown ID (e.g. 999)', () => {
    expect(normalizeStatusById(999)).toBe('notRun');
  });
});
