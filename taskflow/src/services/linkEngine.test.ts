// LINK-01, LINK-02: Ticket-key extraction and MR-to-task linking
// DEV-03: Review health derivation and stale detection
import { describe, expect, it } from 'vitest';
import type { Discussion, GitLabMR, MRApprovals } from './gitlab';
import {
  deriveReviewHealth,
  extractTicketKeys,
  isStale,
  linkMRToTask,
  linkMRToTaskViaCommits,
} from './linkEngine';

const baseMR: GitLabMR = {
  id: 101,
  iid: 1,
  project_id: 5,
  title: '',
  source_branch: 'main',
  state: 'opened',
  author: { id: 1, name: 'Alice', username: 'alice', avatar_url: '' },
  reviewers: [],
  updated_at: new Date().toISOString(),
  web_url: 'https://gitlab.example.com/mr/1',
  labels: [],
  milestone: null,
};

describe('linkEngine', () => {
  describe('extractTicketKeys', () => {
    it('LINK-01: extracts multiple ticket keys from text', () => {
      const result = extractTicketKeys('Fix PROJ-123 and ABC-45');
      expect(result).toEqual(['PROJ-123', 'ABC-45']);
    });

    it('LINK-01: returns empty array when no keys found', () => {
      const result = extractTicketKeys('no keys here');
      expect(result).toEqual([]);
    });

    it('LINK-01: does NOT double-match keys', () => {
      const result = extractTicketKeys('PROJ-1 PROJ-1');
      // Should not return duplicates — implementation may deduplicate or return both
      // Per plan: "does NOT double-match" → deduplication expected
      const unique = [...new Set(result)];
      expect(unique).toHaveLength(result.length);
    });

    it('LINK-01: word boundary check — PREFIX-FEAT-1 does NOT yield FEAT-1 alone', () => {
      const result = extractTicketKeys('PREFIX-FEAT-1');
      // PREFIX-FEAT-1 contains letters+digits only prefix, so no \b match for just FEAT-1
      expect(result).not.toContain('FEAT-1');
    });

    it('LINK-01: matches single key correctly', () => {
      const result = extractTicketKeys('[PROJ-42] fix bug');
      expect(result).toContain('PROJ-42');
    });
  });

  describe('linkMRToTask', () => {
    it('LINK-02: returns first matching key from MR title', () => {
      const mr = { ...baseMR, title: '[PROJ-42] fix bug', source_branch: 'main' };
      const result = linkMRToTask(mr, new Set(['PROJ-42']));
      expect(result).toBe('PROJ-42');
    });

    it('LINK-02: returns null when title has no matching key', () => {
      const mr = { ...baseMR, title: 'fix unrelated', source_branch: 'fix-unrelated' };
      const result = linkMRToTask(mr, new Set(['PROJ-42']));
      expect(result).toBeNull();
    });

    it('LINK-02: returns null when key in title not in sprint set', () => {
      const mr = {
        ...baseMR,
        title: '[PROJ-99] something',
        source_branch: 'feature/PROJ-99-something',
      };
      const result = linkMRToTask(mr, new Set(['PROJ-42']));
      expect(result).toBeNull();
    });

    it('LINK-02: returns key from source_branch when title has no matching key', () => {
      const mr = {
        ...baseMR,
        title: 'Implement feature',
        source_branch: 'feature/PROJ-42-implement-feature',
      };
      const result = linkMRToTask(mr, new Set(['PROJ-42']));
      expect(result).toBe('PROJ-42');
    });

    it('LINK-02: title match takes priority over branch match', () => {
      const mr = { ...baseMR, title: '[PROJ-42] fix', source_branch: 'feature/PROJ-99-something' };
      const result = linkMRToTask(mr, new Set(['PROJ-42', 'PROJ-99']));
      expect(result).toBe('PROJ-42');
    });

    it('LINK-02: branch match with lowercase prefix separators still extracts uppercase key', () => {
      const mr = { ...baseMR, title: 'no key here', source_branch: 'feature/PROJ-123-some-work' };
      const result = linkMRToTask(mr, new Set(['PROJ-123']));
      expect(result).toBe('PROJ-123');
    });
  });

  describe('linkMRToTaskViaCommits', () => {
    it('LINK-02: returns matching key from commit titles', () => {
      const mr = { ...baseMR, title: 'fix something' };
      const commits = [{ id: 'abc', title: 'PROJ-99 commit', message: '' }];
      const result = linkMRToTaskViaCommits(mr, new Set(['PROJ-99']), commits);
      expect(result).toBe('PROJ-99');
    });

    it('LINK-02: returns null when no commit title matches sprint keys', () => {
      const mr = { ...baseMR, title: 'fix something' };
      const commits = [{ id: 'abc', title: 'no key', message: '' }];
      const result = linkMRToTaskViaCommits(mr, new Set(['PROJ-99']), commits);
      expect(result).toBeNull();
    });

    it('LINK-02: returns null for empty commits array', () => {
      const mr = { ...baseMR, title: 'something' };
      const result = linkMRToTaskViaCommits(mr, new Set(['PROJ-99']), []);
      expect(result).toBeNull();
    });
  });

  describe('deriveReviewHealth', () => {
    it('DEV-03: returns "approved" when approved_by has entries', () => {
      const approvals: MRApprovals = {
        approved_by: [{ user: { id: 1, name: 'Alice' } }],
        approved: true,
      };
      const result = deriveReviewHealth(approvals, []);
      expect(result).toBe('approved');
    });

    it('DEV-03: returns "changes_requested" when unresolved discussions exist', () => {
      const approvals: MRApprovals = { approved_by: [], approved: false };
      const discussions: Discussion[] = [
        {
          id: 'd1',
          notes: [{ id: 'n1', resolvable: true, resolved: false, body: 'comment' }],
        },
      ];
      const result = deriveReviewHealth(approvals, discussions);
      expect(result).toBe('changes_requested');
    });

    it('DEV-03: returns "waiting_for_review" when no approvals and no unresolved discussions', () => {
      const approvals: MRApprovals = { approved_by: [], approved: false };
      const result = deriveReviewHealth(approvals, []);
      expect(result).toBe('waiting_for_review');
    });

    it('DEV-03: "approved" takes priority over unresolved discussions', () => {
      const approvals: MRApprovals = {
        approved_by: [{ user: { id: 1, name: 'Alice' } }],
        approved: true,
      };
      const discussions: Discussion[] = [
        {
          id: 'd1',
          notes: [{ id: 'n1', resolvable: true, resolved: false, body: 'comment' }],
        },
      ];
      const result = deriveReviewHealth(approvals, discussions);
      expect(result).toBe('approved');
    });
  });

  describe('isStale', () => {
    it('DEV-03: returns true when MR updated more than threshold days ago', () => {
      const mr = {
        ...baseMR,
        updated_at: new Date(Date.now() - 4 * 86_400_000).toISOString(),
      };
      expect(isStale(mr, 3)).toBe(true);
    });

    it('DEV-03: returns false when MR updated within threshold days', () => {
      const mr = {
        ...baseMR,
        updated_at: new Date(Date.now() - 1 * 86_400_000).toISOString(),
      };
      expect(isStale(mr, 3)).toBe(false);
    });

    it('DEV-03: returns false when MR updated exactly at threshold boundary', () => {
      // Just under threshold
      const mr = {
        ...baseMR,
        updated_at: new Date(Date.now() - 2.9 * 86_400_000).toISOString(),
      };
      expect(isStale(mr, 3)).toBe(false);
    });
  });
});
