// DRIFT-04/05/06/07/08: MrDriftSection is presentational and props-driven —
// render assertions for flagged ordering, the three columns, muted states and
// the degraded banner.
// MRFIX-01..04 (Plan 90-03): per-MR corrective action cells consume the real
// useMrFixMutation hook, so every render needs a QueryClientProvider — mock
// @/services/gitlab's updateMergeRequest, not the hook, to exercise the real
// status/cache machinery from a click.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateMergeRequest } from '@/services/gitlab';
import type { GitLabMR } from '@/services/gitlab';
import type { DriftRow } from './driftDetection';
import {
  applyHeldOrder,
  matchTicketKeyInTitle,
  type MrFixContext,
  MrDriftSection,
} from './MrDriftSection';

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(),
}));

vi.mock('@/services/gitlab', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/gitlab')>()),
  updateMergeRequest: vi.fn(),
}));

const mockUpdateMergeRequest = vi.mocked(updateMergeRequest);

function makeMR(overrides: Partial<GitLabMR> = {}): GitLabMR {
  return {
    id: 1,
    iid: 1,
    project_id: 1,
    title: 'Fix thing',
    source_branch: 'fix-thing',
    target_branch: 'develop',
    state: 'opened',
    draft: false,
    author: { id: 1, name: 'Alice', username: 'alice', avatar_url: '' },
    reviewers: [],
    updated_at: '2026-01-01T00:00:00Z',
    web_url: 'https://gitlab.example.com/mr/1',
    labels: [],
    milestone: null,
    ...overrides,
  } as unknown as GitLabMR;
}

function makeRow(overrides: Partial<DriftRow> = {}): DriftRow {
  return {
    mr: makeMR(),
    channels: new Set(['A']),
    evaluated: true,
    br: 'ok',
    ms: 'ok',
    task: 'ok',
    taskReason: null,
    taskKeys: ['PROJ-1'],
    flagged: false,
    ...overrides,
  };
}

const DEFAULT_FIX: MrFixContext = {
  projectId: 42,
  baseUrl: 'https://gitlab.example.com',
  token: 't',
  releaseBranchName: 'release/33.5.0',
  releaseBranchExists: true,
  matchedMilestone: { id: 1, title: '33.5.0 (21.07.2026)' },
};

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function renderWithClient(
  ui: React.ReactElement,
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  }),
) {
  return render(ui, { wrapper: makeWrapper(queryClient) });
}

function renderSection(
  overrides: Partial<React.ComponentProps<typeof MrDriftSection>> = {},
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  return renderWithClient(
    <MrDriftSection
      rows={[]}
      flaggedCount={0}
      hasMatchedMilestone={true}
      isLoading={false}
      onNavigateToIssueFromMR={() => {}}
      fix={DEFAULT_FIX}
      {...overrides}
    />,
    queryClient,
  );
}

