// AUTH-02: GitLab PAT validation
// DEV-05: Phase 2 GitLab MR functions
// STAND-05: fetchUserCommits - Git commits by author for standup recap
// STAND-06: fetchUserMREvents - MR comments + approvals via GitLab User Events API
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAssignedMRs,
  fetchMRApprovals,
  fetchMRCommits,
  fetchMRDiscussions,
  fetchParticipatedMRs,
  fetchProjectMilestones,
  fetchReviewerMRs,
  fetchUserCommits,
  fetchUserMREvents,
  listGitLabGroups,
  listGitLabProjects,
  searchGitLabMRs,
  updateMilestone,
  validateGitLab,
} from './gitlab';

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}));

import { fetch as mockFetch } from '@tauri-apps/plugin-http';

describe('gitlab service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateGitLab', () => {
    it('AUTH-02: validateGitLab returns user data on 200 response', async () => {
      const mockUser = {
        id: 42,
        name: 'Jane Smith',
        username: 'jsmith',
        email: 'jane.smith@example.com',
      };
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockUser,
      } as Response);

      const result = await validateGitLab('https://gitlab.example.com', 'my-token');
      expect(result).toEqual({
        id: 42,
        name: 'Jane Smith',
        username: 'jsmith',
        email: 'jane.smith@example.com',
      });
    });

    it('AUTH-02: validateGitLab defaults email to null when absent', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 7, name: 'No Email', username: 'noemail' }),
      } as Response);

      const result = await validateGitLab('https://gitlab.example.com', 'my-token');
      expect(result.email).toBeNull();
    });

    it('AUTH-02: validateGitLab throws "Invalid token or token has expired" on 401', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      } as Response);

      await expect(validateGitLab('https://gitlab.example.com', 'bad-token')).rejects.toThrow(
        'Invalid token or token has expired',
      );
    });

    it('AUTH-02: validateGitLab throws "Token valid but lacks required permissions" on 403', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({}),
      } as Response);

      await expect(validateGitLab('https://gitlab.example.com', 'limited-token')).rejects.toThrow(
        'Token valid but lacks required permissions',
      );
    });

    it('AUTH-02: validateGitLab throws "Cannot reach [URL]" on network error', async () => {
      vi.mocked(mockFetch).mockRejectedValue(new Error('Network failure'));

      await expect(validateGitLab('https://gitlab.example.com', 'any-token')).rejects.toThrow(
        'Cannot reach https://gitlab.example.com — check the base URL',
      );
    });

    it('AUTH-02: validateGitLab throws "Cannot reach [URL]" on non-401/403 error status', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      } as Response);

      await expect(validateGitLab('https://gitlab.example.com', 'any-token')).rejects.toThrow(
        'Cannot reach https://gitlab.example.com — check the base URL',
      );
    });
  });

  describe('listGitLabGroups', () => {
    it('AUTH-02: listGitLabGroups returns groups list on success', async () => {
      const mockGroups = [
        { id: 1, name: 'Engineering', full_path: 'engineering' },
        { id: 2, name: 'Frontend', full_path: 'engineering/frontend' },
      ];
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockGroups,
      } as Response);

      const result = await listGitLabGroups('https://gitlab.example.com', 'my-token');
      expect(result).toEqual(mockGroups);
    });
  });

  describe('fetchAssignedMRs', () => {
    const mockMR = {
      id: 101,
      iid: 1,
      project_id: 5,
      title: '[PROJ-42] Fix login bug',
      source_branch: 'feature/PROJ-42-fix-login',
      state: 'opened' as const,
      author: {
        id: 1,
        name: 'Alice',
        username: 'alice',
        avatar_url: 'https://example.com/alice.png',
      },
      reviewers: [{ id: 2, name: 'Bob', username: 'bob' }],
      updated_at: '2026-03-10T12:00:00Z',
      web_url: 'https://gitlab.example.com/project/mr/1',
    };

    it('DEV-05: fetchAssignedMRs returns GitLabMR[]', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [mockMR],
      } as Response);

      const result = await fetchAssignedMRs('https://gitlab.example.com', 'my-token');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockMR);
    });
  });

  describe('fetchReviewerMRs', () => {
    it('DEV-05: fetchReviewerMRs calls URL with reviewer_id param', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      } as Response);

      await fetchReviewerMRs('https://gitlab.example.com', 'my-token', 42);

      const callUrl = vi.mocked(mockFetch).mock.calls[0][0] as string;
      expect(callUrl).toContain('reviewer_id=42');
    });
  });

  describe('fetchMRCommits', () => {
    it('DEV-05: fetchMRCommits returns MRCommit[]', async () => {
      const mockCommits = [
        { id: 'abc123', title: 'PROJ-42 fix login', message: 'PROJ-42 fix login\n\nDetails here' },
      ];
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockCommits,
      } as Response);

      const result = await fetchMRCommits('https://gitlab.example.com', 'my-token', 5, 1);
      expect(result).toEqual(mockCommits);
    });
  });

  describe('fetchMRApprovals', () => {
    it('DEV-05: fetchMRApprovals returns MRApprovals with approved_by', async () => {
      const mockApprovals = {
        approved_by: [{ user: { id: 2, name: 'Bob' } }],
        approved: true,
      };
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockApprovals,
      } as Response);

      const result = await fetchMRApprovals('https://gitlab.example.com', 'my-token', 5, 1);
      expect(result).toEqual(mockApprovals);
      expect(result.approved_by).toHaveLength(1);
    });
  });

  describe('fetchMRDiscussions', () => {
    it('DEV-05: fetchMRDiscussions returns Discussion[] with notes', async () => {
      const mockDiscussions = [
        {
          id: 'd1',
          notes: [{ id: 'n1', resolvable: true, resolved: false, body: 'Please fix this' }],
        },
      ];
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockDiscussions,
      } as Response);

      const result = await fetchMRDiscussions('https://gitlab.example.com', 'my-token', 5, 1);
      expect(result).toEqual(mockDiscussions);
      expect(result[0].notes[0].resolved).toBe(false);
    });
  });

  describe('listGitLabProjects', () => {
    it('listGitLabProjects returns project list on success', async () => {
      const mockProjects = [
        {
          id: 1,
          name: 'Frontend',
          name_with_namespace: 'Org / Frontend',
          path_with_namespace: 'org/frontend',
        },
      ];
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockProjects,
      } as Response);
      const result = await listGitLabProjects('https://gitlab.example.com', 'my-token');
      expect(result).toEqual(mockProjects);
    });
  });

  describe('fetchProjectMilestones', () => {
    it('fetchProjectMilestones returns milestones for a project', async () => {
      const mockMilestones = [
        {
          id: 10,
          iid: 1,
          title: 'Sprint 1',
          due_date: '2026-04-01',
          state: 'active',
          web_url: 'https://gitlab.example.com/project/-/milestones/1',
        },
      ];
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockMilestones,
      } as Response);
      const result = await fetchProjectMilestones('https://gitlab.example.com', 'my-token', 42);
      expect(result).toEqual(mockMilestones);
      expect(vi.mocked(mockFetch)).toHaveBeenCalledWith(
        expect.stringContaining('/projects/42/milestones'),
        expect.any(Object),
      );
    });
  });

  describe('searchGitLabMRs', () => {
    it('APIF-04: request URL includes state=opened filter', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      } as Response);
      await searchGitLabMRs('https://gitlab.example.com', 'my-token', 'feat login');
      const calledUrl = vi.mocked(mockFetch).mock.calls[0][0] as string;
      expect(calledUrl).toMatch(/state=opened/);
    });
  });

  describe('fetchUserCommits (STAND-05)', () => {
    const BASE = 'https://gitlab.example.com';
    const TOKEN = 'glpat-test';
    const PROJECT_ID = 99;
    const DATE = '2026-05-23';

    // Unique id per commit by default so dedupe-by-id doesn't collapse distinct
    // commits; pass an explicit `id` to simulate the same commit on multiple branches.
    let commitIdCounter = 0;
    const makeCommit = (overrides: {
      author_name?: string;
      author_email?: string;
      id?: string;
    }) => {
      const id = overrides.id ?? `commit${commitIdCounter++}`.padEnd(40, '0');
      return {
        id,
        short_id: id.slice(0, 8),
        title: 'feat: add something',
        message: 'feat: add something\n',
        author_name: overrides.author_name ?? 'Other Person',
        author_email: overrides.author_email ?? 'other@example.com',
        authored_date: `${DATE}T10:00:00.000Z`,
        web_url: `${BASE}/project/-/commit/abc123`,
      };
    };

    it('STAND-05: includes commit matching author_name (case-insensitive)', async () => {
      const commits = [
        makeCommit({ author_name: 'JohnDoe', author_email: 'john@example.com' }),
        makeCommit({ author_name: 'Other Person', author_email: 'other@example.com' }),
      ];
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => commits,
      } as Response);

      const result = await fetchUserCommits(BASE, TOKEN, PROJECT_ID, DATE, 'johndoe');
      expect(result).toHaveLength(1);
      expect(result[0].author_name).toBe('JohnDoe');
    });

    it('STAND-05: includes commit matching author_email (case-insensitive contains)', async () => {
      const commits = [
        makeCommit({ author_name: 'John Doe Display', author_email: 'johndoe@company.com' }),
        makeCommit({ author_name: 'Other Person', author_email: 'other@example.com' }),
      ];
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => commits,
      } as Response);

      const result = await fetchUserCommits(BASE, TOKEN, PROJECT_ID, DATE, 'johndoe');
      expect(result).toHaveLength(1);
      expect(result[0].author_email).toBe('johndoe@company.com');
    });

    it('STAND-05: matches git author_name via the GitLab display name when the login differs', async () => {
      // Real-world bug: login "mmozolak" matches neither author_name "Milan Mozolak"
      // nor email "milan.mozolak@isdd.sk", but the display name does.
      const commits = [
        makeCommit({ author_name: 'Milan Mozolak', author_email: 'milan.mozolak@isdd.sk' }),
        makeCommit({ author_name: 'Other Person', author_email: 'other@example.com' }),
      ];
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => commits,
      } as Response);

      const result = await fetchUserCommits(
        BASE,
        TOKEN,
        PROJECT_ID,
        DATE,
        'mmozolak',
        'Milan Mozolak',
      );
      expect(result).toHaveLength(1);
      expect(result[0].author_name).toBe('Milan Mozolak');
    });

    it('STAND-05: matches by email name across different domains', async () => {
      // john.doe@example.com (user) should match john.doe@company.com (commit).
      const commits = [
        makeCommit({ author_name: 'JD', author_email: 'john.doe@company.com' }),
        makeCommit({ author_name: 'Other', author_email: 'someone@company.com' }),
      ];
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => commits,
      } as Response);

      const result = await fetchUserCommits(
        BASE,
        TOKEN,
        PROJECT_ID,
        DATE,
        'jdoe',
        'John Doe',
        'john.doe@example.com',
      );
      expect(result).toHaveLength(1);
      expect(result[0].author_email).toBe('john.doe@company.com');
    });

    it('STAND-05: matches by email name ignoring trailing digits (both directions)', async () => {
      const commits = [
        // user john.doe@example.com vs commit john.doe1@example.com
        makeCommit({ author_name: 'A', author_email: 'john.doe1@example.com' }),
      ];
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => commits,
      } as Response);

      const forward = await fetchUserCommits(
        BASE,
        TOKEN,
        PROJECT_ID,
        DATE,
        'jdoe',
        'John Doe',
        'john.doe@example.com',
      );
      expect(forward).toHaveLength(1);

      // vice versa: user john.doe1@... vs commit john.doe@...
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [makeCommit({ author_name: 'A', author_email: 'john.doe@example.com' })],
      } as Response);
      const reverse = await fetchUserCommits(
        BASE,
        TOKEN,
        PROJECT_ID,
        DATE,
        'jdoe',
        'John Doe',
        'john.doe1@example.com',
      );
      expect(reverse).toHaveLength(1);
    });

    it('STAND-05: email-name match does not pull in a different person', async () => {
      const commits = [makeCommit({ author_name: 'Jane', author_email: 'jane.doe@example.com' })];
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => commits,
      } as Response);

      const result = await fetchUserCommits(
        BASE,
        TOKEN,
        PROJECT_ID,
        DATE,
        'jdoe',
        'John Doe',
        'john.doe@example.com',
      );
      expect(result).toHaveLength(0);
    });

    it('STAND-05: pages through the window so commits past page 1 are not dropped', async () => {
      // The endpoint has no author filter; a busy day can push the user's commit onto
      // page 2. A full page (100) must trigger a follow-up fetch.
      const page1 = Array.from({ length: 100 }, () =>
        makeCommit({ author_name: 'Other Person', author_email: 'other@example.com' }),
      );
      const page2 = [makeCommit({ author_name: 'JohnDoe', author_email: 'john@example.com' })];

      vi.mocked(mockFetch)
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => page1 } as Response)
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => page2 } as Response);

      const result = await fetchUserCommits(BASE, TOKEN, PROJECT_ID, DATE, 'johndoe');

      expect(vi.mocked(mockFetch).mock.calls.length).toBe(2);
      expect(vi.mocked(mockFetch).mock.calls[0][0]).toContain('page=1');
      expect(vi.mocked(mockFetch).mock.calls[1][0]).toContain('page=2');
      expect(result).toHaveLength(1);
      expect(result[0].author_name).toBe('JohnDoe');
    });

    it('STAND-05: stops paging on a short (non-full) page', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [makeCommit({ author_name: 'johndoe' })],
      } as Response);

      await fetchUserCommits(BASE, TOKEN, PROJECT_ID, DATE, 'johndoe');
      expect(vi.mocked(mockFetch).mock.calls.length).toBe(1);
    });

    it('STAND-05: requests all branches (all=true), not just the default branch', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      } as Response);

      await fetchUserCommits(BASE, TOKEN, PROJECT_ID, DATE, 'johndoe');
      expect(vi.mocked(mockFetch).mock.calls[0][0]).toContain('all=true');
    });

    it('STAND-05: dedupes the same commit returned from multiple branch tips', async () => {
      const commits = [
        makeCommit({ id: 'dup', author_name: 'JohnDoe' }),
        makeCommit({ id: 'dup', author_name: 'JohnDoe' }),
      ];
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => commits,
      } as Response);

      const result = await fetchUserCommits(BASE, TOKEN, PROJECT_ID, DATE, 'johndoe');
      expect(result).toHaveLength(1);
    });

    it('STAND-05: builds since/until window from the local day, not a fixed UTC string', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      } as Response);

      await fetchUserCommits(BASE, TOKEN, PROJECT_ID, DATE, 'johndoe');

      const calledUrl = vi.mocked(mockFetch).mock.calls[0][0] as string;
      const sinceParam = decodeURIComponent(calledUrl.match(/since=([^&]+)/)?.[1] ?? '');
      const untilParam = decodeURIComponent(calledUrl.match(/until=([^&]+)/)?.[1] ?? '');
      // The window endpoints are the UTC instants of the LOCAL day boundaries.
      expect(sinceParam).toBe(new Date(`${DATE}T00:00:00.000`).toISOString());
      expect(untilParam).toBe(new Date(`${DATE}T23:59:59.999`).toISOString());
    });

    it('STAND-05: excludes commits not matching author name or email', async () => {
      const commits = [
        makeCommit({ author_name: 'Alice', author_email: 'alice@example.com' }),
        makeCommit({ author_name: 'Bob', author_email: 'bob@example.com' }),
      ];
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => commits,
      } as Response);

      const result = await fetchUserCommits(BASE, TOKEN, PROJECT_ID, DATE, 'johndoe');
      expect(result).toHaveLength(0);
    });

    it('STAND-05: URL contains repository/commits, since, until, and PRIVATE-TOKEN header', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      } as Response);

      await fetchUserCommits(BASE, TOKEN, PROJECT_ID, DATE, 'johndoe');

      const calledUrl = vi.mocked(mockFetch).mock.calls[0][0] as string;
      const calledOptions = vi.mocked(mockFetch).mock.calls[0][1] as {
        headers: Record<string, string>;
      };
      expect(calledUrl).toContain(`/projects/${PROJECT_ID}/repository/commits`);
      expect(calledUrl).toContain('since=');
      expect(calledUrl).toContain('until=');
      expect(calledOptions.headers['PRIVATE-TOKEN']).toBe(TOKEN);
    });

    it('STAND-05: throws ApiError with status 401 on unauthorized response', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      } as Response);

      await expect(
        fetchUserCommits(BASE, TOKEN, PROJECT_ID, DATE, 'johndoe'),
      ).rejects.toMatchObject({ status: 401, source: 'gitlab' });
    });

    it('STAND-05: throws ApiError with status 403 on forbidden response', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({}),
      } as Response);

      await expect(
        fetchUserCommits(BASE, TOKEN, PROJECT_ID, DATE, 'johndoe'),
      ).rejects.toMatchObject({ status: 403, source: 'gitlab' });
    });

    it('STAND-05: throws network error when apiFetch throws', async () => {
      vi.mocked(mockFetch).mockRejectedValue(new Error('Network failure'));

      await expect(fetchUserCommits(BASE, TOKEN, PROJECT_ID, DATE, 'johndoe')).rejects.toThrow(
        `Cannot reach ${BASE} — check the base URL`,
      );
    });
  });

  describe('fetchUserMREvents (STAND-06)', () => {
    const BASE = 'https://gitlab.example.com';
    const TOKEN = 'glpat-test';
    const USER_ID = 42;
    const DATE = '2026-05-23';
    const DAY_BEFORE = '2026-05-22';

    const makeMREvent = (overrides: {
      action_name?: 'commented' | 'approved';
      created_at?: string;
      target_type?: string;
      noteableType?: string;
      noteAuthorId?: number;
      eventAuthorId?: number;
    }) => {
      const action = overrides.action_name ?? 'commented';
      return {
        id: 1001,
        action_name: action,
        target_type: overrides.target_type ?? 'MergeRequest',
        target_id: 5001,
        target_iid: 42,
        target_title: 'feat: add login flow',
        created_at: overrides.created_at ?? `${DATE}T10:00:00.000Z`,
        project_id: 99,
        author: { id: overrides.eventAuthorId ?? USER_ID },
        // Comment events carry a `note`; the MR is identified by noteable_iid
        // and the comment count must reflect only the current user's notes.
        ...(action === 'commented'
          ? {
              note: {
                noteable_type: overrides.noteableType ?? 'MergeRequest',
                noteable_iid: 42,
                author: { id: overrides.noteAuthorId ?? USER_ID },
              },
            }
          : {}),
      };
    };

    it('STAND-06: merges commented and approved events from both requests', async () => {
      const commentedEvent = makeMREvent({ action_name: 'commented' });
      const approvedEvent = makeMREvent({ action_name: 'approved' });

      vi.mocked(mockFetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [commentedEvent],
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [approvedEvent],
        } as Response);

      const result = await fetchUserMREvents(BASE, TOKEN, USER_ID, DATE);
      expect(result).toHaveLength(2);
      const actionNames = result.map((e) => e.action_name);
      expect(actionNames).toContain('commented');
      expect(actionNames).toContain('approved');
    });

    it('STAND-06: filters out events from a neighboring day (client-side date filter)', async () => {
      const todayEvent = makeMREvent({ created_at: `${DATE}T09:00:00.000Z` });
      const neighborEvent = makeMREvent({ created_at: `${DAY_BEFORE}T23:00:00.000Z` });

      vi.mocked(mockFetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [todayEvent, neighborEvent],
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [],
        } as Response);

      const result = await fetchUserMREvents(BASE, TOKEN, USER_ID, DATE);
      expect(result).toHaveLength(1);
      expect(result[0].created_at.slice(0, 10)).toBe(DATE);
    });

    it('STAND-06: keeps only comments whose note.noteable_type is MergeRequest', async () => {
      const mrEvent = makeMREvent({ noteableType: 'MergeRequest' });
      const issueEvent = makeMREvent({ noteableType: 'Issue' });

      vi.mocked(mockFetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [mrEvent, issueEvent],
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [],
        } as Response);

      const result = await fetchUserMREvents(BASE, TOKEN, USER_ID, DATE);
      expect(result).toHaveLength(1);
      expect(result[0].note?.noteable_type).toBe('MergeRequest');
    });

    it("STAND-06: counts only the current user's comments, not other authors", async () => {
      const mine = makeMREvent({ noteAuthorId: USER_ID });
      const someoneElse = makeMREvent({ noteAuthorId: 999 });

      vi.mocked(mockFetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [mine, someoneElse],
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [],
        } as Response);

      const result = await fetchUserMREvents(BASE, TOKEN, USER_ID, DATE);
      expect(result).toHaveLength(1);
      expect(result[0].note?.author?.id).toBe(USER_ID);
    });

    it('STAND-06: excludes replies whose event actor is someone else', async () => {
      const mine = makeMREvent({ eventAuthorId: USER_ID });
      const reply = makeMREvent({ eventAuthorId: 999 });

      vi.mocked(mockFetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [mine, reply],
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [],
        } as Response);

      const result = await fetchUserMREvents(BASE, TOKEN, USER_ID, DATE);
      expect(result).toHaveLength(1);
      expect(result[0].author?.id).toBe(USER_ID);
    });

    it('STAND-06: one request failure still returns results from the other (allSettled isolation)', async () => {
      const approvedEvent = makeMREvent({ action_name: 'approved' });

      vi.mocked(mockFetch)
        .mockRejectedValueOnce(new Error('Network error on commented'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [approvedEvent],
        } as Response);

      const result = await fetchUserMREvents(BASE, TOKEN, USER_ID, DATE);
      expect(result).toHaveLength(1);
      expect(result[0].action_name).toBe('approved');
    });

    it('STAND-06: returns empty array when both requests return no same-day events', async () => {
      vi.mocked(mockFetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [],
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [],
        } as Response);

      const result = await fetchUserMREvents(BASE, TOKEN, USER_ID, DATE);
      expect(result).toHaveLength(0);
    });

    it('STAND-06: URLs contain action=commented, action=approved, and /events path', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      } as Response);

      await fetchUserMREvents(BASE, TOKEN, USER_ID, DATE);

      const calls = vi.mocked(mockFetch).mock.calls;
      expect(calls).toHaveLength(2);
      const urls = calls.map((c) => c[0] as string);
      expect(urls.some((u) => u.includes('action=commented'))).toBe(true);
      expect(urls.some((u) => u.includes('action=approved'))).toBe(true);
      expect(urls.every((u) => u.includes(`/users/${USER_ID}/events`))).toBe(true);
    });
  });

  describe('fetchParticipatedMRs', () => {
    const BASE = 'https://gitlab.example.com';
    const TOKEN = 'glpat-test';
    const USER_ID = 42;

    /** Build a minimal commented event for the given MR iid. */
    const makeCommentEvent = (
      overrides: {
        mrIid?: number;
        projectId?: number;
        title?: string;
        created_at?: string;
        eventAuthorId?: number;
        noteAuthorId?: number;
        noteableType?: string;
      } = {},
    ) => ({
      id: Math.random(),
      action_name: 'commented' as const,
      target_type: null,
      target_id: 9000,
      target_iid: 9000, // note iid — NOT the MR iid
      target_title: overrides.title ?? 'feat: add login flow',
      created_at: overrides.created_at ?? '2026-05-01T10:00:00Z',
      project_id: overrides.projectId ?? 99,
      author: { id: overrides.eventAuthorId ?? USER_ID },
      note: {
        noteable_type: overrides.noteableType ?? 'MergeRequest',
        noteable_iid: overrides.mrIid ?? 42,
        author: { id: overrides.noteAuthorId ?? USER_ID },
      },
    });

    /**
     * Build a stub discussion thread with a single note authored by the given
     * user, with configurable resolvable/resolved state.
     */
    const makeDiscussion = (authorId: number, resolvable: boolean, resolved: boolean) => ({
      id: `d-${Math.random()}`,
      individual_note: false,
      notes: [
        {
          id: Math.random(),
          type: null,
          body: 'comment',
          author: { id: authorId, name: 'User', username: 'user', avatar_url: '' },
          created_at: '2026-05-01T10:00:00Z',
          updated_at: '2026-05-01T10:00:00Z',
          system: false,
          resolvable,
          resolved,
          resolved_by: null,
          resolved_at: null,
          position: null,
          confidential: false,
          internal: false,
        },
      ],
    });

    /** Approval payload where the given user ID has approved. */
    const makeApprovals = (approverIds: number[]) => ({
      approved_by: approverIds.map((id) => ({ user: { id, name: 'approver' } })),
      approved: approverIds.length > 0,
    });

    /**
     * Set up mockFetch to route by URL substring.
     *
     * IMPORTANT ordering: the detail URL `.../merge_requests/<iid>` is a PREFIX
     * of `.../merge_requests/<iid>/discussions` and `.../merge_requests/<iid>/approvals`.
     * Check the more-specific substrings (/discussions, /approvals) FIRST; then
     * check /events; finally treat a bare merge_requests/<iid> path as the detail call.
     *
     *  - /discussions  → returns discussionsMap[mrIid] or []
     *  - /approvals    → returns approvalsMap[mrIid] or default empty
     *  - /events       → returns events array
     *  - merge_requests/<iid> (no trailing sub-path) → detail stub: state='opened',
     *                    author.id defaults to 999 (NOT the test user) so existing
     *                    "not approved → included" cases stay valid; pass detailAuthorMap
     *                    to override per MR iid.
     */
    const setupMocks = (
      events: object[],
      discussionsMap: Record<number, object[]> = {},
      approvalsMap: Record<number, object> = {},
      detailStateMap: Record<number, 'opened' | 'closed' | 'merged' | 'locked'> = {},
      detailAuthorMap: Record<number, number> = {},
    ) => {
      vi.mocked(mockFetch).mockImplementation(async (url: string | URL | Request) => {
        const u = url.toString();
        // Most-specific substrings first to avoid prefix collision
        if (u.includes('/discussions')) {
          const mrIidMatch = u.match(/merge_requests\/(\d+)\/discussions/);
          const mrIid = mrIidMatch ? Number(mrIidMatch[1]) : 0;
          return {
            ok: true,
            status: 200,
            json: async () => discussionsMap[mrIid] ?? [],
          } as Response;
        }
        if (u.includes('/approvals')) {
          const mrIidMatch = u.match(/merge_requests\/(\d+)\/approvals/);
          const mrIid = mrIidMatch ? Number(mrIidMatch[1]) : 0;
          return {
            ok: true,
            status: 200,
            json: async () => approvalsMap[mrIid] ?? makeApprovals([]),
          } as Response;
        }
        if (u.includes('/events')) {
          return { ok: true, status: 200, json: async () => events } as Response;
        }
        // Bare merge_requests/<iid> — detail call
        const detailMatch = u.match(/merge_requests\/(\d+)$/);
        if (detailMatch) {
          const mrIid = Number(detailMatch[1]);
          const state = detailStateMap[mrIid] ?? 'opened';
          // Default author to 999 (someone else) so existing "not approved → included"
          // cases are not affected by the new authoredByMe rule.
          const authorId = detailAuthorMap[mrIid] ?? 999;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              iid: mrIid,
              state,
              author: { id: authorId },
              source_branch: `feature/mr-${mrIid}`,
              web_url: `https://gitlab.example.com/mr/${mrIid}`,
            }),
          } as Response;
        }
        return { ok: true, status: 200, json: async () => [] } as Response;
      });
    };

    it('URL contains action=commented and /users/<id>/events', async () => {
      setupMocks([]);

      await fetchParticipatedMRs(BASE, TOKEN, USER_ID, 30);

      const calledUrl = vi.mocked(mockFetch).mock.calls[0][0] as string;
      expect(calledUrl).toContain(`/users/${USER_ID}/events`);
      expect(calledUrl).toContain('action=commented');
    });

    it('deduplicates multiple comment events on the same MR into one entry with commentCount=2', async () => {
      const event1 = makeCommentEvent({ mrIid: 55, created_at: '2026-05-01T08:00:00Z' });
      const event2 = makeCommentEvent({ mrIid: 55, created_at: '2026-05-02T09:00:00Z' });

      // MR 55: not approved, one open thread → included
      setupMocks(
        [event1, event2],
        { 55: [makeDiscussion(USER_ID, true, false)] },
        { 55: makeApprovals([]) },
      );

      const result = await fetchParticipatedMRs(BASE, TOKEN, USER_ID, 30);

      expect(result).toHaveLength(1);
      expect(result[0].mrIid).toBe(55);
      expect(result[0].commentCount).toBe(2);
      // lastCommentedAt should be the later timestamp
      expect(result[0].lastCommentedAt).toBe('2026-05-02T09:00:00Z');
    });

    it('CR-01: approvals payload missing approved_by does not reject the query', async () => {
      // GitLab CE/Free returns an approvals object without `approved_by`.
      // The enrichment must guard this and treat the MR as not-approved (included),
      // NOT throw and reject the whole Promise.all.
      const event = makeCommentEvent({ mrIid: 77, created_at: '2026-05-03T08:00:00Z' });
      setupMocks(
        [event],
        { 77: [makeDiscussion(USER_ID, true, true)] }, // resolved thread → no open thread
        { 77: { approved: false } as object }, // NO approved_by field
      );

      const result = await fetchParticipatedMRs(BASE, TOKEN, USER_ID, 30);

      // No open thread + not approved (missing field → false) → included via !approvedByMe
      expect(result).toHaveLength(1);
      expect(result[0].mrIid).toBe(77);
      expect(result[0].approvedByMe).toBe(false);
      expect(result[0].openThreadCount).toBe(0);
    });

    it('excludes events where note.noteable_type is not MergeRequest', async () => {
      const mrComment = makeCommentEvent({ mrIid: 10, noteableType: 'MergeRequest' });
      const issueComment = makeCommentEvent({ mrIid: 20, noteableType: 'Issue' });

      // MR 10: not approved, one open thread → included; issue comment filtered before enrichment
      setupMocks(
        [mrComment, issueComment],
        { 10: [makeDiscussion(USER_ID, true, false)] },
        { 10: makeApprovals([]) },
      );

      const result = await fetchParticipatedMRs(BASE, TOKEN, USER_ID, 30);

      expect(result).toHaveLength(1);
      expect(result[0].mrIid).toBe(10);
    });

    it('excludes comments authored by someone else (note.author.id !== userId)', async () => {
      const mine = makeCommentEvent({ mrIid: 100, noteAuthorId: USER_ID });
      const theirs = makeCommentEvent({ mrIid: 200, noteAuthorId: 999 });

      // MR 100: not approved, open thread → included; MR 200 filtered before enrichment
      setupMocks(
        [mine, theirs],
        { 100: [makeDiscussion(USER_ID, true, false)] },
        { 100: makeApprovals([]) },
      );

      const result = await fetchParticipatedMRs(BASE, TOKEN, USER_ID, 30);

      expect(result).toHaveLength(1);
      expect(result[0].mrIid).toBe(100);
    });

    it('excludes events where the event actor (author.id) is someone else', async () => {
      const mine = makeCommentEvent({ mrIid: 300, eventAuthorId: USER_ID });
      const theirs = makeCommentEvent({ mrIid: 400, eventAuthorId: 777 });

      // MR 300: not approved, open thread → included; MR 400 filtered before enrichment
      setupMocks(
        [mine, theirs],
        { 300: [makeDiscussion(USER_ID, true, false)] },
        { 300: makeApprovals([]) },
      );

      const result = await fetchParticipatedMRs(BASE, TOKEN, USER_ID, 30);

      expect(result).toHaveLength(1);
      expect(result[0].mrIid).toBe(300);
    });

    it('returns results sorted by lastCommentedAt descending', async () => {
      const older = makeCommentEvent({ mrIid: 1, created_at: '2026-04-01T00:00:00Z' });
      const newer = makeCommentEvent({ mrIid: 2, created_at: '2026-05-15T00:00:00Z' });

      // Both: not approved, open thread → both included
      setupMocks(
        [older, newer],
        {
          1: [makeDiscussion(USER_ID, true, false)],
          2: [makeDiscussion(USER_ID, true, false)],
        },
        {
          1: makeApprovals([]),
          2: makeApprovals([]),
        },
      );

      const result = await fetchParticipatedMRs(BASE, TOKEN, USER_ID, 30);

      expect(result[0].mrIid).toBe(2);
      expect(result[1].mrIid).toBe(1);
    });

    it('returns empty array when no events match', async () => {
      setupMocks([]);

      const result = await fetchParticipatedMRs(BASE, TOKEN, USER_ID, 30);
      expect(result).toHaveLength(0);
    });

    // ── Actionable filter cases ───────────────────────────────────────────────

    it('filter: approved by me with all threads resolved → EXCLUDED', async () => {
      const event = makeCommentEvent({ mrIid: 10, projectId: 99 });

      setupMocks(
        [event],
        // My thread exists but is resolved
        { 10: [makeDiscussion(USER_ID, true, true)] },
        // I approved it
        { 10: makeApprovals([USER_ID]) },
      );

      const result = await fetchParticipatedMRs(BASE, TOKEN, USER_ID, 30);
      expect(result).toHaveLength(0);
    });

    it('filter: approved by me but with an unresolved thread → INCLUDED, openThreadCount=1', async () => {
      const event = makeCommentEvent({ mrIid: 20, projectId: 99 });

      setupMocks(
        [event],
        // One unresolved thread I'm in
        { 20: [makeDiscussion(USER_ID, true, false)] },
        // I approved it
        { 20: makeApprovals([USER_ID]) },
      );

      const result = await fetchParticipatedMRs(BASE, TOKEN, USER_ID, 30);
      expect(result).toHaveLength(1);
      expect(result[0].mrIid).toBe(20);
      expect(result[0].approvedByMe).toBe(true);
      expect(result[0].openThreadCount).toBe(1);
    });

    it('filter: NOT approved by me with only resolved threads → INCLUDED, openThreadCount=0', async () => {
      const event = makeCommentEvent({ mrIid: 30, projectId: 99 });

      setupMocks(
        [event],
        // Thread exists but fully resolved
        { 30: [makeDiscussion(USER_ID, true, true)] },
        // Not approved by me
        { 30: makeApprovals([]) },
      );

      const result = await fetchParticipatedMRs(BASE, TOKEN, USER_ID, 30);
      expect(result).toHaveLength(1);
      expect(result[0].mrIid).toBe(30);
      expect(result[0].approvedByMe).toBe(false);
      expect(result[0].openThreadCount).toBe(0);
    });

    it('filter: approvals request fails → treated as not-approved → INCLUDED', async () => {
      const event = makeCommentEvent({ mrIid: 40, projectId: 99 });

      // Discussions OK (resolved thread), approvals endpoint errors
      vi.mocked(mockFetch).mockImplementation(async (url: string | URL | Request) => {
        const u = url.toString();
        // Most-specific first to avoid prefix collision with detail URL
        if (u.includes('/discussions')) {
          return {
            ok: true,
            status: 200,
            json: async () => [makeDiscussion(USER_ID, true, true)],
          } as Response;
        }
        if (u.includes('/approvals')) {
          return { ok: false, status: 500, json: async () => ({}) } as Response;
        }
        if (u.includes('/events')) {
          return { ok: true, status: 200, json: async () => [event] } as Response;
        }
        // Detail call — MR 40 is open, authored by someone else (999)
        const detailMatch = u.match(/merge_requests\/(\d+)$/);
        if (detailMatch) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ iid: 40, state: 'opened', author: { id: 999 } }),
          } as Response;
        }
        return { ok: true, status: 200, json: async () => [] } as Response;
      });

      const result = await fetchParticipatedMRs(BASE, TOKEN, USER_ID, 30);
      // approvals failed → approvedByMe=false → included despite resolved thread
      expect(result).toHaveLength(1);
      expect(result[0].mrIid).toBe(40);
      expect(result[0].approvedByMe).toBe(false);
    });

    // ── State filter cases ────────────────────────────────────────────────────

    it('state filter: merged MR → EXCLUDED even with an open thread', async () => {
      const event = makeCommentEvent({ mrIid: 50, projectId: 99 });

      setupMocks(
        [event],
        { 50: [makeDiscussion(USER_ID, true, false)] },
        { 50: makeApprovals([]) },
        { 50: 'merged' },
      );

      const result = await fetchParticipatedMRs(BASE, TOKEN, USER_ID, 30);
      expect(result).toHaveLength(0);
    });

    it('state filter: closed MR → EXCLUDED even when not approved', async () => {
      const event = makeCommentEvent({ mrIid: 51, projectId: 99 });

      setupMocks(
        [event],
        { 51: [makeDiscussion(USER_ID, true, true)] },
        { 51: makeApprovals([]) },
        { 51: 'closed' },
      );

      const result = await fetchParticipatedMRs(BASE, TOKEN, USER_ID, 30);
      expect(result).toHaveLength(0);
    });

    it('state filter: opened MR with open thread → INCLUDED', async () => {
      const event = makeCommentEvent({ mrIid: 52, projectId: 99 });

      setupMocks(
        [event],
        { 52: [makeDiscussion(USER_ID, true, false)] },
        { 52: makeApprovals([]) },
        { 52: 'opened' },
      );

      const result = await fetchParticipatedMRs(BASE, TOKEN, USER_ID, 30);
      expect(result).toHaveLength(1);
      expect(result[0].mrIid).toBe(52);
      expect(result[0].openThreadCount).toBe(1);
    });

    // ── authoredByMe filter cases ─────────────────────────────────────────────

    it('authoredByMe: my own MR, not approved, no open thread → EXCLUDED', async () => {
      const event = makeCommentEvent({ mrIid: 60, projectId: 99 });

      // Detail author = USER_ID (I authored this MR), no open threads, not approved
      setupMocks(
        [event],
        { 60: [makeDiscussion(USER_ID, true, true)] }, // resolved thread
        { 60: makeApprovals([]) },
        {},
        { 60: USER_ID }, // authored by me
      );

      const result = await fetchParticipatedMRs(BASE, TOKEN, USER_ID, 30);
      // My own MR + no open thread → excluded even though not approved
      expect(result).toHaveLength(0);
    });

    it('authoredByMe: my own MR with an open thread → INCLUDED', async () => {
      const event = makeCommentEvent({ mrIid: 61, projectId: 99 });

      // Detail author = USER_ID, open thread present
      setupMocks(
        [event],
        { 61: [makeDiscussion(USER_ID, true, false)] }, // unresolved thread
        { 61: makeApprovals([]) },
        {},
        { 61: USER_ID }, // authored by me
      );

      const result = await fetchParticipatedMRs(BASE, TOKEN, USER_ID, 30);
      expect(result).toHaveLength(1);
      expect(result[0].mrIid).toBe(61);
      expect(result[0].authoredByMe).toBe(true);
      expect(result[0].openThreadCount).toBe(1);
    });

    it('authoredByMe: someone else MR, not approved, no open thread → INCLUDED (regression guard)', async () => {
      const event = makeCommentEvent({ mrIid: 62, projectId: 99 });

      // Detail author = 999 (someone else), resolved thread, not approved
      setupMocks(
        [event],
        { 62: [makeDiscussion(USER_ID, true, true)] }, // resolved thread
        { 62: makeApprovals([]) },
        {},
        { 62: 999 }, // authored by someone else
      );

      const result = await fetchParticipatedMRs(BASE, TOKEN, USER_ID, 30);
      // Not my MR, not approved → included (unchanged behaviour)
      expect(result).toHaveLength(1);
      expect(result[0].mrIid).toBe(62);
      expect(result[0].authoredByMe).toBe(false);
      expect(result[0].openThreadCount).toBe(0);
    });

    it('returned ParticipatedMR carries sourceBranch and webUrl from MR detail', async () => {
      const event = makeCommentEvent({ mrIid: 70, projectId: 99 });

      setupMocks(
        [event],
        { 70: [makeDiscussion(USER_ID, true, false)] },
        { 70: makeApprovals([]) },
      );

      const result = await fetchParticipatedMRs(BASE, TOKEN, USER_ID, 30);
      expect(result).toHaveLength(1);
      expect(result[0].sourceBranch).toBe('feature/mr-70');
      expect(result[0].webUrl).toBe('https://gitlab.example.com/mr/70');
    });

    it('state filter: detail fetch fails → EXCLUDED', async () => {
      const event = makeCommentEvent({ mrIid: 53, projectId: 99 });

      // Override mock so detail endpoint returns an error for MR 53
      vi.mocked(mockFetch).mockImplementation(async (url: string | URL | Request) => {
        const u = url.toString();
        if (u.includes('/discussions')) {
          return { ok: true, status: 200, json: async () => [] } as Response;
        }
        if (u.includes('/approvals')) {
          return {
            ok: true,
            status: 200,
            json: async () => makeApprovals([]),
          } as Response;
        }
        if (u.includes('/events')) {
          return { ok: true, status: 200, json: async () => [event] } as Response;
        }
        // Detail call fails
        const detailMatch = u.match(/merge_requests\/(\d+)$/);
        if (detailMatch) {
          return { ok: false, status: 404, json: async () => ({}) } as Response;
        }
        return { ok: true, status: 200, json: async () => [] } as Response;
      });

      const result = await fetchParticipatedMRs(BASE, TOKEN, USER_ID, 30);
      expect(result).toHaveLength(0);
    });
  });

  describe('updateMilestone', () => {
    const BASE = 'https://gitlab.example.com';
    const TOKEN = 'my-token';
    const PROJECT_ID = 99;
    const MILESTONE_ID = 1234;

    const updatedMilestone = {
      id: MILESTONE_ID,
      iid: 7,
      title: 'New title',
      description: 'New description',
      start_date: null,
      due_date: '2026-06-01',
      state: 'active',
      web_url: 'https://gitlab.example.com/group/proj/-/milestones/7',
    };

    it('returns the parsed milestone on 200 response', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => updatedMilestone,
      } as Response);

      const result = await updateMilestone(BASE, TOKEN, PROJECT_ID, MILESTONE_ID, {
        title: 'New title',
        description: 'New description',
      });
      expect(result).toEqual(updatedMilestone);
    });

    it('issues a PUT to the numeric-id milestone path with PRIVATE-TOKEN and only the changed fields', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => updatedMilestone,
      } as Response);

      await updateMilestone(BASE, TOKEN, PROJECT_ID, MILESTONE_ID, { description: 'x' });

      const [calledUrl, calledOptions] = vi.mocked(mockFetch).mock.calls[0] as [
        string,
        { method: string; headers: Record<string, string>; body: string },
      ];
      expect(calledUrl).toBe(
        `${BASE}/api/v4/projects/${PROJECT_ID}/milestones/${MILESTONE_ID}`,
      );
      expect(calledOptions.method).toBe('PUT');
      expect(calledOptions.headers['PRIVATE-TOKEN']).toBe(TOKEN);
      expect(JSON.parse(calledOptions.body)).toEqual({ description: 'x' });
    });

    it('throws ApiError with status 401 on unauthorized response', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      } as Response);

      await expect(
        updateMilestone(BASE, TOKEN, PROJECT_ID, MILESTONE_ID, { title: 'x' }),
      ).rejects.toMatchObject({ status: 401, source: 'gitlab' });
    });

    it('throws ApiError with status 403 on forbidden response', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({}),
      } as Response);

      await expect(
        updateMilestone(BASE, TOKEN, PROJECT_ID, MILESTONE_ID, { title: 'x' }),
      ).rejects.toMatchObject({ status: 403, source: 'gitlab' });
    });

    it('throws a generic error on other non-ok status', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      } as Response);

      await expect(
        updateMilestone(BASE, TOKEN, PROJECT_ID, MILESTONE_ID, { title: 'x' }),
      ).rejects.toThrow('Failed to update milestone: status 500');
    });
  });
});
