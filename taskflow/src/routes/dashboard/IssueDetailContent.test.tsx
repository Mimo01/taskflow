// Phase 77 Plan 02 — DETAIL-01 and DETAIL-02 tests.
// Requirements covered: DETAIL-01, DETAIL-02

// --- Mocks (hoisted before imports) ---

vi.mock('@/services/jira', () => ({
  fetchIssueDetail: vi.fn(),
  // Epic progress section lazy queries (261001-ilq)
  fetchEpicWorklogs: vi.fn().mockResolvedValue(new Map()),
  fetchEpicStatusHistory: vi.fn().mockResolvedValue(new Map()),
  fetchAllJiraStatuses: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn((sel?: (s: unknown) => unknown) => {
    const state = { jiraBaseUrl: 'https://jira.example.com', jiraConnected: true };
    return sel ? sel(state) : state;
  }),
}));

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn((sel?: (s: unknown) => unknown) => {
    const state = {
      storyPointsFieldKey: 'story_points',
      epicLinkFieldKey: 'epic_link',
      sprintFieldKey: 'sprint',
    };
    return sel ? sel(state) : state;
  }),
}));

vi.mock('@/services/jira/attachments', () => ({
  deleteAttachment: vi.fn(),
}));

vi.mock('./issue-detail/LogWorkPopover', () => ({
  LogWorkPopover: () => null,
}));

vi.mock('./issue-detail/AttachmentsSection', () => ({
  AttachmentsSection: () => null,
}));

vi.mock('@/hooks/useMentionUserMap', () => ({
  useMentionUserMap: () => ({}),
}));

vi.mock('./WikiRenderer', () => ({
  WikiRenderer: ({ wikiText }: { wikiText: string }) => <div>{wikiText}</div>,
}));

vi.mock('./BulkCreateSubtasksModal', () => ({
  BulkCreateSubtasksModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="bulk-modal" /> : null,
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(),
}));

// --- Imports ---

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { IssueDetailContent } from './IssueDetailContent';

// --- Fixture helpers ---

function makeSubtaskIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: 'issue-1',
    key: 'PROJ-10',
    fields: {
      summary: 'A subtask issue',
      description: '',
      issuetype: { name: 'Sub-task', subtask: true },
      status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
      assignee: null,
      reporter: null,
      priority: null,
      attachment: [],
      subtasks: [],
      issuelinks: [],
      parent: {
        id: '100',
        key: 'PROJ-0',
        fields: { summary: 'Parent story' },
      },
      ...overrides,
    },
  } as never;
}

function makeStoryIssue(subtasks: unknown[] = []) {
  return {
    id: 'issue-2',
    key: 'PROJ-20',
    fields: {
      summary: 'A story issue',
      description: '',
      issuetype: { name: 'Story', subtask: false },
      status: { name: 'To Do', statusCategory: { key: 'new' } },
      assignee: null,
      reporter: null,
      priority: null,
      attachment: [],
      subtasks,
      issuelinks: [],
    },
  } as never;
}

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const rowTexts = () =>
  [...document.querySelectorAll('[data-slot="tooltip-row"]')].map((r) => r.textContent);

