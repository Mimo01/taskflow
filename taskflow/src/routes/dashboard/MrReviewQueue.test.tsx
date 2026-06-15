/**
 * MrReviewQueue.test.tsx — Phase 84 DASH-06/07
 *
 * Render tests for MrReviewQueue — two-group MR review queue from warm gitlab-mrs cache.
 * Uses QueryClient pre-seeding (setQueryData) to exercise warm-cache reads without network calls.
 *
 * Guards:
 * - reviewer MR appears under "Awaiting my review" group
 * - authored MR appears under "My open MRs" group
 * - MR authored AND reviewed by self → only in "My open MRs" (non-overlap)
 * - tokenLoading=true → skeleton (not "GitLab not connected")
 * - no gitlabBaseUrl/token → "GitLab not connected" empty state
 * - both groups empty → "No MRs awaiting review" empty state
 * - health badge: undefined → "Needs review", approved → "Approved", changes_requested → "Changes requested"
 */

// Mocks hoisted before imports (vitest hoisting requirement)
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn((sel?: (s: unknown) => unknown) => {
    const state = { gitlabUserId: MY_USER_ID };
    return sel ? sel(state) : state;
  }),
}));

vi.mock('@/services/gitlab', () => ({
  fetchAssignedMRs: vi.fn().mockResolvedValue([]),
  fetchReviewerMRs: vi.fn().mockResolvedValue([]),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitLabMR } from '@/services/gitlab';

// Must be a number — matches what useAuthStore returns
const MY_USER_ID = 42;
const BASE_URL = 'https://gitlab.example.com';
const TOKEN = 'test-gitlab-token';

const defaultProps = {
  gitlabBaseUrl: BASE_URL,
  gitlabToken: TOKEN,
  tokenLoading: false,
};

// ---------------------------------------------------------------------------
// MR factory
// ---------------------------------------------------------------------------

function makeMR(overrides: {
  iid: number;
  projectId?: number;
  authorId: number;
  reviewerIds?: number[];
  title?: string;
}): GitLabMR {
  return {
    id: overrides.iid,
    iid: overrides.iid,
    project_id: overrides.projectId ?? 1,
    title: overrides.title ?? `MR-${overrides.iid}`,
    source_branch: 'feature',
    state: 'opened',
    author: {
      id: overrides.authorId,
      name: `Author ${overrides.authorId}`,
      username: `user${overrides.authorId}`,
      avatar_url: '',
    },
    reviewers: (overrides.reviewerIds ?? []).map((id) => ({
      id,
      name: `User ${id}`,
      username: `user${id}`,
    })),
    updated_at: '2026-06-15T10:00:00Z',
    web_url: `https://gitlab.example.com/mr/${overrides.iid}`,
    labels: [],
    milestone: null,
  } as GitLabMR;
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderWithQuery(
  ui: React.ReactElement,
  {
    mrs,
    mrHealthEntries,
  }: {
    mrs?: GitLabMR[];
    mrHealthEntries?: Array<{ projectId: number; iid: number; status: string }>;
  } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  // Pre-seed the shared gitlab-mrs cache (same key as MrHealthPanel)
  if (mrs !== undefined) {
    queryClient.setQueryData(['gitlab-mrs', BASE_URL, MY_USER_ID], {
      filtered: mrs,
      merged: mrs,
    });
  }

  // Pre-seed per-MR health entries
  for (const entry of mrHealthEntries ?? []) {
    queryClient.setQueryData(['mr-health', entry.projectId, entry.iid], entry.status);
  }

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  );
}

async function importComponent() {
  const { default: MrReviewQueue } = await import('./MrReviewQueue');
  return MrReviewQueue;
}

// ---------------------------------------------------------------------------
// Tests — grouping
// ---------------------------------------------------------------------------

describe('MrReviewQueue — MR grouping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reviewer-only MR appears under "Awaiting my review"', async () => {
    const MrReviewQueue = await importComponent();
    const reviewerMr = makeMR({
      iid: 1,
      authorId: 99,
      reviewerIds: [MY_USER_ID],
      title: 'Reviewer MR',
    });

    renderWithQuery(<MrReviewQueue {...defaultProps} />, { mrs: [reviewerMr] });

    expect(screen.getByText('Awaiting my review')).toBeTruthy();
    expect(screen.getByText('Reviewer MR')).toBeTruthy();
  });

  it('authored MR appears under "My open MRs"', async () => {
    const MrReviewQueue = await importComponent();
    const authoredMr = makeMR({ iid: 2, authorId: MY_USER_ID, reviewerIds: [], title: 'My MR' });

    renderWithQuery(<MrReviewQueue {...defaultProps} />, { mrs: [authoredMr] });

    expect(screen.getByText('My open MRs')).toBeTruthy();
    expect(screen.getByText('My MR')).toBeTruthy();
  });

  it('self-authored AND reviewed MR appears only in "My open MRs" (non-overlap)', async () => {
    const MrReviewQueue = await importComponent();
    const selfMr = makeMR({
      iid: 3,
      authorId: MY_USER_ID,
      reviewerIds: [MY_USER_ID],
      title: 'Self MR',
    });

    renderWithQuery(<MrReviewQueue {...defaultProps} />, { mrs: [selfMr] });

    // "My open MRs" group renders
    expect(screen.getByText('My open MRs')).toBeTruthy();
    expect(screen.getByText('Self MR')).toBeTruthy();
    // "Awaiting my review" group should NOT have this MR (it is authored by self)
    // The group label may still render — but the title should appear only once
    const allTitleNodes = screen.queryAllByText('Self MR');
    expect(allTitleNodes).toHaveLength(1);
  });

  it('renders both groups when there is one reviewer MR and one authored MR', async () => {
    const MrReviewQueue = await importComponent();
    const reviewerMr = makeMR({
      iid: 4,
      authorId: 77,
      reviewerIds: [MY_USER_ID],
      title: 'Review This',
    });
    const authoredMr = makeMR({ iid: 5, authorId: MY_USER_ID, reviewerIds: [], title: 'My Work' });

    renderWithQuery(<MrReviewQueue {...defaultProps} />, { mrs: [reviewerMr, authoredMr] });

    expect(screen.getByText('Awaiting my review')).toBeTruthy();
    expect(screen.getByText('My open MRs')).toBeTruthy();
    expect(screen.getByText('Review This')).toBeTruthy();
    expect(screen.getByText('My Work')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Tests — health badges
// ---------------------------------------------------------------------------

describe('MrReviewQueue — health badges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('undefined health → "Needs review" badge', async () => {
    const MrReviewQueue = await importComponent();
    const reviewerMr = makeMR({
      iid: 10,
      authorId: 99,
      reviewerIds: [MY_USER_ID],
      title: 'Needs Review MR',
    });

    // No mr-health entry seeded → undefined → "Needs review"
    renderWithQuery(<MrReviewQueue {...defaultProps} />, { mrs: [reviewerMr] });

    expect(screen.getByText('Needs review')).toBeTruthy();
  });

  it('approved health → "Approved" badge', async () => {
    const MrReviewQueue = await importComponent();
    const reviewerMr = makeMR({
      iid: 11,
      authorId: 99,
      reviewerIds: [MY_USER_ID],
      title: 'Approved MR',
    });

    renderWithQuery(<MrReviewQueue {...defaultProps} />, {
      mrs: [reviewerMr],
      mrHealthEntries: [{ projectId: 1, iid: 11, status: 'approved' }],
    });

    expect(screen.getByText('Approved')).toBeTruthy();
  });

  it('changes_requested health → "Changes requested" badge', async () => {
    const MrReviewQueue = await importComponent();
    const reviewerMr = makeMR({
      iid: 12,
      authorId: 99,
      reviewerIds: [MY_USER_ID],
      title: 'Changes MR',
    });

    renderWithQuery(<MrReviewQueue {...defaultProps} />, {
      mrs: [reviewerMr],
      mrHealthEntries: [{ projectId: 1, iid: 12, status: 'changes_requested' }],
    });

    expect(screen.getByText('Changes requested')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Tests — empty states (DASH-07)
// ---------------------------------------------------------------------------

describe('MrReviewQueue — empty states (DASH-07)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tokenLoading=true → skeleton rows (NOT "GitLab not connected")', async () => {
    const MrReviewQueue = await importComponent();

    render(
      <MemoryRouter>
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <MrReviewQueue {...defaultProps} tokenLoading={true} />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(screen.queryByText('GitLab not connected')).toBeNull();
  });

  it('no gitlabBaseUrl → "GitLab not connected" empty state', async () => {
    const MrReviewQueue = await importComponent();

    render(
      <MemoryRouter>
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <MrReviewQueue gitlabBaseUrl="" gitlabToken="" tokenLoading={false} />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('GitLab not connected')).toBeTruthy();
  });

  it('no gitlabToken → "GitLab not connected" empty state', async () => {
    const MrReviewQueue = await importComponent();

    render(
      <MemoryRouter>
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <MrReviewQueue gitlabBaseUrl={BASE_URL} gitlabToken="" tokenLoading={false} />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('GitLab not connected')).toBeTruthy();
  });

  it('both groups empty → "No MRs awaiting review" empty state', async () => {
    const MrReviewQueue = await importComponent();

    // Empty mrs array — no MRs for either group
    renderWithQuery(<MrReviewQueue {...defaultProps} />, { mrs: [] });

    expect(screen.getByText('No MRs awaiting review')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Tests — region accessibility
// ---------------------------------------------------------------------------

describe('MrReviewQueue — region accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has role="region" with aria-label="MR review queue"', async () => {
    const MrReviewQueue = await importComponent();

    renderWithQuery(<MrReviewQueue {...defaultProps} />, { mrs: [] });

    const region = screen.getByRole('region', { name: /mr review queue/i });
    expect(region).toBeTruthy();
  });
});
