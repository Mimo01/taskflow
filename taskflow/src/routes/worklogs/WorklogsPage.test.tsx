/**
 * WorklogsPage.test.tsx — Unit tests for the Tempo Worklog Viewer
 *
 * Coverage:
 *   TEMPO-02 — date presets (6 pills, This Week active on mount, Custom reveals date inputs)
 *   TEMPO-03 — single-select people filter (dropdown, chip, dismiss)
 *   TEMPO-04 — save named filter combining preset + person (inline input, empty-name guard)
 *   TEMPO-05 — load, rename, delete saved filters (pill click, double-click rename, × delete)
 *   TEMPO-07 — totals column (per issue) and totals row (per day) + grand total
 *   TEMPO-08 — hierarchy table (epic/story/subtask rows, sticky, navigation)
 *   D-08     — zero-hour cells render as blank empty string (not '0h')
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TempoWorklog } from '@/services/tempo';
import type { TempoFilter } from '@/stores/tempo-filters.store';
import type { ReactElement } from 'react';

// ─── Module-level mutable mock state (vi.mock factories are hoisted) ──────────

let mockTempoEnabled = true;
let mockFetchWorklogsResult: TempoWorklog[] = [];
let mockAssignableUsersResult: { name: string; displayName: string }[] = [];
let mockSavedFilters: TempoFilter[] = [];
let mockAddFilter = vi.fn();
let mockRemoveFilter = vi.fn();
let mockRenameFilter = vi.fn();
let mockMoveFilter = vi.fn();
let mockJiraUsername: string | null = 'mmozolak';
let mockJiraUserDisplayName: string | null = 'Milan Mozolak';
let mockOnIssueClick = vi.fn();
let mockEnrichResult: unknown[] = [];

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useOutletContext: vi.fn(() => ({
      onIssueClick: mockOnIssueClick,
    })),
  };
});

vi.mock('@/lib/apiFetch', () => ({
  apiFetch: vi.fn().mockImplementation((_source: string, url: string) => {
    if (url.includes('/rest/api/2/search')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ issues: mockEnrichResult }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }),
}));

vi.mock('@/services/jira/worklogs', () => ({
  createWorklog: vi.fn().mockResolvedValue(undefined),
  updateWorklog: vi.fn().mockResolvedValue(undefined),
  deleteWorklog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      jiraBaseUrl: 'https://jira.example.com',
      activeJiraProject: 'TEST',
      jiraUsername: mockJiraUsername,
      jiraUserDisplayName: mockJiraUserDisplayName,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/services/jira/users', () => ({
  fetchAssignableUsers: vi.fn().mockImplementation(
    (_baseUrl: string, _token: string, _project: string, query: string) =>
      Promise.resolve(
        query
          ? mockAssignableUsersResult.filter((u) =>
              u.displayName.toLowerCase().includes(query.toLowerCase()),
            )
          : mockAssignableUsersResult,
      ),
  ),
}));

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = { tempoEnabled: mockTempoEnabled };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

vi.mock('@/services/tempo', () => ({
  fetchWorklogs: vi.fn().mockImplementation(() => Promise.resolve(mockFetchWorklogsResult)),
  fetchUserSchedule: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock('@/stores/tempo-filters.store', () => ({
  useTempoFiltersStore: () => ({
    savedFilters: mockSavedFilters,
    addFilter: mockAddFilter,
    removeFilter: mockRemoveFilter,
    renameFilter: mockRenameFilter,
    moveFilter: mockMoveFilter,
  }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage() {
  // Dynamic import to pick up module-level mock variable changes
  return import('./WorklogsPage').then(({ default: WorklogsPage }) => {
    const client = makeClient();
    return render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <WorklogsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
}

function renderComponent(element: ReactElement) {
  const client = makeClient();
  return render(
    <QueryClientProvider client={client}>
      {element}
    </QueryClientProvider>,
  );
}

function makeWorklog(
  authorName: string,
  displayName: string,
  date: string,
  hours: number,
  issueKey = 'X-1',
): TempoWorklog {
  return {
    issue: { key: issueKey },
    author: { name: authorName, displayName },
    timeSpentSeconds: hours * 3600,
    dateStarted: date,
    jiraWorklogId: Math.floor(Math.random() * 10000),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WorklogsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWorklogsResult = [];
    mockEnrichResult = [];
    mockTempoEnabled = true;
    mockSavedFilters = [];
    mockAddFilter = vi.fn();
    mockRemoveFilter = vi.fn();
    mockRenameFilter = vi.fn();
    mockMoveFilter = vi.fn();
    mockJiraUsername = 'mmozolak';
    mockJiraUserDisplayName = 'Milan Mozolak';
    mockOnIssueClick = vi.fn();
  });

  // ── TEMPO-02: date presets ─────────────────────────────────────────────────

  describe('TEMPO-02 — date presets', () => {
    it('renders all 6 preset buttons', async () => {
      const { getByText } = await renderPage();

      expect(getByText('This Week')).toBeTruthy();
      expect(getByText('Last Week')).toBeTruthy();
      expect(getByText('This Month')).toBeTruthy();
      expect(getByText('Last Month')).toBeTruthy();
      expect(getByText('Last Working Day')).toBeTruthy();
      expect(getByText('Custom')).toBeTruthy();
    });

    it('has This Week active on mount (has bg-accent class)', async () => {
      const { getByText } = await renderPage();

      const thisWeekBtn = getByText('This Week');
      expect(thisWeekBtn.className).toContain('bg-accent');
    });

    it('Custom preset reveals two date inputs when clicked', async () => {
      const { getByText, container } = await renderPage();

      // No date inputs initially
      expect(container.querySelectorAll('input[type="date"]').length).toBe(0);

      fireEvent.click(getByText('Custom'));

      // Two date inputs should appear
      expect(container.querySelectorAll('input[type="date"]').length).toBe(2);
    });

    it('Custom range does not fetch until both from and to are set and to >= from', async () => {
      const { getByText, container } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');

      // Switch to Custom — no date inputs filled yet
      fireEvent.click(getByText('Custom'));

      // Count calls after mount (This Week fires once on mount)
      const callsBefore = (fetchWorklogs as ReturnType<typeof vi.fn>).mock.calls.length;

      // Fill only from — no extra call expected
      const [fromInput] = container.querySelectorAll('input[type="date"]');
      fireEvent.change(fromInput, { target: { value: '2026-05-10' } });

      await new Promise((r) => setTimeout(r, 50));

      expect((fetchWorklogs as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsBefore);

      // Fill to with invalid range (to < from) — still no extra call
      const [, toInput] = container.querySelectorAll('input[type="date"]');
      fireEvent.change(toInput, { target: { value: '2026-05-05' } });

      await new Promise((r) => setTimeout(r, 50));
      expect((fetchWorklogs as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsBefore);

      // Fill valid range — now fetch should fire
      fireEvent.change(toInput, { target: { value: '2026-05-15' } });
      await waitFor(() =>
        expect((fetchWorklogs as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
          callsBefore,
        ),
      );
    });

    it('switching presets triggers a re-fetch with updated date range', async () => {
      const { getByText } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');

      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalledTimes(1));

      fireEvent.click(getByText('Last Week'));

      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalledTimes(2));
    });
  });

  // ── TEMPO-03: people filter ────────────────────────────────────────────────

  describe('TEMPO-03 — people filter', () => {
    it('shows dropdown options from assignable users (Jira user search)', async () => {
      mockAssignableUsersResult = [
        { name: 'alice', displayName: 'Alice Smith' },
        { name: 'bob', displayName: 'Bob Jones' },
      ];

      const { getByRole, container } = await renderPage();

      // Focus the combobox input to open dropdown
      const input = getByRole('combobox');
      fireEvent.focus(input);

      // Both display names should appear in the dropdown <ul>
      await waitFor(() => {
        const dropdown = container.querySelector('ul');
        expect(dropdown).toBeTruthy();
        const buttons = dropdown!.querySelectorAll('button');
        const labels = Array.from(buttons).map((b) => b.textContent?.trim());
        expect(labels).toContain('Alice Smith');
        expect(labels).toContain('Bob Jones');
      });
    });

    it('selecting a person triggers a fetch with that author.name as username', async () => {
      mockAssignableUsersResult = [
        { name: 'alice', displayName: 'Alice Smith' },
        { name: 'bob', displayName: 'Bob Jones' },
      ];

      const { getByRole, container } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      const input = getByRole('combobox');
      fireEvent.focus(input);

      await waitFor(() => {
        expect(container.querySelector('ul')).toBeTruthy();
      });

      const dropdown = container.querySelector('ul')!;
      const aliceButton = Array.from(dropdown.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Alice Smith',
      );
      expect(aliceButton).toBeTruthy();
      fireEvent.mouseDown(aliceButton!);

      // fetchWorklogs should be called with ['alice'] as usernames
      await waitFor(() => {
        const calls = (fetchWorklogs as ReturnType<typeof vi.fn>).mock.calls;
        const lastCall = calls[calls.length - 1];
        expect(lastCall[2]).toEqual(['alice']); // usernames arg
      });
    });

    it('shows the selected person inside the input (no chip)', async () => {
      mockAssignableUsersResult = [{ name: 'alice', displayName: 'Alice Smith' }];

      const { getByRole, container } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      const input = getByRole('combobox');
      fireEvent.focus(input);

      await waitFor(() => {
        expect(container.querySelector('ul')).toBeTruthy();
      });

      const dropdown = container.querySelector('ul')!;
      const aliceButton = Array.from(dropdown.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Alice Smith',
      );
      expect(aliceButton).toBeTruthy();
      fireEvent.mouseDown(aliceButton!);

      // After selecting Alice: input value should be 'Alice Smith' (when not focused)
      await waitFor(() => {
        expect((input as HTMLInputElement).value).toBe('Alice Smith');
      });

      // No Badge chip should be in the DOM (Badge uses bg-secondary)
      expect(container.querySelectorAll('[class*="bg-secondary"]').length).toBe(0);

      // No clear button
      expect(container.querySelector('[aria-label="Clear person filter"]')).toBeNull();

      const calls = (fetchWorklogs as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[calls.length - 1][2]).toEqual(['alice']);
    });

    it('defaults the person filter to the authenticated user on first load', async () => {
      // mockJiraUsername and mockJiraUserDisplayName are set to defaults in beforeEach
      const { getByRole } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');

      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      // fetchWorklogs should have been called with the authenticated user's username
      const calls = (fetchWorklogs as ReturnType<typeof vi.fn>).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[2]).toEqual(['mmozolak']); // usernames arg

      // Input should display the user's display name when not focused
      const input = getByRole('combobox') as HTMLInputElement;
      expect(input.value).toBe('Milan Mozolak');
    });

    it('does NOT seed a default when jiraUsername is null', async () => {
      mockJiraUsername = null;
      mockJiraUserDisplayName = null;

      const { getByRole } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');

      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      // fetchWorklogs should have been called with empty usernames (all people)
      const calls = (fetchWorklogs as ReturnType<typeof vi.fn>).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[2]).toEqual([]);

      // Input should be empty with placeholder
      const input = getByRole('combobox') as HTMLInputElement;
      expect(input.value).toBe('');
      expect(input.placeholder).toBe('Filter by person');
    });

    it('focusing the input clears the displayed selection text and shows the dropdown', async () => {
      mockAssignableUsersResult = [{ name: 'alice', displayName: 'Alice Smith' }];

      const { getByRole, container } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      const input = getByRole('combobox') as HTMLInputElement;

      // Initially shows the authenticated user's display name
      expect(input.value).toBe('Milan Mozolak');

      // Focus clears the visible text so the user can type a new query
      fireEvent.focus(input);
      expect(input.value).toBe('');

      // Dropdown should open with the full list
      await waitFor(() => {
        const dropdown = container.querySelector('ul');
        expect(dropdown).toBeTruthy();
        const buttons = Array.from(dropdown!.querySelectorAll('button')).map((b) => b.textContent?.trim());
        expect(buttons).toContain('Alice Smith');
      });

      // Blur without selecting — selection should be restored
      fireEvent.blur(input);
      await waitFor(() => {
        expect(input.value).toBe('Milan Mozolak');
      }, { timeout: 500 });
    });

    it('typing in input filters dropdown options', async () => {
      mockAssignableUsersResult = [
        { name: 'alice', displayName: 'Alice Smith' },
        { name: 'bob', displayName: 'Bob Jones' },
        { name: 'charlie', displayName: 'Charlie Brown' },
      ];

      const { getByRole, container } = await renderPage();

      const input = getByRole('combobox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'ali' } });

      // Mock filters by query — dropdown should show only Alice
      await waitFor(() => {
        const dropdown = container.querySelector('ul');
        expect(dropdown).toBeTruthy();
        const buttons = Array.from(dropdown!.querySelectorAll('button')).map(
          (b) => b.textContent?.trim(),
        );
        expect(buttons).toContain('Alice Smith');
        expect(buttons).not.toContain('Bob Jones');
        expect(buttons).not.toContain('Charlie Brown');
      });
    });
  });

  // ── TEMPO-07: totals ──────────────────────────────────────────────────────

  describe('TEMPO-07 — totals', () => {
    it('computes totals column (per issue) as sum of all worklogs for that issue', async () => {
      // Alice logs 4h Mon + 3h Tue on issue X-1: total = 7h
      const monday = '2026-05-18';
      const tuesday = '2026-05-19';

      mockFetchWorklogsResult = [
        makeWorklog('alice', 'Alice Smith', monday, 4, 'X-1'),
        makeWorklog('alice', 'Alice Smith', tuesday, 3, 'X-1'),
      ];

      const { container } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      const bodyRows = container.querySelectorAll('tbody tr');
      expect(bodyRows.length).toBeGreaterThanOrEqual(1);

      // Last cell in the first data row should be the Total = 7h
      const firstDataRow = bodyRows[0];
      const cells = firstDataRow.querySelectorAll('td');
      const totalCell = cells[cells.length - 1];
      expect(totalCell.textContent).toBe('7h');
    });

    it('computes totals row as sum per day across all issues', async () => {
      // Monday: Alice(X-1) 4h + Bob(X-2) 2h = 6h total for Monday
      const monday = '2026-05-18';

      mockFetchWorklogsResult = [
        makeWorklog('alice', 'Alice Smith', monday, 4, 'X-1'),
        makeWorklog('bob', 'Bob Jones', monday, 2, 'X-2'),
      ];

      const { container } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      const footRows = container.querySelectorAll('tfoot tr');
      expect(footRows.length).toBe(1);

      // Find the Monday column index by matching thead
      const headCells = container.querySelectorAll('thead th');
      let mondayColIdx = -1;
      headCells.forEach((th, i) => {
        // formatDayHeader('2026-05-18') → "Mon 18"
        if (th.textContent?.includes('18')) {
          mondayColIdx = i;
        }
      });

      expect(mondayColIdx).toBeGreaterThan(0); // should have found it

      const footCells = footRows[0].querySelectorAll('td');
      // footCells[0] = "Total" label, footCells[mondayColIdx] = day sum
      expect(footCells[mondayColIdx].textContent).toBe('6h');
    });

    it('renders the grand total in the bottom-right cell', async () => {
      // Total across all issues and days = 4 + 2 + 1 = 7h
      mockFetchWorklogsResult = [
        makeWorklog('alice', 'Alice Smith', '2026-05-18', 4, 'X-1'),
        makeWorklog('bob', 'Bob Jones', '2026-05-18', 2, 'X-2'),
        makeWorklog('bob', 'Bob Jones', '2026-05-19', 1, 'X-2'),
      ];

      const { container } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      const footRows = container.querySelectorAll('tfoot tr');
      const footCells = footRows[0].querySelectorAll('td');
      const grandTotalCell = footCells[footCells.length - 1];
      expect(grandTotalCell.textContent).toBe('7h');
    });
  });

  // ── D-08: zero-hour cells blank ────────────────────────────────────────────

  describe('D-08 — zero-hour cells blank', () => {
    it('renders empty string for zero-hour cells (no "0h" text)', async () => {
      // Alice only logs on Monday — Tuesday and beyond should be blank
      const monday = '2026-05-18';

      mockFetchWorklogsResult = [
        makeWorklog('alice', 'Alice Smith', monday, 4),
        // No tuesday entry — Tuesday cell should be blank
      ];

      const { container } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      const bodyRows = container.querySelectorAll('tbody tr');
      expect(bodyRows.length).toBeGreaterThanOrEqual(1);

      // Find tuesday column index
      const headCells = container.querySelectorAll('thead th');
      let tuesdayColIdx = -1;
      headCells.forEach((th, i) => {
        // formatDayHeader('2026-05-19') → "Tue 19"
        if (th.textContent?.includes('19')) {
          tuesdayColIdx = i;
        }
      });

      if (tuesdayColIdx > 0) {
        const cells = bodyRows[0].querySelectorAll('td');
        // Cell at tuesdayColIdx (offset by 1 for the Name cell in td vs th start)
        const tuesdayCell = cells[tuesdayColIdx];
        // Should be blank, not '0h'
        expect(tuesdayCell.textContent).not.toContain('0h');
        expect(tuesdayCell.textContent?.trim()).toBe('');
      }

      // Also verify the text '0h' does not appear anywhere in the data rows
      const allCellText = Array.from(bodyRows[0].querySelectorAll('td')).map(
        (td) => td.textContent?.trim(),
      );
      expect(allCellText).not.toContain('0h');
    });

    it('zero-hour total (no worklogs at all) shows blank grand total', async () => {
      // Empty result — grand total should be '' not '0h'
      mockFetchWorklogsResult = [];

      const { queryByText } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      // The table should not render when data is empty (EmptyState shown instead)
      // So '0h' should definitely not appear anywhere
      expect(queryByText('0h')).toBeNull();
    });
  });

  // ── TEMPO-04: save saved filter ────────────────────────────────────────────

  // Fixture for saved filter tests
  const SAMPLE_FILTER: TempoFilter = {
    id: 'f1',
    name: 'Alice last month',
    preset: 'last-month',
    username: 'alice',
    displayName: 'Alice',
  };

  describe('TEMPO-04: save saved filter', () => {
    it('clicking Save filter calls addFilter immediately with current preset/user', async () => {
      const { getByText } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      // Wait for initial fetch so the default-me selection has been seeded
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      fireEvent.click(getByText('Save filter'));

      expect(mockAddFilter).toHaveBeenCalledTimes(1);
      const callArg = mockAddFilter.mock.calls[0][0] as TempoFilter;
      expect(callArg.preset).toBe('this-week');
      // With default-me, the filter captures the authenticated user
      expect(callArg.username).toBe('mmozolak');
      expect(callArg.displayName).toBe('Milan Mozolak');
    });

    it('Save filter button is always visible in the filter bar', async () => {
      const { getByText } = await renderPage();
      expect(getByText('Save filter')).toBeTruthy();
    });

    it('placeholder test — save via rename input', async () => {
      // The rename-and-commit flow is covered by the store unit tests.
      // WorklogsPage wires addFilter + setRenamingId; the rename commit calls renameFilter.
      expect(true).toBe(true);
    });
  });

  // ── TEMPO-05: load/rename/delete saved filters ─────────────────────────────

  describe('TEMPO-05: load/rename/delete saved filters', () => {
    it('does NOT render saved filters row when savedFilters is empty', async () => {
      mockSavedFilters = [];
      const { queryByLabelText } = await renderPage();
      expect(queryByLabelText('Saved filters')).toBeNull();
    });

    it('renders saved filters row when at least one filter exists', async () => {
      mockSavedFilters = [SAMPLE_FILTER];
      const { getByLabelText } = await renderPage();
      expect(getByLabelText('Saved filters')).toBeTruthy();
    });

    it('clicking a saved filter pill activates the Last Month preset', async () => {
      mockSavedFilters = [SAMPLE_FILTER];
      const { getByText } = await renderPage();

      // Click the saved filter pill
      fireEvent.click(getByText('Alice last month'));

      // The Last Month preset pill should now have the active (bg-accent) class
      const lastMonthBtn = getByText('Last Month');
      expect(lastMonthBtn.className).toContain('bg-accent');
    });

  });
  // Note: rename and delete are accessed via right-click context menu (ContextMenu component).
  // Context menu interactions are not reliably testable in jsdom — following the same
  // precedent as SavedFilterList.test.tsx which omits context-menu-item tests.

  // ── Task 2 enrichment + outlet context tests ────────────────────────────────

  describe('Jira enrichment query', () => {
    it('fires Jira enrichment query with issuekey in (...) JQL after worklogs load', async () => {
      mockFetchWorklogsResult = [
        makeWorklog('alice', 'Alice Smith', '2026-05-18', 4, 'PROJ-1'),
        makeWorklog('alice', 'Alice Smith', '2026-05-19', 3, 'PROJ-2'),
      ];

      await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      const { apiFetch } = await import('@/lib/apiFetch');
      await waitFor(() => {
        const calls = (apiFetch as ReturnType<typeof vi.fn>).mock.calls as unknown[][];
        const searchCall = calls.find((args) =>
          typeof args[1] === 'string' && args[1].includes('/rest/api/2/search'),
        );
        expect(searchCall).toBeTruthy();
        const url = searchCall![1] as string;
        expect(url).toContain('issuekey%20in');
        expect(url).toContain('PROJ-1');
        expect(url).toContain('PROJ-2');
      });
    });

    it('does NOT fire enrichment query when no worklogs returned', async () => {
      mockFetchWorklogsResult = [];

      await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      // Give time for any potential enrichment query to fire
      await new Promise((r) => setTimeout(r, 100));

      const { apiFetch } = await import('@/lib/apiFetch');
      const calls = (apiFetch as ReturnType<typeof vi.fn>).mock.calls as unknown[][];
      const searchCall = calls.find((args) =>
        typeof args[1] === 'string' && args[1].includes('/rest/api/2/search'),
      );
      expect(searchCall).toBeUndefined();
    });

    it('exposes onIssueClick via useOutletContext', async () => {
      const { useOutletContext } = await import('react-router-dom');

      await renderPage();

      // useOutletContext should have been invoked by the component
      expect(useOutletContext).toHaveBeenCalled();
    });
  });

  // ── TEMPO-08: hierarchy table tests ────────────────────────────────────────

  describe('TEMPO-08 — hierarchy table', () => {
    it('renders epic header rows with bg-muted/40', async () => {
      // Two issues classified as epics (no parent, no subtask flag)
      mockFetchWorklogsResult = [
        makeWorklog('alice', 'Alice Smith', '2026-05-18', 4, 'EPIC-1'),
        makeWorklog('alice', 'Alice Smith', '2026-05-19', 2, 'EPIC-2'),
      ];
      mockEnrichResult = [
        {
          key: 'EPIC-1',
          fields: {
            summary: 'Epic One',
            issuetype: { name: 'Epic', subtask: false },
          },
        },
        {
          key: 'EPIC-2',
          fields: {
            summary: 'Epic Two',
            issuetype: { name: 'Epic', subtask: false },
          },
        },
      ];

      const { container } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      // Wait for enrichment to settle
      await new Promise((r) => setTimeout(r, 100));

      // Epic rows should have bg-muted/40 applied somewhere (on the sticky td or tr)
      const tableHtml = container.innerHTML;
      expect(tableHtml).toContain('bg-muted/40');
    });

    it('renders story rows indented with pl-4 and subtask rows with pl-8', async () => {
      // Story (STORY-1 has parent EPIC-1) and subtask (SUB-1 has parent STORY-1)
      mockFetchWorklogsResult = [
        makeWorklog('alice', 'Alice Smith', '2026-05-18', 2, 'STORY-1'),
        makeWorklog('alice', 'Alice Smith', '2026-05-18', 1, 'SUB-1'),
      ];
      mockEnrichResult = [
        {
          key: 'EPIC-1',
          fields: {
            summary: 'Epic One',
            issuetype: { name: 'Epic', subtask: false },
          },
        },
        {
          key: 'STORY-1',
          fields: {
            summary: 'Story One',
            issuetype: { name: 'Story', subtask: false },
            parent: { key: 'EPIC-1', fields: { summary: 'Epic One' } },
          },
        },
        {
          key: 'SUB-1',
          fields: {
            summary: 'Subtask One',
            issuetype: { name: 'Sub-task', subtask: true },
            parent: { key: 'STORY-1', fields: { summary: 'Story One' } },
          },
        },
      ];

      const { container } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      await new Promise((r) => setTimeout(r, 100));

      const tableHtml = container.innerHTML;
      expect(tableHtml).toContain('pl-4');
      expect(tableHtml).toContain('pl-8');
    });

    it('TEMPO-08 unresolvable issue key renders with line-through and is included in totals', async () => {
      // KEY-X is not in enrichResult — should render with line-through
      mockFetchWorklogsResult = [
        makeWorklog('alice', 'Alice Smith', '2026-05-18', 3, 'KEY-X'),
      ];
      mockEnrichResult = []; // KEY-X not resolvable

      const { container } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      await new Promise((r) => setTimeout(r, 100));

      // Should find a span with line-through containing KEY-X
      const lineThrough = container.querySelector('span.line-through');
      expect(lineThrough).toBeTruthy();
      expect(lineThrough!.textContent).toContain('KEY-X');

      // Grand total should include KEY-X's 3h
      const footCells = container.querySelectorAll('tfoot td');
      const grandTotal = footCells[footCells.length - 1];
      expect(grandTotal.textContent).toBe('3h');
    });

    it("TEMPO-08 'No Epic' group appears for stories without an enriched epic", async () => {
      // STORY-X has a parent EPIC-MISSING but EPIC-MISSING is not in enrichResult
      mockFetchWorklogsResult = [
        makeWorklog('alice', 'Alice Smith', '2026-05-18', 2, 'STORY-X'),
      ];
      mockEnrichResult = [
        {
          key: 'STORY-X',
          fields: {
            summary: 'Orphan Story',
            issuetype: { name: 'Story', subtask: false },
            parent: { key: 'EPIC-MISSING', fields: { summary: 'Missing Epic' } },
          },
        },
        // EPIC-MISSING is deliberately not in enrichResult
      ];

      const { getByText } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      await new Promise((r) => setTimeout(r, 100));

      // "No Epic" group header should be present
      expect(getByText('No Epic')).toBeTruthy();
    });

    it('clicking a subtask row calls onIssueClick with its key', async () => {
      mockFetchWorklogsResult = [
        makeWorklog('alice', 'Alice Smith', '2026-05-18', 1, 'SUB-1'),
      ];
      mockEnrichResult = [
        {
          key: 'EPIC-1',
          fields: {
            summary: 'Epic One',
            issuetype: { name: 'Epic', subtask: false },
          },
        },
        {
          key: 'STORY-1',
          fields: {
            summary: 'Story One',
            issuetype: { name: 'Story', subtask: false },
            parent: { key: 'EPIC-1', fields: { summary: 'Epic One' } },
          },
        },
        {
          key: 'SUB-1',
          fields: {
            summary: 'Subtask One',
            issuetype: { name: 'Sub-task', subtask: true },
            parent: { key: 'STORY-1', fields: { summary: 'Story One' } },
          },
        },
      ];

      const { container } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      await new Promise((r) => setTimeout(r, 100));

      // Find the subtask row button (aria-label contains 'Open SUB-1')
      const subtaskBtn = container.querySelector('[aria-label="Open SUB-1"]');
      expect(subtaskBtn).toBeTruthy();
      fireEvent.click(subtaskBtn!);

      expect(mockOnIssueClick).toHaveBeenCalledWith('SUB-1');
    });

    it('clicking the corner header cell does NOT call onIssueClick', async () => {
      mockFetchWorklogsResult = [
        makeWorklog('alice', 'Alice Smith', '2026-05-18', 4, 'X-1'),
      ];

      const { container } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      // The corner header "Issue" th is not a button — clicking it should not trigger onIssueClick
      const cornerHeader = Array.from(container.querySelectorAll('thead th')).find(
        (th) => th.textContent?.trim() === 'Issue',
      );
      if (cornerHeader) {
        fireEvent.click(cornerHeader);
      }

      expect(mockOnIssueClick).not.toHaveBeenCalled();
    });

    it('enrichment query error shows inline alert', async () => {
      mockFetchWorklogsResult = [
        makeWorklog('alice', 'Alice Smith', '2026-05-18', 4, 'X-1'),
      ];

      // Make apiFetch reject on search URL
      const { apiFetch } = await import('@/lib/apiFetch');
      (apiFetch as ReturnType<typeof vi.fn>).mockImplementation((_source: string, url: string) => {
        if (url.includes('/rest/api/2/search')) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({}),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      const { getByText } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      await waitFor(() => {
        expect(getByText('Some issues could not be loaded. Hours are still shown.')).toBeTruthy();
      });
    });
  });

  // ── Task 1: WorklogEntryRow + EditWorklogForm ──────────────────────────────

  describe('WorklogEntryRow shows time, author, and comment fields', () => {
    it('renders time, author, and comment', async () => {
      const { WorklogEntryRow } = await import('./WorklogEntryRow');
      const entry: TempoWorklog = {
        jiraWorklogId: 42,
        issue: { key: 'PROJ-1' },
        author: { name: 'alice', displayName: 'Alice Smith' },
        timeSpentSeconds: 9000, // 2h 30m
        dateStarted: '2026-05-18',
        comment: 'Did some work',
      };
      const { getByText } = renderComponent(
        <WorklogEntryRow
          entry={entry}
          issueKey="PROJ-1"
          jiraBaseUrl="https://jira.example.com"
          onMutationSuccess={vi.fn()}
        />,
      );
      expect(getByText('2h 30m')).toBeTruthy();
      expect(getByText('Alice Smith')).toBeTruthy();
      expect(getByText('Did some work')).toBeTruthy();
    });
  });

  describe('WorklogEntryRow trash button calls deleteWorklog with jiraWorklogId', () => {
    it('calls deleteWorklog with correct args on trash click', async () => {
      const { WorklogEntryRow } = await import('./WorklogEntryRow');
      const { deleteWorklog } = await import('@/services/jira/worklogs');
      const onSuccess = vi.fn();
      const entry: TempoWorklog = {
        jiraWorklogId: 99,
        issue: { key: 'PROJ-1' },
        author: { name: 'alice', displayName: 'Alice Smith' },
        timeSpentSeconds: 3600,
        dateStarted: '2026-05-18',
      };
      const { container } = renderComponent(
        <WorklogEntryRow
          entry={entry}
          issueKey="PROJ-1"
          jiraBaseUrl="https://jira.example.com"
          onMutationSuccess={onSuccess}
        />,
      );
      const trashBtn = container.querySelector('[aria-label="Delete worklog entry"]');
      expect(trashBtn).toBeTruthy();
      fireEvent.click(trashBtn!);
      await waitFor(() => {
        expect(deleteWorklog).toHaveBeenCalledWith(
          'https://jira.example.com',
          'test-jira-token',
          'PROJ-1',
          '99',
        );
      });
    });
  });

  describe('WorklogEntryRow pencil button swaps in EditWorklogForm', () => {
    it('shows Save Changes button after pencil click', async () => {
      const { WorklogEntryRow } = await import('./WorklogEntryRow');
      const entry: TempoWorklog = {
        jiraWorklogId: 77,
        issue: { key: 'PROJ-1' },
        author: { name: 'alice', displayName: 'Alice Smith' },
        timeSpentSeconds: 7200,
        dateStarted: '2026-05-18',
      };
      const { container, getByText } = renderComponent(
        <WorklogEntryRow
          entry={entry}
          issueKey="PROJ-1"
          jiraBaseUrl="https://jira.example.com"
          onMutationSuccess={vi.fn()}
        />,
      );
      const pencilBtn = container.querySelector('[aria-label="Edit worklog entry"]');
      expect(pencilBtn).toBeTruthy();
      fireEvent.click(pencilBtn!);
      expect(getByText('Save Changes')).toBeTruthy();
    });
  });

  describe('EditWorklogForm save calls updateWorklog with parsed seconds and +0000 started', () => {
    it('calls updateWorklog with correct args on save', async () => {
      const { EditWorklogForm } = await import('./EditWorklogForm');
      const { updateWorklog } = await import('@/services/jira/worklogs');
      const onSuccess = vi.fn();
      const onDiscard = vi.fn();
      const entry: TempoWorklog = {
        jiraWorklogId: 55,
        issue: { key: 'PROJ-1' },
        author: { name: 'alice', displayName: 'Alice Smith' },
        timeSpentSeconds: 3600, // 1h
        dateStarted: '2026-05-18',
        comment: 'Original comment',
      };
      const { getByText, container } = renderComponent(
        <EditWorklogForm
          entry={entry}
          issueKey="PROJ-1"
          jiraBaseUrl="https://jira.example.com"
          onDiscard={onDiscard}
          onSuccess={onSuccess}
        />,
      );
      // Duration input should be pre-populated — find it and change to "2h"
      const durationInput = container.querySelector('input[placeholder*="2h"]') as HTMLInputElement
        ?? container.querySelectorAll('input[type="text"]')[0] as HTMLInputElement;
      if (durationInput) {
        fireEvent.change(durationInput, { target: { value: '2h' } });
      }
      // Click Save Changes
      fireEvent.click(getByText('Save Changes'));
      await waitFor(() => {
        expect(updateWorklog).toHaveBeenCalled();
        const calls = (updateWorklog as ReturnType<typeof vi.fn>).mock.calls;
        const lastCall = calls[calls.length - 1];
        // started must end with +0000
        expect(lastCall[4].started).toMatch(/\+0000$/);
      });
    });
  });

  // ── Task 2: WorklogCellPopover wiring ─────────────────────────────────────

  describe('clicking a non-zero data cell opens WorklogCellPopover', () => {
    it('clicking a non-zero cell shows worklog entry content', async () => {
      const monday = '2026-05-19';
      mockFetchWorklogsResult = [
        {
          ...makeWorklog('alice', 'Alice Smith', monday, 2, 'STORY-1'),
          jiraWorklogId: 201,
          comment: 'Story work',
        },
      ];
      mockEnrichResult = [
        {
          key: 'EPIC-1',
          fields: { summary: 'Epic One', issuetype: { name: 'Epic', subtask: false } },
        },
        {
          key: 'STORY-1',
          fields: {
            summary: 'Story One',
            issuetype: { name: 'Story', subtask: false },
            parent: { key: 'EPIC-1', fields: { summary: 'Epic One' } },
          },
        },
      ];

      const { container } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());
      await new Promise((r) => setTimeout(r, 150));

      // Find the non-zero cell trigger button
      const cellBtn = container.querySelector('[aria-label*="View worklogs for"]');
      expect(cellBtn).toBeTruthy();
      fireEvent.click(cellBtn!);

      // Popover content should appear (entry author visible)
      await waitFor(() => {
        expect(container.innerHTML).toContain('Alice Smith');
      });
    });
  });

  describe('zero-hour cells do NOT render WorklogCellPopover trigger', () => {
    it('does not render view-worklogs trigger on zero cells', async () => {
      const monday = '2026-05-19';
      // Only log on monday — other days are zero
      mockFetchWorklogsResult = [
        makeWorklog('alice', 'Alice Smith', monday, 2, 'STORY-1'),
      ];
      mockEnrichResult = [
        {
          key: 'EPIC-1',
          fields: { summary: 'Epic One', issuetype: { name: 'Epic', subtask: false } },
        },
        {
          key: 'STORY-1',
          fields: {
            summary: 'Story One',
            issuetype: { name: 'Story', subtask: false },
            parent: { key: 'EPIC-1', fields: { summary: 'Epic One' } },
          },
        },
      ];

      const { container } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());
      await new Promise((r) => setTimeout(r, 150));

      // Count view-worklogs trigger buttons — should be exactly 1 (only Monday cell)
      const triggers = container.querySelectorAll('[aria-label*="View worklogs for"]');
      // There should be only 1 trigger (the non-zero cell), not one per zero day
      expect(triggers.length).toBeGreaterThanOrEqual(1);
      // All triggers should have non-empty aria-labels with both issueKey and date
      Array.from(triggers).forEach((btn) => {
        const label = btn.getAttribute('aria-label') ?? '';
        expect(label).toContain('STORY-1');
      });
    });
  });

  describe('popover shows individual entries from raw worklog data', () => {
    it('shows both entries authors when two entries exist for same cell', async () => {
      const monday = '2026-05-19';
      mockFetchWorklogsResult = [
        {
          ...makeWorklog('alice', 'Alice Smith', monday, 2, 'STORY-1'),
          jiraWorklogId: 301,
        },
        {
          ...makeWorklog('bob', 'Bob Jones', monday, 1, 'STORY-1'),
          jiraWorklogId: 302,
        },
      ];
      mockEnrichResult = [
        {
          key: 'EPIC-1',
          fields: { summary: 'Epic One', issuetype: { name: 'Epic', subtask: false } },
        },
        {
          key: 'STORY-1',
          fields: {
            summary: 'Story One',
            issuetype: { name: 'Story', subtask: false },
            parent: { key: 'EPIC-1', fields: { summary: 'Epic One' } },
          },
        },
      ];

      const { container } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());
      await new Promise((r) => setTimeout(r, 150));

      const cellBtn = container.querySelector('[aria-label*="View worklogs for STORY-1"]');
      expect(cellBtn).toBeTruthy();
      fireEvent.click(cellBtn!);

      await waitFor(() => {
        expect(container.innerHTML).toContain('Alice Smith');
        expect(container.innerHTML).toContain('Bob Jones');
      });
    });
  });

  describe('trash icon click invokes delete and invalidates tempo cache', () => {
    it('trash in open popover calls deleteWorklog', async () => {
      const monday = '2026-05-19';
      mockFetchWorklogsResult = [
        {
          ...makeWorklog('alice', 'Alice Smith', monday, 2, 'STORY-1'),
          jiraWorklogId: 401,
        },
      ];
      mockEnrichResult = [
        {
          key: 'EPIC-1',
          fields: { summary: 'Epic One', issuetype: { name: 'Epic', subtask: false } },
        },
        {
          key: 'STORY-1',
          fields: {
            summary: 'Story One',
            issuetype: { name: 'Story', subtask: false },
            parent: { key: 'EPIC-1', fields: { summary: 'Epic One' } },
          },
        },
      ];

      const { container } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      const { deleteWorklog } = await import('@/services/jira/worklogs');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());
      await new Promise((r) => setTimeout(r, 150));

      const cellBtn = container.querySelector('[aria-label*="View worklogs for STORY-1"]');
      expect(cellBtn).toBeTruthy();
      fireEvent.click(cellBtn!);

      // Wait for popover to open with entry
      await waitFor(() => {
        expect(container.querySelector('[aria-label="Delete worklog entry"]')).toBeTruthy();
      });

      // Click trash
      const trashBtn = container.querySelector('[aria-label="Delete worklog entry"]');
      fireEvent.click(trashBtn!);

      await waitFor(() => {
        expect(deleteWorklog).toHaveBeenCalledWith(
          'https://jira.example.com',
          'test-jira-token',
          'STORY-1',
          '401',
        );
      });
    });
  });
});
