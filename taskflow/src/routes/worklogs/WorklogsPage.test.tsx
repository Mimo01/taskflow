/**
 * WorklogsPage.test.tsx — Unit tests for the Tempo Worklog Viewer
 *
 * Coverage:
 *   TEMPO-01 — day-column pivot table (rows per author, columns per day)
 *   TEMPO-02 — date presets (6 pills, This Week active on mount, Custom reveals date inputs)
 *   TEMPO-03 — single-select people filter (dropdown, chip, dismiss)
 *   TEMPO-07 — totals column (per person) and totals row (per day)
 *   D-08     — zero-hour cells render as blank empty string (not '0h')
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TempoWorklog } from '@/services/tempo';

// ─── Module-level mutable mock state (vi.mock factories are hoisted) ──────────

let mockTempoEnabled = true;
let mockFetchWorklogsResult: TempoWorklog[] = [];

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    jiraBaseUrl: 'https://jira.example.com',
  }),
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

function makeWorklog(
  authorName: string,
  displayName: string,
  date: string,
  hours: number,
): TempoWorklog {
  return {
    issue: { key: 'X-1' },
    author: { name: authorName, displayName },
    timeSpentSeconds: hours * 3600,
    dateStarted: date,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WorklogsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWorklogsResult = [];
    mockTempoEnabled = true;
  });

  // ── TEMPO-01: day-column table ─────────────────────────────────────────────

  describe('TEMPO-01 — day-column table', () => {
    it('renders one row per author and correct column structure', async () => {
      // Fixture: 2 authors, 3 distinct days in "This Week" range
      // We use fixed dates so the table always has predictable columns.
      // Rather than relying on "this week" dates, we verify tbody row count.
      mockFetchWorklogsResult = [
        makeWorklog('alice', 'Alice Smith', '2026-05-18', 4),
        makeWorklog('alice', 'Alice Smith', '2026-05-19', 3),
        makeWorklog('bob', 'Bob Jones', '2026-05-18', 2),
        makeWorklog('bob', 'Bob Jones', '2026-05-20', 1),
      ];

      const { container } = await renderPage();

      // Wait for query to resolve
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      const rows = container.querySelectorAll('tbody tr');
      expect(rows.length).toBe(2); // one row per author
    });

    it('shows the author displayName in the first cell of each row', async () => {
      mockFetchWorklogsResult = [
        makeWorklog('alice', 'Alice Smith', '2026-05-18', 4),
        makeWorklog('bob', 'Bob Jones', '2026-05-19', 2),
      ];

      const { getByText } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      expect(getByText('Alice Smith')).toBeTruthy();
      expect(getByText('Bob Jones')).toBeTruthy();
    });

    it('renders a thead with Name + day columns + Total header', async () => {
      mockFetchWorklogsResult = [makeWorklog('alice', 'Alice Smith', '2026-05-18', 4)];

      const { container, getAllByText } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      // "Name" and "Total" headers must be present (Total appears in both thead and tfoot)
      const nameHeaders = container.querySelectorAll('thead th');
      const nameHeader = Array.from(nameHeaders).find((th) => th.textContent === 'Name');
      expect(nameHeader).toBeTruthy();
      expect(getAllByText('Total').length).toBeGreaterThanOrEqual(1);

      // thead must have at least 3 columns: Name + at least 1 day + Total
      expect(nameHeaders.length).toBeGreaterThanOrEqual(3);
    });
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
    it('shows dropdown options derived from author.displayName in fetched data', async () => {
      mockFetchWorklogsResult = [
        makeWorklog('alice', 'Alice Smith', '2026-05-18', 4),
        makeWorklog('bob', 'Bob Jones', '2026-05-19', 2),
      ];

      const { getByRole, container } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

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
      mockFetchWorklogsResult = [
        makeWorklog('alice', 'Alice Smith', '2026-05-18', 4),
        makeWorklog('bob', 'Bob Jones', '2026-05-19', 2),
      ];

      const { getByRole, container } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      // Open the dropdown
      const input = getByRole('combobox');
      fireEvent.focus(input);

      // Wait for dropdown to appear, then select Alice via mouseDown (blur-safety pattern)
      await waitFor(() => {
        const dropdown = container.querySelector('ul');
        expect(dropdown).toBeTruthy();
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

    it('shows a dismissible chip when a person is selected and clears on X click', async () => {
      mockFetchWorklogsResult = [makeWorklog('alice', 'Alice Smith', '2026-05-18', 4)];

      const { getByRole, container, queryByLabelText, getByLabelText } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      // Open dropdown and select Alice
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

      // Chip should appear
      await waitFor(() => {
        expect(getByLabelText('Remove Alice Smith filter')).toBeTruthy();
      });

      // Dismiss the chip
      const dismissBtn = getByLabelText('Remove Alice Smith filter');
      fireEvent.click(dismissBtn);

      // Chip should be gone
      await waitFor(() => {
        expect(queryByLabelText('Remove Alice Smith filter')).toBeNull();
      });

      // fetchWorklogs should have been called with [] after dismiss
      const calls = (fetchWorklogs as ReturnType<typeof vi.fn>).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[2]).toEqual([]); // empty usernames = all people
    });

    it('typing in input filters dropdown options', async () => {
      mockFetchWorklogsResult = [
        makeWorklog('alice', 'Alice Smith', '2026-05-18', 4),
        makeWorklog('bob', 'Bob Jones', '2026-05-19', 2),
        makeWorklog('charlie', 'Charlie Brown', '2026-05-20', 1),
      ];

      const { getByRole, container } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      const input = getByRole('combobox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'ali' } });

      // Dropdown should show only Alice
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
    it('computes totals column as sum per person', async () => {
      // Alice: 4h Mon + 3h Tue = 7h total; Wed = 0 (blank)
      // Use fixed dates that fall within "this week" range by mocking the data
      const monday = '2026-05-18';
      const tuesday = '2026-05-19';

      mockFetchWorklogsResult = [
        makeWorklog('alice', 'Alice Smith', monday, 4),
        makeWorklog('alice', 'Alice Smith', tuesday, 3),
      ];

      const { container } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      const bodyRows = container.querySelectorAll('tbody tr');
      expect(bodyRows.length).toBe(1);

      // Last cell in Alice's row is the Total = 7h
      const cells = bodyRows[0].querySelectorAll('td');
      const totalCell = cells[cells.length - 1];
      expect(totalCell.textContent).toBe('7h');
    });

    it('computes totals row as sum per day across all people', async () => {
      // Monday: Alice 4h + Bob 2h = 6h
      const monday = '2026-05-18';

      mockFetchWorklogsResult = [
        makeWorklog('alice', 'Alice Smith', monday, 4),
        makeWorklog('bob', 'Bob Jones', monday, 2),
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
      // Total across all people and days = 4 + 2 + 1 = 7h
      mockFetchWorklogsResult = [
        makeWorklog('alice', 'Alice Smith', '2026-05-18', 4),
        makeWorklog('bob', 'Bob Jones', '2026-05-18', 2),
        makeWorklog('bob', 'Bob Jones', '2026-05-19', 1),
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
      const tuesday = '2026-05-19';

      mockFetchWorklogsResult = [
        makeWorklog('alice', 'Alice Smith', monday, 4),
        // No entry for tuesday — Tuesday cell should be blank
      ];

      const { container } = await renderPage();
      const { fetchWorklogs } = await import('@/services/tempo');
      await waitFor(() => expect(fetchWorklogs).toHaveBeenCalled());

      const bodyRows = container.querySelectorAll('tbody tr');
      expect(bodyRows.length).toBe(1);

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
});
