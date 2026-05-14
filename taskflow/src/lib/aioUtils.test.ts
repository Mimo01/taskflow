import { describe, expect, it } from 'vitest';
import { normalizeStatus, normalizeStatusLabel } from './aioUtils';

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
