import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { invalidateLightweightIssue } from './issue-lightweight-cache';

const BASE = 'https://jira.example.com';

function seed() {
  const qc = new QueryClient();
  // AIO pages key defects by numeric Jira id (jiraDefectIDs), not issue key.
  qc.setQueryData(['jira', BASE, 'issue-lightweight', '186227'], { id: '186227', key: 'PROJ-1' });
  qc.setQueryData(['jira', BASE, 'issue-lightweight', 'PROJ-1'], { id: '186227', key: 'PROJ-1' });
  qc.setQueryData(['jira', BASE, 'issue-lightweight', '186228'], { id: '186228', key: 'PROJ-2' });
  return qc;
}

const isStale = (qc: QueryClient, idOrKey: string) =>
  qc.getQueryState(['jira', BASE, 'issue-lightweight', idOrKey])?.isInvalidated;

describe('invalidateLightweightIssue', () => {
  it('invalidates entries keyed by numeric id or by key for the edited issue only', () => {
    const qc = seed();
    invalidateLightweightIssue(qc, BASE, 'PROJ-1');
    expect(isStale(qc, '186227')).toBe(true);
    expect(isStale(qc, 'PROJ-1')).toBe(true);
    expect(isStale(qc, '186228')).toBe(false);
  });
});
