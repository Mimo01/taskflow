import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => ({
    storyPointsFieldKey: 'customfield_10016',
    epicLinkFieldKey: 'customfield_10014',
    epicNameFieldKey: 'customfield_10015',
    epicColorFieldKey: 'customfield_10013',
  }),
}));
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
  }),
}));
vi.mock('@/services/jira', () => ({
  fetchEpicsBasic: vi.fn(),
  fetchEpicEnrichmentMap: vi.fn(),
}));
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function baseEpic(overrides: Record<string, unknown> = {}) {
  return {
    key: 'PROJ-10',
    epicName: 'Epic Alpha',
    summary: 'Epic Alpha',
    status: {
      name: 'In Progress',
      statusCategory: { key: 'indeterminate', name: 'In Progress' },
    },
    assignee: null,
    priority: null,
    totalStories: 0,
    doneStories: 0,
    totalPoints: 0,
    color: null,
    ...overrides,
  };
}

function renderEpicsPage(onEpicClick?: (key: string) => void) {
  return render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter>
        <Routes>
          <Route element={<Outlet context={{ onEpicClick }} />}>
            <Route path="/" element={<EpicsPageLazy />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// Lazily resolved so vi.mock hoisting works with dynamic import per-test, but
// keep a stable synchronous component reference for render().
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let EpicsPageLazy: any = () => null;

describe('EpicsPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { readSecret } = await import('@/services/stronghold');
    (readSecret as ReturnType<typeof vi.fn>).mockResolvedValue('test-jira-token');
    const { default: EpicsPage } = await import('./EpicsPage');
    EpicsPageLazy = EpicsPage;
  });

  it('EPIC-01: renders epics in the order returned by fetchEpicsBasic and the order is unchanged after enrichment resolves', async () => {
    const { fetchEpicsBasic, fetchEpicEnrichmentMap } = await import('@/services/jira');
    (fetchEpicsBasic as ReturnType<typeof vi.fn>).mockResolvedValue([
      baseEpic({ key: 'PROJ-30', epicName: 'Epic C' }),
      baseEpic({ key: 'PROJ-10', epicName: 'Epic A' }),
      baseEpic({ key: 'PROJ-20', epicName: 'Epic B' }),
    ]);
    (fetchEpicEnrichmentMap as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Map([
        ['PROJ-30', { total: 2, done: 1, inProgress: 1, todo: 0, points: 5, donePoints: 2 }],
        ['PROJ-10', { total: 1, done: 0, inProgress: 0, todo: 1, points: 3, donePoints: 0 }],
        ['PROJ-20', { total: 0, done: 0, inProgress: 0, todo: 0, points: 0, donePoints: 0 }],
      ]),
    );
    renderEpicsPage();

    await screen.findByText('PROJ-30');
    const keysBefore = screen.getAllByText(/^PROJ-\d+$/).map((el) => el.textContent);
    expect(keysBefore).toEqual(['PROJ-30', 'PROJ-10', 'PROJ-20']);

    await waitFor(() => expect(screen.getAllByText('No stories').length).toBeGreaterThan(0));
    const keysAfter = screen.getAllByText(/^PROJ-\d+$/).map((el) => el.textContent);
    expect(keysAfter).toEqual(['PROJ-30', 'PROJ-10', 'PROJ-20']);
  });

  it('EPIC-02: renders row columns in order key, priority, name, status, progress, points, assignee', async () => {
    const { fetchEpicsBasic, fetchEpicEnrichmentMap } = await import('@/services/jira');
    (fetchEpicsBasic as ReturnType<typeof vi.fn>).mockResolvedValue([
      baseEpic({ priority: { name: 'Must', iconUrl: 'https://jira.example.com/icons/must.svg' } }),
    ]);
    (fetchEpicEnrichmentMap as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Map([
        ['PROJ-10', { total: 10, done: 5, inProgress: 3, todo: 2, points: 20, donePoints: 8 }],
      ]),
    );
    renderEpicsPage();

    const keyEl = await screen.findByText('PROJ-10');
    const row = keyEl.closest('.flex.w-full.items-center') as HTMLElement;
    expect(row).toBeTruthy();
    expect(row.children).toHaveLength(7);

    // Assert the full settled column order, cell by cell — the previous version
    // only checked key-before-name, which passed under any arrangement of the
    // remaining five columns. Priority sits between key and name (UAT).
    const cells = Array.from(row.children) as HTMLElement[];
    expect(cells[0]).toHaveTextContent('PROJ-10');
    expect(cells[1].querySelector('img')).toHaveAttribute('alt', 'Priority: Must');
    expect(cells[2]).toHaveTextContent('Epic Alpha');
    expect(cells[3]).toHaveTextContent('In Progress');
    expect(cells[4]).toHaveTextContent('5/10');
    expect(cells[5]).toHaveTextContent('8/20 SP');
  });

  it('EPIC-04: renders the priority icon with the priority name', async () => {
    const { fetchEpicsBasic, fetchEpicEnrichmentMap } = await import('@/services/jira');
    (fetchEpicsBasic as ReturnType<typeof vi.fn>).mockResolvedValue([
      baseEpic({
        priority: { name: 'Must', iconUrl: 'https://jira.example.com/icons/must.svg' },
      }),
    ]);
    (fetchEpicEnrichmentMap as ReturnType<typeof vi.fn>).mockResolvedValue(new Map());
    renderEpicsPage();

    const img = await screen.findByAltText('Priority: Must');
    expect(img).toHaveAttribute('src', 'https://jira.example.com/icons/must.svg');
  });

  it('EPIC-03: progress and points cells shimmer while the enrichment query is in flight', async () => {
    const { fetchEpicsBasic, fetchEpicEnrichmentMap } = await import('@/services/jira');
    (fetchEpicsBasic as ReturnType<typeof vi.fn>).mockResolvedValue([baseEpic()]);
    (fetchEpicEnrichmentMap as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    renderEpicsPage();

    expect(await screen.findByText('PROJ-10')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByTestId('epic-progress-pending')).toBeInTheDocument();
    expect(screen.getByTestId('epic-points-pending')).toBeInTheDocument();
  });

  it('EPIC-03/EPIC-05: renders the segmented breakdown and done/total once enrichment resolves', async () => {
    const { fetchEpicsBasic, fetchEpicEnrichmentMap } = await import('@/services/jira');
    (fetchEpicsBasic as ReturnType<typeof vi.fn>).mockResolvedValue([baseEpic()]);
    (fetchEpicEnrichmentMap as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Map([
        ['PROJ-10', { total: 10, done: 5, inProgress: 3, todo: 2, points: 20, donePoints: 8 }],
      ]),
    );
    renderEpicsPage();

    expect(await screen.findByText('5/10')).toBeInTheDocument();
    expect(screen.getByTestId('epic-progress-bar')).toHaveAttribute(
      'title',
      '5 Done · 3 In Progress · 2 To Do',
    );
  });

  it('EPIC-06: renders story points as done/total SP', async () => {
    const { fetchEpicsBasic, fetchEpicEnrichmentMap } = await import('@/services/jira');
    (fetchEpicsBasic as ReturnType<typeof vi.fn>).mockResolvedValue([baseEpic()]);
    (fetchEpicEnrichmentMap as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Map([
        ['PROJ-10', { total: 10, done: 5, inProgress: 3, todo: 2, points: 20, donePoints: 8 }],
      ]),
    );
    renderEpicsPage();

    expect(await screen.findByText('8/20 SP')).toBeInTheDocument();
  });

  it('EPIC-03: renders "no stories" for an epic missing from the enrichment map', async () => {
    const { fetchEpicsBasic, fetchEpicEnrichmentMap } = await import('@/services/jira');
    (fetchEpicsBasic as ReturnType<typeof vi.fn>).mockResolvedValue([baseEpic()]);
    (fetchEpicEnrichmentMap as ReturnType<typeof vi.fn>).mockResolvedValue(new Map());
    renderEpicsPage();

    expect(await screen.findByText('No stories')).toBeInTheDocument();
  });

  it('EPIC-03: renders a retry affordance when the enrichment query fails', async () => {
    const { fetchEpicsBasic, fetchEpicEnrichmentMap } = await import('@/services/jira');
    (fetchEpicsBasic as ReturnType<typeof vi.fn>).mockResolvedValue([baseEpic()]);
    (fetchEpicEnrichmentMap as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('enrichment failed'),
    );
    renderEpicsPage();

    const retryButton = await screen.findByTestId('epic-progress-retry');
    expect(fetchEpicEnrichmentMap).toHaveBeenCalledTimes(1);
    fireEvent.click(retryButton);
    await waitFor(() =>
      expect(fetchEpicEnrichmentMap as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(2),
    );
  });

  it('EPIC-07: row click still calls onEpicClick and the retry click does not', async () => {
    const { fetchEpicsBasic, fetchEpicEnrichmentMap } = await import('@/services/jira');
    (fetchEpicsBasic as ReturnType<typeof vi.fn>).mockResolvedValue([baseEpic()]);
    (fetchEpicEnrichmentMap as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('enrichment failed'),
    );
    const onEpicClick = vi.fn();
    renderEpicsPage(onEpicClick);

    const retryButton = await screen.findByTestId('epic-progress-retry');
    fireEvent.click(retryButton);
    expect(onEpicClick).not.toHaveBeenCalled();

    const keyEl = screen.getByText('PROJ-10');
    const row = keyEl.closest('.flex.w-full.items-center') as HTMLElement;
    fireEvent.click(row);
    expect(onEpicClick).toHaveBeenCalledWith('PROJ-10');
  });

  it('EPIC-07: renders no search input on the page', async () => {
    const { fetchEpicsBasic, fetchEpicEnrichmentMap } = await import('@/services/jira');
    (fetchEpicsBasic as ReturnType<typeof vi.fn>).mockResolvedValue([baseEpic()]);
    (fetchEpicEnrichmentMap as ReturnType<typeof vi.fn>).mockResolvedValue(new Map());
    renderEpicsPage();

    await screen.findByText('PROJ-10');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
    expect(screen.getByText('+ Create Epic')).toBeInTheDocument();
  });

  it('EPIC-01: shows empty state when no epics returned', async () => {
    const { fetchEpicsBasic } = await import('@/services/jira');
    (fetchEpicsBasic as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    renderEpicsPage();
    expect(await screen.findByText(/no epics/i)).toBeInTheDocument();
  });

  it('CR-01: stale-banner retry clears the skeleton once the refetch succeeds', async () => {
    const { fetchEpicsBasic, fetchEpicEnrichmentMap } = await import('@/services/jira');
    (fetchEpicsBasic as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('epics failed'))
      .mockResolvedValue([baseEpic()]);
    (fetchEpicEnrichmentMap as ReturnType<typeof vi.fn>).mockResolvedValue(new Map());

    // Cached data + a failed refetch is what surfaces StaleDataBanner. This is
    // the path where isLoading never transitions: isPending is false because
    // data exists, so an isLoading-keyed reset effect never re-runs and
    // isRefreshing pins the skeleton on forever.
    const client = makeClient();
    client.setQueryData(['jira-epics-basic', 'PROJ', 'https://jira.example.com'], [baseEpic()]);
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Routes>
            <Route element={<Outlet context={{}} />}>
              <Route path="/" element={<EpicsPageLazy />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const retry = await screen.findByRole('button', { name: /retry|try again/i });
    fireEvent.click(retry);

    await waitFor(() => expect(screen.getByText('PROJ-10')).toBeInTheDocument());
    expect(screen.queryByTestId('epics-skeleton')).not.toBeInTheDocument();
  });

  it('CR-02: shows a retryable error, not an endless shimmer, when the token is unavailable', async () => {
    const { readSecret } = await import('@/services/stronghold');
    (readSecret as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('no secret'));
    const { fetchEpicsBasic, fetchEpicEnrichmentMap } = await import('@/services/jira');
    (fetchEpicsBasic as ReturnType<typeof vi.fn>).mockResolvedValue([baseEpic()]);
    (fetchEpicEnrichmentMap as ReturnType<typeof vi.fn>).mockResolvedValue(new Map());

    // Rows render from the shared cache even though no token is available.
    const client = makeClient();
    client.setQueryData(['jira-epics-basic', 'PROJ', 'https://jira.example.com'], [baseEpic()]);
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Routes>
            <Route element={<Outlet context={{}} />}>
              <Route path="/" element={<EpicsPageLazy />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('PROJ-10')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('epic-progress-retry')).toBeInTheDocument());
    expect(screen.queryByTestId('epic-progress-pending')).not.toBeInTheDocument();
  });
});
