// 87-REVIEW WR-01 / FOUND-01 SC3 (D-11): two independent producers write the
// SAME React Query cache key, `['jira-version-counts', versionId]` —
// ReleasesTab.tsx's local (unexported) `fetchVersionIssueCounts` and the
// shared `fetchVersionIssueCounts` exported from `services/jira.ts` (used by
// `release-detail/useReleaseDetail.ts`). Whichever query mounts last wins the
// cache entry. A consumer reading that entry must not be able to tell which
// producer populated it — the key AND the payload shape must be identical.
//
// This test proves cache-key parity (both call sites key on the same tuple)
// and asserts the payload SHAPE CONTRACT explicitly against
// `services/jira.ts`'s exported `VersionIssueCounts` interface
// (`{ issuesFixed: number; issuesTotal: number }`, nothing more). If
// ReleasesTab's local producer emits a different shape, this test documents
// that as an open bug rather than silently accepting it.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-token'),
}));

// Preserve the REAL `fetchVersionIssueCounts` export (the shared, correct
// producer) — only `fetchFixVersions` is stubbed, matching ReleasesTab.test.tsx's
// convention. This lets the test call the actual shared implementation as the
// ground truth for the contract.
vi.mock('@/services/jira', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/jira')>();
  return {
    ...actual,
    fetchFixVersions: vi.fn(),
  };
});

vi.mock('@/services/gitlab', () => ({
  fetchProjectMilestonesInRange: vi.fn().mockResolvedValue([]),
  fetchProjectTags: vi.fn().mockResolvedValue([]),
  fetchProjectBranches: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/services/releaseLinker', () => ({
  matchGitLabToFixVersion: vi
    .fn()
    .mockReturnValue({ type: 'none', candidateName: '', candidateUrl: '' }),
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
    gitlabBaseUrl: 'https://gitlab.example.com',
    activeGitlabProject: 42,
  })),
}));

// Both ReleasesTab's local fetcher AND (via apiFetch, when devtools are off)
// the shared services/jira.ts fetcher ultimately call this same low-level
// fetch. Route responses by URL so a single mock can serve both producers
// with matching upstream data.
vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(async (url: string) => {
    const isDoneQuery = decodeURIComponent(url).includes('statusCategory = Done');
    return {
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ total: isDoneQuery ? 3 : 10 }),
    } as Response;
  }),
}));

const VERSION_ID = '100'; // numeric string — required by the shared fetcher's versionId guard

function makeFixVersion(id: string, name: string, releaseDate: string | undefined) {
  return { id, name, releaseDate, released: false };
}

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  );
  return queryClient;
}

describe('jira-version-counts cache parity between ReleasesTab and useReleaseDetail (WR-01)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const stronghold = await import('@/services/stronghold');
    vi.mocked(stronghold.readSecret).mockResolvedValue('test-token');
    const { fetchFixVersions } = await import('@/services/jira');
    vi.mocked(fetchFixVersions).mockResolvedValue([
      makeFixVersion(VERSION_ID, 'v2.1.0', '2026-03-15'),
    ]);
  });

  it('writes the cache entry under the exact same key tuple useReleaseDetail.ts reads (["jira-version-counts", versionId])', async () => {
    const { default: ReleasesTab } = await import('./ReleasesTab');
    const queryClient = renderWithQuery(<ReleasesTab />);

    await vi.waitFor(() => {
      const state = queryClient.getQueryState(['jira-version-counts', VERSION_ID]);
      expect(state?.status).toBe('success');
    });

    // useReleaseDetail.ts line ~120 does `useQuery({ queryKey: ['jira-version-counts', versionId], ... })`.
    // If ReleasesTab populated a differently-shaped key (e.g. a number instead
    // of a string id, or an extra segment), useReleaseDetail would never see
    // this cache entry and vice versa — this assertion is the key-parity half
    // of the contract.
    const cached = queryClient.getQueryData(['jira-version-counts', VERSION_ID]);
    expect(cached).toBeDefined();
  });

  it('produces a payload matching the shared VersionIssueCounts contract exported from services/jira.ts (field names + types)', async () => {
    // Ground truth: call the REAL shared fetcher directly with the same
    // upstream responses ReleasesTab's own render will observe.
    const { fetchVersionIssueCounts } = await import('@/services/jira');
    const sharedResult = await fetchVersionIssueCounts(
      'https://jira.example.com',
      'test-token',
      VERSION_ID,
    );

    expect(sharedResult).toEqual({ issuesFixed: 3, issuesTotal: 10 });
    expect(Object.keys(sharedResult).sort()).toEqual(['issuesFixed', 'issuesTotal']);
    expect(typeof sharedResult.issuesFixed).toBe('number');
    expect(typeof sharedResult.issuesTotal).toBe('number');

    // Now render ReleasesTab, which populates the SAME cache key via its own
    // local, unexported `fetchVersionIssueCounts` (ReleasesTab.tsx:42-72) —
    // NOT the shared one imported above.
    const { default: ReleasesTab } = await import('./ReleasesTab');
    const queryClient = renderWithQuery(<ReleasesTab />);

    await vi.waitFor(() => {
      const state = queryClient.getQueryState(['jira-version-counts', VERSION_ID]);
      expect(state?.status).toBe('success');
    });

    const releasesTabResult = queryClient.getQueryData(['jira-version-counts', VERSION_ID]);

    // A consumer reading this cache entry (e.g. useReleaseDetail's own
    // `issueCounts` destructure, or any future component keyed off
    // `VersionIssueCounts`) must get an identical shape regardless of which
    // producer populated the cache. This is the contract this test protects:
    // whichever query mounts last must not silently change the shape the
    // other side depends on.
    expect(releasesTabResult).toEqual(sharedResult);
    expect(Object.keys(releasesTabResult as object).sort()).toEqual(
      Object.keys(sharedResult).sort(),
    );
  });
});
