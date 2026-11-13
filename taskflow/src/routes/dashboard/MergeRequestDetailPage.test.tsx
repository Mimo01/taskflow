import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';

const authState = { gitlabBaseUrl: 'https://gitlab.example.com' };
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: (sel?: (s: typeof authState) => unknown) => (sel ? sel(authState) : authState),
}));
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('fake-token'),
}));
vi.mock('@/lib/useDetectedBrowsers', () => ({ useDetectedBrowsers: () => [] }));
vi.mock('@/lib/openExternal', () => ({ openExternal: vi.fn() }));
vi.mock('./WikiRenderer', () => ({
  WikiRenderer: ({ wikiText }: { wikiText?: string | null }) => <span>{wikiText ?? ''}</span>,
}));
vi.mock('@/services/gitlab', () => ({
  fetchMRDetail: vi.fn(),
  fetchMRCommits: vi.fn().mockResolvedValue([]),
  fetchMRApprovals: vi.fn().mockResolvedValue({ approved_by: [], approved: false }),
  fetchMRDiscussions: vi.fn().mockResolvedValue([]),
  fetchMRChanges: vi.fn().mockResolvedValue([]),
}));

import { openExternal } from '@/lib/openExternal';
import { fetchMRDetail } from '@/services/gitlab';
import MergeRequestDetailPage from './MergeRequestDetailPage';

const mr = {
  id: 1,
  iid: 42,
  project_id: 7,
  title: 'Fix the flux capacitor',
  description: 'Body text',
  source_branch: 'feature/PROJ-1',
  target_branch: 'main',
  state: 'opened',
  draft: false,
  author: { id: 1, name: 'Ada', username: 'ada', avatar_url: '' },
  assignee: null,
  reviewers: [],
  labels: [],
  milestone: null,
  pipeline: null,
  has_conflicts: false,
  changes_count: '3',
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-02T10:00:00Z',
  merged_at: null,
  closed_at: null,
  web_url: 'https://gitlab.example.com/g/p/-/merge_requests/42',
};

// The shared ResizeObserver mock reports 600px (< 720 = tiny): the primary pair is then in ⋯.
function stubWidth(width: number) {
  class RO {
    constructor(private cb: ResizeObserverCallback) {}
    observe() {
      this.cb([{ contentRect: { width } } as ResizeObserverEntry], this as never);
    }
    disconnect() {}
    unobserve() {}
  }
  vi.stubGlobal('ResizeObserver', RO);
}

let client: QueryClient;
function renderPage() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/mr/7/42']}>
        <Routes>
          <Route element={<Outlet context={{ onIssueClick: vi.fn() }} />}>
            <Route path="/mr/:projectId/:iid" element={<MergeRequestDetailPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  stubWidth(1100);
  useBreadcrumbStore.setState({ trail: [] });
  vi.mocked(fetchMRDetail).mockReset();
  vi.mocked(fetchMRDetail).mockResolvedValue(mr as never);
  vi.mocked(openExternal).mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe('MergeRequestDetailPage header', () => {
  it('shows one h1 with the MR title and the !iid identity in the meta row', async () => {
    renderPage();
    const h1 = await screen.findByRole('heading', { level: 1, name: 'Fix the flux capacitor' });
    const key = screen.getByText('!42');
    expect(key.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The state badge sits in the meta row after the key.
    expect(key.compareDocumentPosition(screen.getByText('Open'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('keeps the header outside the left scroller, so it spans content and sidebar', async () => {
    renderPage();
    const h1 = await screen.findByRole('heading', { level: 1 });
    expect(screen.getByTestId('mr-detail-scroll').contains(h1)).toBe(false);
    expect(screen.getByTestId('mr-detail-scroll').className).toContain('relative');
  });

  it('has Open in GitLab as a filled primary action outside the toolbar', async () => {
    renderPage();
    const open = await screen.findByRole('button', { name: 'Open in GitLab' });
    expect(
      within(screen.getByRole('toolbar')).queryByRole('button', { name: 'Open in GitLab' }),
    ).toBeNull();
    await userEvent.click(open);
    expect(openExternal).toHaveBeenCalledWith(mr.web_url);
    expect(screen.getByRole('button', { name: 'Copy GitLab link' })).toBeInTheDocument();
  });

  it('has no Pin tool, and Refresh invalidates the MR queries', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: /^Pin/ })).toBeNull();
    expect(fetchMRDetail).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Refresh merge request' }));
    await waitFor(() => expect(fetchMRDetail).toHaveBeenCalledTimes(2));
  });
});
