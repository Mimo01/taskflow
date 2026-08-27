import { describe, expect, it } from 'vitest';
import type { GitLabMR } from '@/services/gitlab';
import {
  buildMrHealthByKey,
  MR_HEALTH_ENRICHMENT_CAP,
  resolveMrHealth,
  selectMrsForHealth,
} from './my-tasks-mr-health';

function makeMr(overrides: Partial<GitLabMR> & { title: string }): GitLabMR {
  return {
    id: 1,
    iid: 1,
    project_id: 1,
    source_branch: 'feature/x',
    target_branch: 'main',
    state: 'opened',
    draft: false,
    author: { id: 1, name: 'A', username: 'a', avatar_url: '' },
    reviewers: [],
    updated_at: '2026-01-01T00:00:00Z',
    web_url: 'https://gitlab.example.com/mr/1',
    labels: [],
    milestone: null,
    ...overrides,
  };
}

describe('MR_HEALTH_ENRICHMENT_CAP', () => {
  it('is 20', () => {
    expect(MR_HEALTH_ENRICHMENT_CAP).toBe(20);
  });
});

describe('selectMrsForHealth', () => {
  it('drops an MR with no matching key', () => {
    const mrs = [makeMr({ title: 'Unrelated change', source_branch: 'chore/cleanup' })];
    const result = selectMrsForHealth(mrs, new Set(['PROJ-1']));
    expect(result).toEqual([]);
  });

  it('returns the 20 most recently updated of 25 matching MRs', () => {
    const mrs: GitLabMR[] = Array.from({ length: 25 }, (_, i) =>
      makeMr({
        iid: i,
        title: `PROJ-1 fix ${i}`,
        updated_at: new Date(2026, 0, i + 1).toISOString(),
      }),
    );
    const result = selectMrsForHealth(mrs, new Set(['PROJ-1']));
    expect(result).toHaveLength(20);
    // Most recently updated (iid 24) first
    expect(result[0].mr.iid).toBe(24);
    expect(result[19].mr.iid).toBe(5);
  });

  it('returns [] with no requests when visibleIssueKeys is empty', () => {
    const mrs = [makeMr({ title: 'PROJ-1 fix' })];
    const result = selectMrsForHealth(mrs, new Set());
    expect(result).toEqual([]);
  });

  it('collects keys from title then branch, deduped', () => {
    const mrs = [makeMr({ title: 'PROJ-1 fix', source_branch: 'feature/PROJ-1/PROJ-2' })];
    const result = selectMrsForHealth(mrs, new Set(['PROJ-1']));
    expect(result).toHaveLength(1);
    expect(result[0].keys).toEqual(['PROJ-1', 'PROJ-2']);
  });
});

describe('resolveMrHealth', () => {
  it('returns waiting_for_review when approvals is undefined', () => {
    expect(resolveMrHealth(undefined, undefined)).toBe('waiting_for_review');
  });

  it('returns approved when an approver is present and discussions is undefined', () => {
    const approvals = { approved_by: [{ user: { id: 1, name: 'A' } }], approved: true };
    expect(resolveMrHealth(approvals, undefined)).toBe('approved');
  });

  it('returns changes_requested when zero approvers and an unresolved resolvable note exists', () => {
    const approvals = { approved_by: [], approved: false };
    const discussions = [
      {
        id: 'd1',
        individual_note: false,
        notes: [
          {
            id: 1,
            type: 'DiscussionNote' as const,
            body: 'please fix',
            author: { id: 1, name: 'A', username: 'a', avatar_url: '' },
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
            system: false,
            resolvable: true,
            resolved: false,
            resolved_by: null,
            resolved_at: null,
            position: null,
            confidential: false,
            internal: false,
          },
        ],
      },
    ];
    expect(resolveMrHealth(approvals, discussions)).toBe('changes_requested');
  });
});

describe('buildMrHealthByKey', () => {
  it('resolves approved-then-changes_requested to changes_requested', () => {
    const result = buildMrHealthByKey([
      { keys: ['PROJ-1'], health: 'approved' },
      { keys: ['PROJ-1'], health: 'changes_requested' },
    ]);
    expect(result.get('PROJ-1')).toBe('changes_requested');
  });

  it('resolves changes_requested-then-approved to changes_requested (order-independent)', () => {
    const result = buildMrHealthByKey([
      { keys: ['PROJ-1'], health: 'changes_requested' },
      { keys: ['PROJ-1'], health: 'approved' },
    ]);
    expect(result.get('PROJ-1')).toBe('changes_requested');
  });

  it('resolves a key seen only as approved to approved', () => {
    const result = buildMrHealthByKey([{ keys: ['PROJ-1'], health: 'approved' }]);
    expect(result.get('PROJ-1')).toBe('approved');
  });
});
