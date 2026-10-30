// P94-07: page-level layout/behaviour test for the full-width release detail page.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshReleaseDetail } from '@/lib/release-refresh';
import ReleaseDetailPage from './ReleaseDetailPage';
import { useReleaseDetail } from './release-detail/useReleaseDetail';

vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));
vi.mock('@/lib/useDetectedBrowsers', () => ({ useDetectedBrowsers: () => [] }));
vi.mock('@/lib/release-refresh', () => ({ refreshReleaseDetail: vi.fn() }));
vi.mock('./release-detail/useReleaseDetail', () => ({ useReleaseDetail: vi.fn() }));

// The real section needs an RM project and its own queries; this stand-in
// renders (and reports) rows on demand, like the real one does once loaded.
const pkg = vi.hoisted(() => ({ hasRows: false }));
vi.mock('./release-detail/DeploymentPackageSection', async () => {
  const { useLayoutEffect } = await import('react');
  return {
    DeploymentPackageSection: ({
      onHasRowsChange,
    }: {
      onHasRowsChange?: (hasRows: boolean) => void;
    }) => {
      useLayoutEffect(() => {
        onHasRowsChange?.(pkg.hasRows);
      }, [onHasRowsChange]);
      return pkg.hasRows ? <section data-testid="deployment-package-section" /> : null;
    },
  };
});

const mockRefresh = vi.mocked(refreshReleaseDetail);
const mockHook = vi.mocked(useReleaseDetail);

const mutation = { reset: vi.fn(), mutate: vi.fn(), isPending: false, error: null };

function makeIssue(key: string) {
  return {
    id: key,
    key,
    fields: {
      summary: 'Something',
      status: { id: '1', name: 'In Progress', statusCategory: { key: 'indeterminate' } },
      assignee: null,
      customfield_10016: null,
      issuetype: { name: 'Story', subtask: false },
    },
  };
}