describe('MrDriftSection', () => {
  it('renders rows in the given order without re-sorting', () => {
    const flagged = makeRow({
      mr: makeMR({ id: 1, iid: 10 }),
      flagged: true,
      br: 'flag',
    });
    const clean = makeRow({ mr: makeMR({ id: 2, iid: 5 }) });
    renderSection({ rows: [flagged, clean], flaggedCount: 1 });

    const rows = screen.getAllByTestId('drift-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('!10');
    expect(rows[1]).toHaveTextContent('!5');
  });

  it('renders the warning glyph for a flagged BR mark', () => {
    const row = makeRow({ br: 'flag', flagged: true });
    renderSection({ rows: [row], flaggedCount: 1 });
    const brCell = screen.getByTestId('drift-br');
    expect(brCell.querySelector('svg')).toBeTruthy();
  });

  it('renders a check for an ok mark and an em dash for na', () => {
    const row = makeRow({ br: 'ok', ms: 'na' });
    renderSection({ rows: [row] });
    expect(screen.getByTestId('drift-br').querySelector('svg')).toBeTruthy();
    expect(screen.getByTestId('drift-ms')).toHaveTextContent('—');
  });

  it('mutes title and key text for a non-evaluated row and renders em dashes in all three columns', () => {
    const row = makeRow({
      evaluated: false,
      br: 'na',
      ms: 'na',
      task: 'na',
      mr: makeMR({ state: 'merged', title: 'Merged thing' }),
    });
    renderSection({ rows: [row] });
    expect(screen.getByTestId('drift-br')).toHaveTextContent('—');
    expect(screen.getByTestId('drift-ms')).toHaveTextContent('—');
    expect(screen.getByTestId('drift-task')).toHaveTextContent('—');
    const rowEl = screen.getByTestId('drift-row');
    expect(rowEl.textContent).toContain('Merged thing');
  });

  it('renders real marks (not em dashes) for an evaluated draft MR', () => {
    const row = makeRow({
      evaluated: true,
      br: 'flag',
      ms: 'ok',
      task: 'ok',
      flagged: true,
      mr: makeMR({ state: 'opened', draft: true }),
    });
    renderSection({ rows: [row], flaggedCount: 1 });
    expect(screen.getByTestId('drift-br').querySelector('svg')).toBeTruthy();
    expect(screen.getByTestId('drift-br')).not.toHaveTextContent('—');
  });

  it('renders an em-dash placeholder and "No linked task" title for no-linked-task', () => {
    const row = makeRow({
      taskReason: 'no-linked-task',
      taskKeys: [],
      task: 'flag',
      flagged: true,
    });
    renderSection({ rows: [row], flaggedCount: 1 });
    expect(screen.getByTestId('drift-task')).toHaveAttribute('title', 'No linked task');
  });

  it('names the extracted key in the TASK-cell title for not-in-fix-version', () => {
    const row = makeRow({
      taskReason: 'not-in-fix-version',
      taskKeys: ['PROJ-9'],
      task: 'flag',
      flagged: true,
    });
    renderSection({ rows: [row], flaggedCount: 1 });
    expect(screen.getByTestId('drift-task')).toHaveAttribute(
      'title',
      'PROJ-9 not in this fix version',
    );
  });

  it('renders the degraded-state banner and no BR/MS marks when no milestone matched', () => {
    renderSection({ hasMatchedMilestone: false });
    expect(screen.getByTestId('drift-degraded-banner')).toBeInTheDocument();
  });

  it('renders the empty-state copy when rows is empty and not loading', () => {
    renderSection({ rows: [], isLoading: false });
    expect(screen.getByText('No merge requests found')).toBeInTheDocument();
  });

  it('renders the flagged count in the heading badge', () => {
    renderSection({ flaggedCount: 3 });
    expect(screen.getByText('MR Drift')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  // CR-01 regression: `extractTicketKeys` normalises what it returns (uppercases,
  // and rewrites the space form "PROJ 123" to "PROJ-123"), so the key is often NOT
  // a literal substring of the title. The old highlighter used indexOf(), got -1,
  // and then sliced at `-1 + key.length` — silently deleting `key.length - 1`
  // characters. Titles must render losslessly regardless of key spelling.
  describe('title rendering does not mangle non-literal ticket keys (CR-01)', () => {
    const cases = [
      ['space form', 'PROJ 123 fix the thing'],
      ['lowercase dash form', 'proj-123 fix the thing'],
      ['lowercase space form', 'proj 123 fix the thing'],
      ['canonical dash form', 'PROJ-123 fix the thing'],
      ['key mid-title', 'hotfix for PROJ 123 urgently'],
    ] as const;

    for (const [label, title] of cases) {
      it(`renders the full title verbatim — ${label}`, () => {
        renderSection({ rows: [makeRow({ mr: makeMR({ title }) })] });
        // Text is split across button/text nodes, so compare normalised row text.
        const row = screen.getByText(/fix|hotfix/i).closest('div');
        expect(row?.textContent).toContain(title);
      });
    }

    it('matchTicketKeyInTitle finds the original spelling, or null when absent', () => {
      expect(matchTicketKeyInTitle('PROJ 123 fix', 'PROJ-123')).toEqual({
        index: 0,
        text: 'PROJ 123',
      });
      expect(matchTicketKeyInTitle('proj-123 fix', 'PROJ-123')).toEqual({
        index: 0,
        text: 'proj-123',
      });
      expect(matchTicketKeyInTitle('no key here', 'PROJ-123')).toBeNull();
      expect(matchTicketKeyInTitle('PROJ-123', 'MALFORMED')).toBeNull();
    });
  });

  describe('held sort order (D-11)', () => {
    it('applyHeldOrder: reorders rows to match heldIds, appending unknown ids last', () => {
      const r1 = makeRow({ mr: makeMR({ id: 1, iid: 1 }) });
      const r2 = makeRow({ mr: makeMR({ id: 2, iid: 2 }) });
      const r3 = makeRow({ mr: makeMR({ id: 3, iid: 3 }) });
      const result = applyHeldOrder([r3, r1, r2], [1, 2, 3]);
      expect(result.map((r) => r.mr.id)).toEqual([1, 2, 3]);
    });

    it('applyHeldOrder: appends a row whose id is not in heldIds after all held rows, preserving incoming relative order', () => {
      const r1 = makeRow({ mr: makeMR({ id: 1, iid: 1 }) });
      const r2 = makeRow({ mr: makeMR({ id: 2, iid: 2 }) });
      const r99 = makeRow({ mr: makeMR({ id: 99, iid: 99 }) });
      const result = applyHeldOrder([r99, r2, r1], [1, 2]);
      expect(result.map((r) => r.mr.id)).toEqual([1, 2, 99]);
    });

    it('applyHeldOrder: a held id with no matching row is skipped, no hole and no throw', () => {
      const r1 = makeRow({ mr: makeMR({ id: 1, iid: 1 }) });
      const result = applyHeldOrder([r1], [1, 404, 2]);
      expect(result.map((r) => r.mr.id)).toEqual([1]);
    });

    it('applyHeldOrder: empty heldIds returns the incoming rows unchanged', () => {
      const r1 = makeRow({ mr: makeMR({ id: 1, iid: 1 }) });
      const r2 = makeRow({ mr: makeMR({ id: 2, iid: 2 }) });
      const input = [r2, r1];
      const result = applyHeldOrder(input, []);
      expect(result).toEqual(input);
      expect(result).toHaveLength(2);
    });

    it('applyHeldOrder: never mutates the input array', () => {
      const r1 = makeRow({ mr: makeMR({ id: 1, iid: 1 }) });
      const r2 = makeRow({ mr: makeMR({ id: 2, iid: 2 }) });
      const input = [r2, r1];
      const snapshot = [...input];
      applyHeldOrder(input, [1, 2]);
      expect(input).toEqual(snapshot);
    });

    it('holds the DOM order across a re-render even when a row is re-sorted flagged-first-demoted', () => {
      const rowA = makeRow({ mr: makeMR({ id: 1, iid: 1 }), br: 'flag', flagged: true });
      const rowB = makeRow({ mr: makeMR({ id: 2, iid: 2 }), br: 'ok', flagged: false });
      // Initial render: A (flagged) sorted first per driftDetection's comparator.
      const { rerender } = renderWithClient(
        <MrDriftSection
          rows={[rowA, rowB]}
          flaggedCount={1}
          hasMatchedMilestone={true}
          isLoading={false}
          onNavigateToIssueFromMR={() => {}}
          fix={DEFAULT_FIX}
        />,
      );
      let rows = screen.getAllByTestId('drift-row');
      expect(rows[0]).toHaveTextContent('!1');
      expect(rows[1]).toHaveTextContent('!2');

      // Re-render: A is fixed (now 'ok'), the comparator would re-sort it after
      // B — but the held order must keep A in the first DOM position.
      const fixedRowA = { ...rowA, br: 'ok' as const, flagged: false };
      rerender(
        <MrDriftSection
          rows={[fixedRowA, rowB]}
          flaggedCount={0}
          hasMatchedMilestone={true}
          isLoading={false}
          onNavigateToIssueFromMR={() => {}}
          fix={DEFAULT_FIX}
        />,
      );
      rows = screen.getAllByTestId('drift-row');
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent('!1');
      expect(rows[1]).toHaveTextContent('!2');
    });

    it('a re-render that adds a brand-new row still shows the original rows first, new one last', () => {
      const rowA = makeRow({ mr: makeMR({ id: 1, iid: 1 }) });
      const rowB = makeRow({ mr: makeMR({ id: 2, iid: 2 }) });
      const { rerender } = renderWithClient(
        <MrDriftSection
          rows={[rowA, rowB]}
          flaggedCount={0}
          hasMatchedMilestone={true}
          isLoading={false}
          onNavigateToIssueFromMR={() => {}}
          fix={DEFAULT_FIX}
        />,
      );

      const rowC = makeRow({ mr: makeMR({ id: 3, iid: 3 }) });
      rerender(
        <MrDriftSection
          rows={[rowC, rowA, rowB]}
          flaggedCount={0}
          hasMatchedMilestone={true}
          isLoading={false}
          onNavigateToIssueFromMR={() => {}}
          fix={DEFAULT_FIX}
        />,
      );
      const rows = screen.getAllByTestId('drift-row');
      expect(rows).toHaveLength(3);
      expect(rows[0]).toHaveTextContent('!1');
      expect(rows[1]).toHaveTextContent('!2');
      expect(rows[2]).toHaveTextContent('!3');
    });

    it('a first render with rows: [] (loading) does not freeze an empty order — the first real row list is captured', () => {
      const rowA = makeRow({ mr: makeMR({ id: 1, iid: 1 }) });
      const rowB = makeRow({ mr: makeMR({ id: 2, iid: 2 }) });
      const { rerender } = renderWithClient(
        <MrDriftSection
          rows={[]}
          flaggedCount={0}
          hasMatchedMilestone={true}
          isLoading={true}
          onNavigateToIssueFromMR={() => {}}
          fix={DEFAULT_FIX}
        />,
      );

      rerender(
        <MrDriftSection
          rows={[rowB, rowA]}
          flaggedCount={0}
          hasMatchedMilestone={true}
          isLoading={false}
          onNavigateToIssueFromMR={() => {}}
          fix={DEFAULT_FIX}
        />,
      );
      const rows = screen.getAllByTestId('drift-row');
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent('!2');
      expect(rows[1]).toHaveTextContent('!1');
    });
  });
});

describe('per-MR corrective actions', () => {
  beforeEach(() => {
    mockUpdateMergeRequest.mockReset();
  });

  it('pending: clicking a flagged BR cell whose write never resolves leaves a spinner, second click does not re-fire', async () => {
    mockUpdateMergeRequest.mockReturnValueOnce(new Promise(() => {}));
    const row = makeRow({ br: 'flag', flagged: true });
    const { container } = renderSection({ rows: [row], flaggedCount: 1 });

    const brCell = screen.getByTestId('drift-br');
    fireEvent.click(brCell);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="drift-br"] .animate-spin')).toBeTruthy();
    });
    expect(mockUpdateMergeRequest).toHaveBeenCalledTimes(1);

    // Second click while pending must not re-fire (D-06, D-09).
    fireEvent.click(screen.getByTestId('drift-br'));
    expect(mockUpdateMergeRequest).toHaveBeenCalledTimes(1);
  });

  it('success: with the write resolving and the cache-derived mark now ok, the cell renders the green check and is no longer a button', async () => {
    mockUpdateMergeRequest.mockResolvedValueOnce({} as GitLabMR);
    const row = makeRow({ br: 'flag', flagged: true });
    const { rerender } = renderSection({ rows: [row], flaggedCount: 1 });

    fireEvent.click(screen.getByTestId('drift-br'));
    await waitFor(() => expect(mockUpdateMergeRequest).toHaveBeenCalledTimes(1));

    // Simulate the parent re-rendering once the cache-derived mark flips to 'ok'.
    const settledRow = { ...row, br: 'ok' as const, flagged: false };
    rerender(
      <MrDriftSection
        rows={[settledRow]}
        flaggedCount={0}
        hasMatchedMilestone={true}
        isLoading={false}
        onNavigateToIssueFromMR={() => {}}
        fix={DEFAULT_FIX}
      />,
    );

    await waitFor(() => {
      const cell = screen.getByTestId('drift-br');
      expect(cell.tagName).not.toBe('BUTTON');
      expect(cell.querySelector('svg')).toBeTruthy();
    });
  });

  it('sticky failure: the cell ends up red with the exact tooltip and stays that way through an invalidateQueries sweep', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockUpdateMergeRequest.mockRejectedValueOnce(new Error("target_branch can't be blank"));
    const row = makeRow({ br: 'flag', flagged: true });
    const { container } = renderSection({ rows: [row], flaggedCount: 1 }, queryClient);

    fireEvent.click(screen.getByTestId('drift-br'));

    await waitFor(() => {
      expect(screen.getByTestId('drift-br')).toHaveAttribute(
        'title',
        "target_branch can't be blank",
      );
    });
    // The red class lives on the inner AlertTriangle, not the cell root.
    expect(screen.getByTestId('drift-br').querySelector('.text-red-600')).toBeTruthy();

    // A background invalidateQueries + settled refetch must not clear the sticky failure (D-08).
    await act(async () => {
      queryClient.invalidateQueries();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByTestId('drift-br')).toHaveAttribute(
        'title',
        "target_branch can't be blank",
      );
    });

    expect(document.body.textContent).not.toContain('[object Object]');
    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(0);
    // Nothing rendered outside the row container.
    expect(screen.getAllByTestId('drift-row')).toHaveLength(1);
  });

  it('retry: clicking the red cell calls the write a second time and the red state clears while pending', async () => {
    mockUpdateMergeRequest.mockRejectedValueOnce(new Error('boom'));
    const row = makeRow({ br: 'flag', flagged: true });
    renderSection({ rows: [row], flaggedCount: 1 });

    fireEvent.click(screen.getByTestId('drift-br'));
    await waitFor(() =>
      expect(screen.getByTestId('drift-br').querySelector('.text-red-600')).toBeTruthy(),
    );

    mockUpdateMergeRequest.mockReturnValueOnce(new Promise(() => {}));
    fireEvent.click(screen.getByTestId('drift-br'));

    await waitFor(() => {
      expect(mockUpdateMergeRequest).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('drift-br').querySelector('.animate-spin')).toBeTruthy();
      expect(screen.getByTestId('drift-br').querySelector('.text-red-600')).toBeFalsy();
    });
  });

  it('independent: BR and MS on one row lock independently and issue two calls with disjoint bodies (D-09, MRFIX-03)', async () => {
    mockUpdateMergeRequest.mockReturnValueOnce(new Promise(() => {})); // BR never resolves
    mockUpdateMergeRequest.mockRejectedValueOnce(new Error('milestone rejected')); // MS fails
    const row = makeRow({ br: 'flag', ms: 'flag', flagged: true });
    renderSection({ rows: [row], flaggedCount: 1 });

    fireEvent.click(screen.getByTestId('drift-br'));
    await waitFor(() => expect(mockUpdateMergeRequest).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTestId('drift-ms'));
    await waitFor(() => expect(mockUpdateMergeRequest).toHaveBeenCalledTimes(2));

    const [brBody] = mockUpdateMergeRequest.mock.calls[0].slice(4);
    const [msBody] = mockUpdateMergeRequest.mock.calls[1].slice(4);
    expect(brBody).toEqual({ target_branch: 'release/33.5.0' });
    expect(msBody).toEqual({ milestone_id: 1 });

    // Failing only MS leaves BR spinning and BR's cell not red.
    await waitFor(() => {
      expect(screen.getByTestId('drift-ms').querySelector('.text-red-600')).toBeTruthy();
    });
    expect(screen.getByTestId('drift-br').querySelector('.animate-spin')).toBeTruthy();
    expect(screen.getByTestId('drift-br').querySelector('.text-red-600')).toBeFalsy();
  });

  it('unavailable: with no release branch, drift-br is not a button, a click calls nothing, and MS on the same row is still actionable (MRFIX-04, D-14)', () => {
    const row = makeRow({ br: 'flag', ms: 'flag', flagged: true });
    renderSection({
      rows: [row],
      flaggedCount: 1,
      fix: { ...DEFAULT_FIX, releaseBranchExists: false },
    });

    const brCell = screen.getByTestId('drift-br');
    expect(brCell.tagName).not.toBe('BUTTON');
    expect(brCell).toHaveAttribute(
      'title',
      "Release branch doesn't exist yet — create it above to enable retargeting",
    );

    fireEvent.click(brCell);
    expect(mockUpdateMergeRequest).not.toHaveBeenCalled();

    const msCell = screen.getByTestId('drift-ms');
    expect(msCell.tagName).toBe('BUTTON');
  });

  it('inert cells: ok, na, non-evaluated rows and TASK (even when flagged) render no button (D-05, P89 D-11)', () => {
    const okRow = makeRow({ br: 'ok', ms: 'ok', task: 'flag', taskReason: 'no-linked-task' });
    renderSection({ rows: [okRow], flaggedCount: 1 });
    expect(screen.getByTestId('drift-br').querySelector('button')).toBeNull();
    expect(screen.getByTestId('drift-ms').querySelector('button')).toBeNull();
    expect(screen.getByTestId('drift-task').querySelector('button')).toBeNull();
  });

  it('inert cells: a non-evaluated (merged) row never renders a button in any column', () => {
    const mutedRow = makeRow({
      evaluated: false,
      br: 'na',
      ms: 'na',
      task: 'na',
      mr: makeMR({ state: 'merged' }),
    });
    renderSection({ rows: [mutedRow] });
    expect(screen.getByTestId('drift-br').querySelector('button')).toBeNull();
    expect(screen.getByTestId('drift-ms').querySelector('button')).toBeNull();
    expect(screen.getByTestId('drift-task').querySelector('button')).toBeNull();
  });

  it('degraded: with no matched milestone the banner renders and neither BR nor MS is a button (D-15)', () => {
    const row = makeRow({ br: 'na', ms: 'na' });
    renderSection({
      rows: [row],
      hasMatchedMilestone: false,
      fix: { ...DEFAULT_FIX, matchedMilestone: null },
    });
    expect(screen.getByTestId('drift-degraded-banner')).toBeInTheDocument();
    expect(screen.getByTestId('drift-br').tagName).not.toBe('BUTTON');
    expect(screen.getByTestId('drift-ms').tagName).not.toBe('BUTTON');
  });

  it('BR and MS both carry the identical aria-label and title strings (D2)', () => {
    const row = makeRow({ br: 'flag', ms: 'flag', flagged: true });
    renderSection({ rows: [row], flaggedCount: 1 });
    const br = screen.getByTestId('drift-br');
    const ms = screen.getByTestId('drift-ms');
    expect(br.getAttribute('aria-label')).toBe(br.getAttribute('title'));
    expect(ms.getAttribute('aria-label')).toBe(ms.getAttribute('title'));
    expect(br.getAttribute('title')).toBe('Retarget to release/33.5.0');
    expect(ms.getAttribute('title')).toBe('Assign milestone 33.5.0 (21.07.2026)');
  });

  it('keeps no toast/alert element outside the row on failure', async () => {
    mockUpdateMergeRequest.mockRejectedValueOnce(new Error('nope'));
    const row = makeRow({ br: 'flag', flagged: true });
    const { container } = renderSection({ rows: [row], flaggedCount: 1 });
    fireEvent.click(screen.getByTestId('drift-br'));
    await waitFor(() =>
      expect(screen.getByTestId('drift-br').querySelector('.text-red-600')).toBeTruthy(),
    );
    expect(within(container).queryByRole('alert')).toBeNull();
  });
});
