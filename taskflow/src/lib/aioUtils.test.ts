import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/aio/cycles', () => ({
  fetchAioProjectConfig: vi.fn(),
}));

import { fetchAioProjectConfig } from '@/services/aio/cycles';
import {
  initializeAioStatusMap,
  normalizeStatus,
  normalizeStatusById,
  normalizeStatusLabel,
} from './aioUtils';

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

describe('initializeAioStatusMap + normalizeStatusById', () => {
  it('populates the runtime map from config response', async () => {
    vi.mocked(fetchAioProjectConfig).mockResolvedValue([
      { ID: 53, statusType: 'PASSED', name: 'Pass' },
      { ID: 54, statusType: 'FAILED', name: 'Fail' },
      { ID: 55, statusType: 'BLOCKED', name: 'Blocked' },
      { ID: 51, statusType: 'NOT_RUN', name: 'Not Run' },
      { ID: 52, statusType: 'IN_PROGRESS', name: 'In Progress' },
    ]);
    await initializeAioStatusMap('https://jira.example.com', 'token', 10000);
    expect(normalizeStatusById(53)).toBe('pass');
    expect(normalizeStatusById(54)).toBe('fail');
    expect(normalizeStatusById(55)).toBe('blocked');
    expect(normalizeStatusById(51)).toBe('notRun');
    expect(normalizeStatusById(52)).toBe('inProgress');
  });

  it('falls back to "notRun" for unknown ID after init', async () => {
    vi.mocked(fetchAioProjectConfig).mockResolvedValue([
      { ID: 53, statusType: 'PASSED', name: 'Pass' },
    ]);
    await initializeAioStatusMap('https://jira.example.com', 'token', 10000);
    expect(normalizeStatusById(999)).toBe('notRun');
  });

  it('falls back to empty map (all notRun) when fetchAioProjectConfig throws', async () => {
    vi.mocked(fetchAioProjectConfig).mockRejectedValue(new Error('network'));
    await initializeAioStatusMap('https://jira.example.com', 'token', 10000);
    expect(normalizeStatusById(53)).toBe('notRun');
  });
});