function fixture(overrides: Record<string, unknown> = {}) {
  const issue = makeIssue('PROJ-1');
  return {
    version: {
      id: '123',
      name: '33.5.0',
      releaseDate: '2026-11-02',
      released: false,
      description: 'Jira desc',
    },
    isLoading: false,
    milestones: [],
    milestoneWindow: null,
    gitlabMatch: { type: 'none', candidateName: '', candidateUrl: '' },
    matchedMilestone: null,
    branchState: { kind: 'blocked-no-milestone' },
    mergeBackVerdict: { kind: 'hidden' },
    refetchBranchCheck: vi.fn(),
    releaseBranchName: null,
    defaultBranch: null,
    createBranchMutation: mutation,
    createMilestoneMutation: mutation,
    ownProjectMilestoneList: [],
    fixVersionIssues: [issue],
    isLoadingIssues: false,
    milestoneMRs: undefined,
    releaseIssues: [issue],
    releaseMrs: [],
    primaryRows: [{ issue, mrs: [] }],
    secondaryRows: [],
    flaggedMrCount: 0,
    brFlaggedCount: 0,
    msFlaggedCount: 0,
    isLoadingDrift: false,
    driftUnavailable: false,
    hasMatchedMilestone: false,
    milestonesFailed: false,
    milestoneLookup: 'resolved',
    labelSummary: [],
    labelCoverage: null,
    mrStateCounts: { merged: 0, opened: 0, closed: 0 },
    issueStatusCounts: { new: 0, indeterminate: 1, done: 0 },
    storyPoints: { total: 0, completed: 0 },
    hasStoryPoints: false,
    gitlabToken: null,
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
    gitlabBaseUrl: undefined,
    activeGitlabProject: null,
    storyPointsFieldKey: null,
    headerBreakdown: { done: 0, inProgress: 1, todo: 0, total: 1 },
    headerBreakdownLoading: false,
    headerBreakdownError: false,
    releasePackage: null,
    rmEnabled: false,
    rmLoading: false,
    rmError: false,
    previousVersion: null,
    burnupAxis: null,
    burnupPoints: [],
    assigneeRows: [],
    typeRows: [],
    statusNameSummary: null,
    mrDonutCounts: { merged: 0, open: 0, draft: 0, closed: 0 },
    issuesError: false,
    issuesUpdatedAt: 1_700_000_000_000,
    gitlabConfigured: false,
    today: '2026-10-30',
    ...overrides,
  };
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/release/123']}>
        <Routes>
          <Route path="/release/:versionId" element={<ReleaseDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function gitlabFixture() {
  return fixture({
    gitlabConfigured: true,
    gitlabBaseUrl: 'https://gitlab.example.com',
    activeGitlabProject: 42,
    gitlabMatch: { type: 'exact', milestone: { id: 1, title: '33.5.0' } },
    matchedMilestone: { id: 1, title: '33.5.0', description: 'MS desc' },
    milestoneMRs: [],
  });
}

beforeEach(() => {
  pkg.hasRows = false;
  mockRefresh.mockReset();
  mockRefresh.mockResolvedValue(undefined);
  mockHook.mockReturnValue(fixture() as never);
});

describe('ReleaseDetailPage', () => {
  it('renders header, done bar, graphs and table in DOM order', () => {
    const mr = { id: 1, state: 'merged', draft: false };
    mockHook.mockReturnValue({ ...gitlabFixture(), milestoneMRs: [mr], releaseMrs: [mr] } as never);
    renderPage();
    const ids = [
      'release-detail-header',
      'release-done-bar',
      'release-graph-burnup',
      'release-graph-mrs',
      'release-graph-assignees',
      'release-graph-types',
      'task-column-header',
    ];
    const els = ids.map((id) => screen.getByTestId(id));
    for (let i = 1; i < els.length; i++) {
      expect(
        els[i - 1].compareDocumentPosition(els[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it('has a single scroll ancestor above the table header and no sidebar', () => {
    renderPage();
    let node: HTMLElement | null = screen.getByTestId('task-column-header');
    const overflowing: string[] = [];
    while (node) {
      if (node.className.toString().includes('overflow-')) {
        overflowing.push(node.dataset.testid ?? node.className.toString());
      }
      node = node.parentElement;
    }
    expect(overflowing).toEqual(['release-detail-scroll']);
    expect(screen.getByTestId('release-detail-scroll').className).toContain('@container/page');
    expect(screen.queryByTestId('sidebar-descriptions')).toBeNull();
    expect(screen.queryByRole('separator')).toBeNull();
  });

  it('without GitLab: By status takes the MR slot, no milestone fact', () => {
    renderPage();
    expect(screen.queryByTestId('release-graph-mrs')).toBeNull();
    expect(screen.getByTestId('release-graph-status')).toBeInTheDocument();
    expect(screen.queryByTestId('release-fact-milestone')).toBeNull();
  });

  it('milestone without MRs: By status plus one friendly line, no dashed box', () => {
    mockHook.mockReturnValue(gitlabFixture() as never);
    renderPage();
    expect(screen.queryByTestId('release-graph-mrs')).toBeNull();
    expect(screen.getByTestId('release-graph-status')).toBeInTheDocument();
    expect(screen.getByTestId('release-mrs-none')).toHaveTextContent(
      'No merge requests in this milestone yet',
    );
  });

  // 94-REVIEW CR-01: a rejected milestone-MR fetch (Channel B) leaves
  // milestoneMRs undefined; it must render the error state, not a skeleton
  // that never resolves.
  it('a failed milestone-MR fetch shows the MR slot error, not a skeleton forever', () => {
    mockHook.mockReturnValue({
      ...gitlabFixture(),
      milestoneMRs: undefined,
      milestoneMrsFailed: true,
    } as never);
    renderPage();
    expect(screen.queryByTestId('release-graph-mrs-skeleton')).toBeNull();
    expect(screen.getByTestId('release-graph-mrs-error')).toHaveTextContent(
      "Couldn't load merge requests. Refresh to try again.",
    );
  });

  it('a milestone-MR fetch still in flight shows the MR slot skeleton', () => {
    mockHook.mockReturnValue({
      ...gitlabFixture(),
      milestoneMRs: undefined,
      milestoneMrsFailed: false,
    } as never);
    renderPage();
    expect(screen.getByTestId('release-graph-mrs-skeleton')).toBeInTheDocument();
  });

  // 94-REVIEW CR-02: an unmatched milestone only reads as Missing (with Create)
  // once the lookup resolved; while it is pending the fact says Loading.
  it('milestone lookup pending: no Missing label and no Create milestone action', () => {
    mockHook.mockReturnValue(
      fixture({
        gitlabConfigured: true,
        gitlabBaseUrl: 'https://gitlab.example.com',
        activeGitlabProject: 42,
        milestoneLookup: 'pending',
      }) as never,
    );
    renderPage();
    const fact = screen.getByTestId('release-fact-milestone');
    expect(fact).toHaveTextContent('Loading...');
    expect(fact).not.toHaveTextContent('Missing');
    expect(screen.queryByRole('button', { name: 'Create milestone' })).toBeNull();
  });

  it('milestone lookup resolved with no match: Missing plus Create milestone', () => {
    mockHook.mockReturnValue(
      fixture({
        gitlabConfigured: true,
        gitlabBaseUrl: 'https://gitlab.example.com',
        activeGitlabProject: 42,
        milestoneLookup: 'resolved',
      }) as never,
    );
    renderPage();
    expect(screen.getByTestId('release-fact-milestone')).toHaveTextContent('Missing');
    expect(screen.getByRole('button', { name: 'Create milestone' })).toBeInTheDocument();
  });

  it('no issues: one friendly empty state, no graphs, done bar or task table', () => {
    mockHook.mockReturnValue(
      fixture({ fixVersionIssues: [], releaseIssues: [], primaryRows: [] }) as never,
    );
    renderPage();
    expect(screen.getByTestId('release-no-issues')).toHaveTextContent(
      'No issues in this fix version yet',
    );
    expect(screen.queryByTestId('release-done-bar')).toBeNull();
    expect(screen.queryByTestId('release-graph-grid')).toBeNull();
    expect(screen.queryByTestId('task-column-header')).toBeNull();
  });

  // 94-REVIEW CR-03: an empty fix version must keep the action surfaces that do
  // not depend on its issues — the package fix list and uncovered MRs.
  it('no issues but uncovered MRs: the task table still renders, no empty notice', () => {
    const mr = {
      id: 7,
      iid: 7,
      project_id: 42,
      title: 'Unlinked change',
      source_branch: 'feature/x',
      target_branch: 'release/33.5.0',
      state: 'opened',
      draft: false,
      author: { id: 1, name: 'Alex Example', username: 'alex', avatar_url: '' },
      reviewers: [],
      updated_at: '2026-10-01T00:00:00Z',
      web_url: 'https://gitlab.example.com/mr/7',
      labels: [],
      milestone: null,
    };
    mockHook.mockReturnValue(
      fixture({
        fixVersionIssues: [],
        releaseIssues: [],
        primaryRows: [],
        secondaryRows: [
          {
            mr,
            channels: new Set(['C']),
            evaluated: true,
            br: 'ok',
            ms: 'ok',
            task: 'flag',
            taskReason: 'no-linked-task',
            taskKeys: [],
            flagged: false,
          },
        ],
      }) as never,
    );
    renderPage();
    expect(screen.queryByTestId('release-no-issues')).toBeNull();
    expect(screen.getByTestId('secondary-section')).toBeInTheDocument();
    expect(screen.getByText('No issues in this fix version')).toBeInTheDocument();
    expect(screen.queryByTestId('release-graph-grid')).toBeNull();
    expect(screen.queryByTestId('release-done-bar')).toBeNull();
  });

  it('no issues but package mismatches: the package section renders, no empty notice', () => {
    pkg.hasRows = true;
    mockHook.mockReturnValue(
      fixture({ fixVersionIssues: [], releaseIssues: [], primaryRows: [] }) as never,
    );
    renderPage();
    expect(screen.getByTestId('deployment-package-section')).toBeInTheDocument();
    expect(screen.queryByTestId('release-no-issues')).toBeNull();
    expect(screen.queryByTestId('release-graph-grid')).toBeNull();
  });

  it('shows no MR/status count text outside the graphs (D-06)', () => {
    mockHook.mockReturnValue(gitlabFixture() as never);
    renderPage();
    expect(screen.queryByText(/\d+ merged/)).toBeNull();
    expect(screen.queryByText(/\d+ in progress/)).toBeNull();
  });

  it('wide container: graphs form one band; narrow: 2x2 grid', () => {
    const RealRO = global.ResizeObserver;
    const withWidth = (width: number) =>
      class {
        constructor(private cb: ResizeObserverCallback) {}
        observe(target: Element) {
          this.cb(
            [{ target, contentRect: { width, height: 400 } } as ResizeObserverEntry],
            this as never,
          );
        }
        unobserve() {}
        disconnect() {}
      } as unknown as typeof ResizeObserver;
    global.ResizeObserver = withWidth(1300);
    const { unmount } = renderPage();
    expect(screen.getByTestId('release-graph-grid').className).toContain('items-stretch');
    unmount();
    global.ResizeObserver = withWidth(900);
    renderPage();
    expect(screen.getByTestId('release-graph-grid').className).not.toContain('items-stretch');
    global.ResizeObserver = RealRO;
  });

  // 94-REVIEW WR-02: the band/2x2 decision must be settled before the browser
  // paints. Rendered outside act(), the first DOM state a MutationObserver
  // (a microtask, i.e. before the next task could paint) sees is what paints.
  it('wide container: the first painted graph grid is already the band', async () => {
    const RealRO = global.ResizeObserver;
    global.ResizeObserver = class {
      constructor(private cb: ResizeObserverCallback) {}
      observe(target: Element) {
        this.cb(
          [{ target, contentRect: { width: 1300, height: 400 } } as ResizeObserverEntry],
          this as never,
        );
      }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const prevAct = g.IS_REACT_ACT_ENVIRONMENT;
    g.IS_REACT_ACT_ENVIRONMENT = false;
    const host = document.createElement('div');
    document.body.appendChild(host);
    let firstGridClass: string | null = null;
    const mo = new MutationObserver(() => {
      const grid = host.querySelector('[data-testid="release-graph-grid"]');
      if (grid && firstGridClass === null) firstGridClass = grid.className;
    });
    mo.observe(host, { childList: true, subtree: true, attributes: true });
    const root = createRoot(host);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    try {
      root.render(
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={['/release/123']}>
            <Routes>
              <Route path="/release/:versionId" element={<ReleaseDetailPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
      await waitFor(() => expect(firstGridClass).not.toBeNull());
      await new Promise((r) => setTimeout(r, 20));
      expect(firstGridClass).toContain('items-stretch');
    } finally {
      mo.disconnect();
      root.unmount();
      host.remove();
      g.IS_REACT_ACT_ENVIRONMENT = prevAct;
      global.ResizeObserver = RealRO;
    }
  });

  it('has no separate Labels row; labels live in the Merge requests cell', () => {
    const mr = { id: 1, iid: 1, title: 't', state: 'merged', draft: false, labels: [] };
    mockHook.mockReturnValue({
      ...gitlabFixture(),
      milestoneMRs: [mr],
      releaseMrs: [mr],
      labelSummary: [
        { label: { name: 'backend', color: '#428BCA', text_color: '#fff' }, count: 1 },
      ],
      labelCoverage: { total: 1, labeled: 1, unlabeled: [], allLabeled: true },
    } as never);
    renderPage();
    expect(screen.queryByTestId('label-summary-section')).toBeNull();
    expect(screen.queryByText('Labels')).toBeNull();
    expect(screen.getByTestId('release-graph-mrs')).toContainElement(
      screen.getByTestId('mr-labels'),
    );
  });

  it('shows no label line when By status replaces the MR cell', () => {
    mockHook.mockReturnValue({
      ...fixture(),
      labelSummary: [
        { label: { name: 'backend', color: '#428BCA', text_color: '#fff' }, count: 1 },
      ],
    } as never);
    renderPage();
    expect(screen.getByTestId('release-graph-status')).toBeInTheDocument();
    expect(screen.queryByTestId('mr-labels')).toBeNull();
  });

  it('every clickable element on the page gets a pointer cursor from the page wrapper', () => {
    renderPage();
    const cls = screen.getByTestId('release-detail-scroll').className;
    expect(cls).toContain('[&_button:not(:disabled)]:cursor-pointer');
    expect(cls).toContain('[&_a[href]]:cursor-pointer');
    expect(cls).toContain('[&_[role=button]]:cursor-pointer');
  });

  it('opens the edit modal from Edit release', async () => {
    renderPage();
    fireEvent.click(screen.getByText('Edit release'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('refresh calls refreshReleaseDetail and disables the button while running', async () => {
    let resolve: () => void = () => {};
    mockRefresh.mockReturnValue(new Promise<void>((r) => (resolve = r)));
    renderPage();
    const btn = screen.getByLabelText('Refresh release');
    fireEvent.click(btn);
    await waitFor(() => expect(btn).toBeDisabled());
    expect(mockRefresh).toHaveBeenCalledWith(expect.anything(), {
      activeJiraProject: 'PROJ',
      activeGitlabProject: null,
      versionId: '123',
    });
    resolve();
    await waitFor(() => expect(btn).not.toBeDisabled());
  });

  it('shows Refreshed time from issuesUpdatedAt', () => {
    renderPage();
    expect(screen.getByText(/^Refreshed: /)).toBeInTheDocument();
  });

  it('renders the skeleton while loading or without a version', () => {
    mockHook.mockReturnValue(fixture({ isLoading: true }) as never);
    const { unmount } = renderPage();
    expect(screen.getByTestId('release-detail-skeleton')).toBeInTheDocument();
    unmount();
    mockHook.mockReturnValue(fixture({ version: null }) as never);
    renderPage();
    expect(screen.getByTestId('release-detail-skeleton')).toBeInTheDocument();
  });
});