describe('IssueDetailContent', () => {
  describe('refresh button', () => {
    const base = {
      issue: makeSubtaskIssue(),
      issueKey: 'PROJ-10',
      jiraBaseUrl: 'https://jira.example.com',
      storyPointsFieldKey: 'story_points',
      sprintFieldKey: 'sprint',
      epicLinkFieldKey: 'epic_link',
    };

    it('renders before Pin and calls onRefresh on click', async () => {
      const onRefresh = vi.fn();
      render(<IssueDetailContent {...base} onTogglePin={vi.fn()} onRefresh={onRefresh} />, {
        wrapper,
      });
      const btn = screen.getByRole('button', { name: 'Refresh issue' });
      const pin = screen.getByRole('button', { name: /Pin issue PROJ-10/ });
      expect(btn.compareDocumentPosition(pin) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      await userEvent.click(btn);
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('spins and disables while refreshing', () => {
      const { rerender } = render(<IssueDetailContent {...base} onRefresh={vi.fn()} refreshing />, {
        wrapper,
      });
      const btn = screen.getByRole('button', { name: 'Refresh issue' });
      expect(btn).toBeDisabled();
      expect(btn.querySelector('svg')).toHaveClass('animate-spin');
      rerender(<IssueDetailContent {...base} onRefresh={vi.fn()} refreshing={false} />);
      expect(
        screen.getByRole('button', { name: 'Refresh issue' }).querySelector('svg'),
      ).not.toHaveClass('animate-spin');
    });

    it('is absent without onRefresh', () => {
      render(<IssueDetailContent {...base} />, { wrapper });
      expect(screen.queryByRole('button', { name: 'Refresh issue' })).toBeNull();
    });
  });

  it('title defaults to text-xl and honours titleClassName', () => {
    const props = {
      issue: makeSubtaskIssue(),
      issueKey: 'PROJ-10',
      jiraBaseUrl: 'https://jira.example.com',
      storyPointsFieldKey: 'story_points',
      sprintFieldKey: 'sprint',
      epicLinkFieldKey: 'epic_link',
    };
    const { unmount } = render(<IssueDetailContent {...props} />, { wrapper });
    const title = screen.getByRole('heading', { level: 2, name: 'A subtask issue' });
    expect(title).toHaveClass('text-xl');
    unmount();
    render(<IssueDetailContent {...props} titleClassName="text-2xl" />, { wrapper });
    const title2 = screen.getByRole('heading', { level: 2, name: 'A subtask issue' });
    expect(title2).toHaveClass('text-2xl');
    expect(title2).not.toHaveClass('text-xl');
  });

  // DETAIL-01: for a subtask fixture with fields.parent, a clickable parent card with the
  //            parent key + summary renders in the relationships region (replaced the old
  //            breadcrumb-above-title; see quick-260606-ugr redesign).
  it('DETAIL-01: for a subtask fixture with fields.parent, a clickable parent card with the parent key renders', () => {
    const onOpenIssue = vi.fn();
    const issue = makeSubtaskIssue();

    render(
      <IssueDetailContent
        issue={issue}
        issueKey="PROJ-10"
        jiraBaseUrl="https://jira.example.com"
        storyPointsFieldKey="story_points"
        sprintFieldKey="sprint"
        epicLinkFieldKey="epic_link"
        onOpenIssue={onOpenIssue}
      />,
      { wrapper },
    );

    // Parent key + summary render inside the clickable parent card.
    expect(screen.getByText('PROJ-0')).toBeTruthy();
    expect(screen.getByText('Parent story')).toBeTruthy();

    // The card is a button wired to open the parent issue.
    const parentBtn = screen.getByLabelText('Open parent issue PROJ-0');
    fireEvent.click(parentBtn);
    expect(onOpenIssue).toHaveBeenCalledWith('PROJ-0');
  });

  // DETAIL-01: parent now renders as a labelled "Parent" section in the relationships region
  // (the redesign added a prominent parent card; it is no longer a breadcrumb above the title).
  it('DETAIL-01: parent section renders for a subtask', () => {
    const issue = makeSubtaskIssue();

    render(
      <IssueDetailContent
        issue={issue}
        issueKey="PROJ-10"
        jiraBaseUrl="https://jira.example.com"
        storyPointsFieldKey="story_points"
        sprintFieldKey="sprint"
        epicLinkFieldKey="epic_link"
      />,
      { wrapper },
    );

    // The "Parent" section heading now renders by design.
    const parentLabel = screen.queryByText('Parent', { exact: true });
    expect(parentLabel).not.toBeNull();
  });

  // DETAIL-02: subtask row buttons carry the cursor-pointer class
  it('DETAIL-02: subtask row buttons carry the cursor-pointer class', () => {
    const subtasks = [
      {
        id: 'sub-1',
        key: 'PROJ-11',
        fields: {
          summary: 'First subtask',
          status: { name: 'To Do', statusCategory: { key: 'new' } },
        },
      },
    ];
    const issue = makeStoryIssue(subtasks);

    render(
      <IssueDetailContent
        issue={issue}
        issueKey="PROJ-20"
        jiraBaseUrl="https://jira.example.com"
        storyPointsFieldKey="story_points"
        sprintFieldKey="sprint"
        epicLinkFieldKey="epic_link"
        enrichedSubtasks={subtasks as never}
      />,
      { wrapper },
    );

    // Find the subtask button (contains the subtask key)
    const subtaskBtn = screen.getByText('PROJ-11').closest('button');
    expect(subtaskBtn).toBeTruthy();
    expect(subtaskBtn?.className).toContain('cursor-pointer');
  });

  describe('Stories list mini time bars (261001-hsz)', () => {
    function epicIssue() {
      return {
        id: 'epic-1',
        key: 'PROJ-30',
        fields: {
          summary: 'An epic',
          description: '',
          issuetype: { name: 'Epic', subtask: false },
          status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
          assignee: null,
          reporter: null,
          priority: null,
          attachment: [],
          subtasks: [],
          issuelinks: [],
        },
      } as never;
    }
    function epicStory(
      key: string,
      cat: 'new' | 'indeterminate' | 'done',
      o: { est?: number; spent?: number; rem?: number },
    ) {
      return {
        id: key,
        key,
        fields: {
          summary: `Story ${key}`,
          status: { name: cat === 'done' ? 'Closed' : 'Open', statusCategory: { key: cat } },
          assignee: null,
          issuetype: { name: 'Story', subtask: false },
          aggregatetimeoriginalestimate: o.est,
          timeoriginalestimate: o.est,
          aggregatetimespent: o.spent,
          aggregatetimeestimate: o.rem,
        },
      };
    }
    /** data-segment → width (%) of the shared TimeBar inside a story row. */
    function segs(bar: HTMLElement): Record<string, number> {
      return Object.fromEntries(
        [...bar.querySelectorAll<HTMLElement>('[data-segment]')].map((el) => [
          el.getAttribute('data-segment'),
          Number.parseFloat(el.style.width),
        ]),
      );
    }
    function renderEpic(stories: unknown[], onOpenIssue = vi.fn()) {
      render(
        <IssueDetailContent
          issue={epicIssue()}
          issueKey="PROJ-30"
          jiraBaseUrl="https://jira.example.com"
          storyPointsFieldKey="story_points"
          sprintFieldKey="sprint"
          epicLinkFieldKey="epic_link"
          epicStories={stories as never}
          onOpenIssue={onOpenIssue}
        />,
        { wrapper },
      );
      return onOpenIssue;
    }

    it('fills proportionally and stays non-interactive inside the row button', () => {
      const onOpen = renderEpic([epicStory('S-1', 'new', { est: 7200, spent: 3600 })]);
      const bar = screen.getByTestId('story-time-bar');
      expect(bar.tagName).toBe('SPAN');
      expect(bar).not.toHaveAttribute('data-overrun');
      expect(bar).not.toHaveAttribute('data-empty');
      // To do, 2h estimate, 1h logged, 1h left: solid logged half, faint remaining half.
      expect(segs(bar)).toEqual({ 'new:logged': 50, 'new:remaining': 50 });
      // Under the estimate the track itself ends at the estimate: no tick (261105-dsl A).
      expect(within(bar).queryByTestId('time-estimate-tick')).toBeNull();
      const row = bar.closest('button') as HTMLElement;
      expect(bar.hasAttribute('tabindex')).toBe(false);
      expect(row.querySelectorAll('button')).toHaveLength(0);
      fireEvent.click(row);
      expect(onOpen).toHaveBeenCalledWith('S-1');
    });

    it('shows logged beyond the estimate as a red over segment (past 125%)', () => {
      renderEpic([epicStory('S-1', 'new', { est: 3600, spent: 7200 })]);
      const bar = screen.getByTestId('story-time-bar');
      expect(bar).toHaveAttribute('data-overrun', 'true');
      expect(segs(bar)).toEqual({ 'new:logged': 50, 'new:loggedOver': 50 });
      const over = bar.querySelector('[data-segment="new:loggedOver"]') as HTMLElement;
      expect(over.className).toContain('bg-red-500');
      const tick = within(bar).getByTestId('time-estimate-tick');
      expect(tick).toHaveAttribute('data-pct', '50');
    });

    it('the estimate tick sits outside the rounded clip (not cut off)', () => {
      // 2h estimate, 1h logged, 3h left → forecast 4h, tick at 50%.
      renderEpic([epicStory('S-1', 'indeterminate', { est: 7200, spent: 3600, rem: 10800 })]);
      const bar = screen.getByTestId('story-time-bar');
      const tick = within(bar).getByTestId('time-estimate-tick');
      expect(tick).toHaveAttribute('data-pct', '50');
      expect(tick.closest('.overflow-hidden')).toBeNull();
    });

    it('overspend within 125% of the estimate is amber', () => {
      renderEpic([epicStory('S-1', 'indeterminate', { est: 7200, spent: 8100, rem: 0 })]);
      const bar = screen.getByTestId('story-time-bar');
      const over = bar.querySelector('[data-segment="indeterminate:loggedOver"]') as HTMLElement;
      expect(over.className).toContain('bg-amber-500');
    });

    it('names the overrun in the tooltip, not only by colour', async () => {
      const user = userEvent.setup();
      renderEpic([epicStory('S-1', 'new', { est: 3600, spent: 7200 })]);
      await user.hover(screen.getByTestId('story-time-bar'));
      expect(await screen.findByText('Over by')).toBeInTheDocument();
      expect(rowTexts()).toEqual(['Estimate1h', 'Logged2h', 'Remaining0m', 'Over by1h']);
    });

    it('fills logged / (logged + remaining) with a tick at the estimate when the forecast overruns (261103-lcd)', async () => {
      const user = userEvent.setup();
      // 2h estimate, 30m logged, Jira remaining 3h → total 3h 30m, forecast 1h 30m over.
      renderEpic([epicStory('S-1', 'indeterminate', { est: 7200, spent: 1800, rem: 10800 })]);
      const bar = screen.getByTestId('story-time-bar');
      expect(bar).toHaveAttribute('aria-label', 'Logged 30m of 2h estimate, 3h remaining');
      // Logged 30m (solid blue), remaining up to the estimate 1h 30m (faint blue), forecast
      // overspend 1h 30m (faint striped red: 3h 30m is past 125% of 2h).
      const w = segs(bar);
      expect(Object.keys(w)).toEqual([
        'indeterminate:logged',
        'indeterminate:remaining',
        'indeterminate:remainingOver',
      ]);
      expect(w['indeterminate:logged']).toBeCloseTo((1800 / 12600) * 100, 3);
      expect(w['indeterminate:remaining']).toBeCloseTo((5400 / 12600) * 100, 3);
      expect(w['indeterminate:remainingOver']).toBeCloseTo((5400 / 12600) * 100, 3);
      const fc = bar.querySelector('[data-segment="indeterminate:remainingOver"]') as HTMLElement;
      expect(fc.className).toContain('bg-red-500');
      expect(fc.className).toContain('opacity-45');
      expect(fc.style.backgroundImage).toContain('repeating-linear-gradient');
      const tick = within(bar).getByTestId('time-estimate-tick');
      expect(Number(tick.getAttribute('data-pct'))).toBeCloseTo((7200 / 12600) * 100, 3);
      await user.hover(bar);
      await waitFor(() => expect(rowTexts().length).toBeGreaterThan(0));
      expect(rowTexts()).toEqual(['Estimate2h', 'Logged30m', 'Remaining3h', 'Over by1h 30m']);
    });

    it('renders an empty muted track when there is nothing logged or estimated', () => {
      renderEpic([epicStory('S-1', 'new', {})]);
      const bar = screen.getByTestId('story-time-bar');
      expect(bar).toHaveAttribute('data-empty', 'true');
      expect(bar.querySelectorAll('[data-segment]')).toHaveLength(0);
      expect(within(bar).queryByTestId('time-estimate-tick')).toBeNull();
    });

    it('no estimate but logged: dashed empty track (never a full bar), tooltip notes no estimate', async () => {
      const user = userEvent.setup();
      renderEpic([epicStory('S-1', 'new', { spent: 1800 })]);
      const bar = screen.getByTestId('story-time-bar');
      expect(bar).not.toHaveAttribute('data-empty');
      expect(segs(bar)).toEqual({});
      expect(bar.querySelector('[data-no-estimate="true"]')).not.toBeNull();
      await user.hover(bar);
      expect(await screen.findByText('No estimate')).toBeInTheDocument();
      expect(rowTexts()).toEqual(['Logged30m']);
    });

    it('tooltip shows estimate, logged and remaining, with no formula note', async () => {
      const user = userEvent.setup();
      renderEpic([epicStory('S-1', 'indeterminate', { est: 7200, spent: 1800 })]);
      await user.hover(screen.getByTestId('story-time-bar'));
      await waitFor(() => expect(rowTexts().length).toBeGreaterThan(0));
      expect(rowTexts()).toEqual(['Estimate2h', 'Logged30m', 'Remaining1h 30m']);
      expect(document.querySelector('[data-slot="tooltip-note"]')).toBeNull();
    });

    it('colours by status (solid logged, faint remaining) with icon markers in the tooltip', async () => {
      const user = userEvent.setup();
      renderEpic([epicStory('S-1', 'indeterminate', { est: 7200, spent: 1800 })]);
      const bar = screen.getByTestId('story-time-bar');
      const logged = bar.querySelector('[data-segment="indeterminate:logged"]') as HTMLElement;
      const left = bar.querySelector('[data-segment="indeterminate:remaining"]') as HTMLElement;
      expect(logged.className).toContain('bg-blue-500');
      expect(logged.className).not.toContain('opacity-35');
      expect(left.className).toContain('bg-blue-500');
      expect(left.className).toContain('opacity-35');
      await user.hover(bar);
      await waitFor(() => expect(rowTexts().length).toBeGreaterThan(0));
      const markers = [...document.querySelectorAll('[data-slot="tooltip-row"]')].map((r) =>
        r.children[0].getAttribute('data-marker'),
      );
      expect(markers).toEqual(['icon', 'icon', 'icon']);
    });

    it('Remaining uses Jira remaining estimate when present (261103-lcd)', async () => {
      const user = userEvent.setup();
      renderEpic([epicStory('S-1', 'indeterminate', { est: 7200, spent: 1800, rem: 3600 })]);
      await user.hover(screen.getByTestId('story-time-bar'));
      await waitFor(() => expect(rowTexts().length).toBeGreaterThan(0));
      // Forecast 1h 30m against a 2h estimate → 30m under budget.
      expect(rowTexts()).toEqual(['Estimate2h', 'Logged30m', 'Remaining1h', 'Under by30m']);
    });

    it('a Tempo-only story (remaining, no original) has estimate = remaining + logged (261103-lcd)', async () => {
      const user = userEvent.setup();
      renderEpic([epicStory('S-1', 'indeterminate', { spent: 3600, rem: 7200 })]);
      const bar = screen.getByTestId('story-time-bar');
      expect(bar).not.toHaveAttribute('data-empty');
      await user.hover(bar);
      await waitFor(() => expect(rowTexts().length).toBeGreaterThan(0));
      expect(rowTexts()).toEqual(['Estimate3h', 'Logged1h', 'Remaining2h']);
    });

    it('done stories show zero remaining', async () => {
      const user = userEvent.setup();
      renderEpic([epicStory('S-1', 'done', { est: 7200, spent: 3600 })]);
      await user.hover(screen.getByTestId('story-time-bar'));
      await waitFor(() => expect(rowTexts().length).toBeGreaterThan(0));
      expect(rowTexts()).toContain('Remaining0m');
    });
  });
});

describe('Subtasks section header (261112-eep)', () => {
  const sub = {
    id: 'sub-1',
    key: 'PROJ-21',
    fields: { summary: 'First subtask', status: { name: 'To Do', statusCategory: { key: 'new' } } },
  };
  const base = {
    issueKey: 'PROJ-20',
    jiraBaseUrl: 'https://jira.example.com',
    storyPointsFieldKey: 'story_points',
    sprintFieldKey: 'sprint',
    epicLinkFieldKey: 'epic_link',
  };

  it('empty story shows heading, "No subtasks" and the Add button', () => {
    render(<IssueDetailContent {...base} issue={makeStoryIssue([])} />, { wrapper });
    expect(screen.getByText('Subtasks', { exact: true })).toBeTruthy();
    expect(screen.getByText('No subtasks')).toBeTruthy();
    expect(screen.queryByText(/Subtasks \(/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Add subtask' })).toBeTruthy();
  });

  it('story with subtasks shows count and no empty line', () => {
    render(
      <IssueDetailContent
        {...base}
        issue={makeStoryIssue([sub])}
        enrichedSubtasks={[sub] as never}
      />,
      { wrapper },
    );
    expect(screen.getByText('Subtasks (1)')).toBeTruthy();
    expect(screen.queryByText('No subtasks')).toBeNull();
  });

  it('skeleton state keeps heading and never shows "No subtasks"', () => {
    render(<IssueDetailContent {...base} issue={makeStoryIssue([sub])} showSubtasksSkeleton />, {
      wrapper,
    });
    expect(screen.getByTestId('subtasks-skeleton')).toBeTruthy();
    expect(screen.getByText('Subtasks (1)')).toBeTruthy();
    expect(screen.queryByText('No subtasks')).toBeNull();
  });

  it('Add subtask calls onAddSubtask with the issue key', () => {
    const onAddSubtask = vi.fn();
    render(
      <IssueDetailContent {...base} issue={makeStoryIssue([])} onAddSubtask={onAddSubtask} />,
      { wrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add subtask' }));
    expect(onAddSubtask).toHaveBeenCalledWith('PROJ-20');
  });

  it('menu item opens the bulk create modal', async () => {
    render(<IssueDetailContent {...base} issue={makeStoryIssue([])} />, { wrapper });
    expect(screen.queryByTestId('bulk-modal')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More subtask actions' }));
    const items = await screen.findAllByRole('menuitem');
    fireEvent.click(items[0]);
    expect(await screen.findByTestId('bulk-modal')).toBeTruthy();
  });
});
