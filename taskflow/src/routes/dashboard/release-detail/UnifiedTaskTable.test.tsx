// DRIFT-05/06/08, MRFIX-01..04 (Phase 91.1 plan 04): UnifiedTaskTable is
// presentational and props-driven, replacing IssuesSection + MrDriftSection.
// This file relocates MrDriftSection.test.tsx's per-MR corrective-action
// state-machine coverage case-for-case (see 91.1-VALIDATION.md's
// coverage-preservation rule) and adds the new cases the merged row shape
// introduces (D-04/D-05/D-06/D-09/D-13/D-14/D-15/D-16/D-17).
//
// Per-MR corrective action cells consume the real useMrFixMutation hook, so
// every render needs a QueryClientProvider — mock @/services/gitlab's
// updateMergeRequest, not the hook, to exercise the real status/cache
// machinery from a click.
//
// Sanctioned losses (per 91.1-VALIDATION.md / 91.1-04-PLAN.md):
//   - the frozen-order mechanism (D-11) and its reorder helper — that
//     mechanism no longer exists (row order is now the component's contract).
//   - All TASK-column ("BR/MS-adjacent third cell") assertions — that column
//     is dropped (D-06, criterion 4). Two MrDriftSection tests existed solely
//     to assert the TASK cell ("renders an em-dash placeholder and 'No linked
//     task' title for no-linked-task", "names the extracted key in the
//     TASK-cell title for not-in-fix-version") and have no counterpart here.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { act } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateMergeRequest } from '@/services/gitlab';
import type { GitLabMR } from '@/services/gitlab';
import type { JiraIssue } from '@/services/jira';
import type { DriftRow } from './driftDetection';
import {
  matchTicketKeyInTitle,
  type MrFixContext,
  UnifiedTaskTable,
  type UnifiedTaskTableProps,
} from './UnifiedTaskTable';

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

let issueSeq = 0;
function makeIssue(overrides: { key?: string; summary?: string } = {}): JiraIssue {
  issueSeq += 1;
  return {
    id: String(issueSeq),
    key: overrides.key ?? `PROJ-${issueSeq}`,
    fields: {
      summary: overrides.summary ?? 'Something',
      status: { id: '1', name: 'Status', statusCategory: { key: 'new' } },
      assignee: null,
      customfield_10016: null,
      issuetype: { name: 'Story', subtask: false },
    },
  } as unknown as JiraIssue;
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

/** Default props builder — every `it` supplies only the fields it cares about. */
function defaultProps(overrides: Partial<UnifiedTaskTableProps> = {}): UnifiedTaskTableProps {
  return {
    issueCounts: undefined,
    versionName: '33.5.0',
    hasReleaseDate: true,
    isLoadingIssues: false,
    isLoadingDrift: false,
    driftUnavailable: false,
    hasMatchedMilestone: true,
    primaryRows: [],
    secondaryRows: [],
    flaggedMrCount: 0,
    onOpenIssue: vi.fn(),
    onOpenIssueFull: vi.fn(),
    onSeedBreadcrumb: vi.fn(),
    onNavigateToIssueFromMR: vi.fn(),
    fix: DEFAULT_FIX,
    ...overrides,
  };
}

function renderSection(
  overrides: Partial<UnifiedTaskTableProps> = {},
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  const props = defaultProps(overrides);
  return { ...renderWithClient(<UnifiedTaskTable {...props} />, queryClient), props };
}

/**
 * Wraps `rows` under a single fresh task so most relocated MrDriftSection
 * cases (which only cared about one row's MR-slot state) stay one-liners:
 * `renderWithRows([row], { flaggedMrCount: 1 })` mirrors the old
 * `renderSection({ rows: [row], flaggedCount: 1 })`.
 */
function renderWithRows(
  rows: DriftRow[],
  overrides: Partial<UnifiedTaskTableProps> = {},
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  return renderSection(
    {
      primaryRows: [{ issue: makeIssue(), mrs: rows }],
      isLoadingDrift: false,
      ...overrides,
    },
    queryClient,
  );
}

describe('UnifiedTaskTable', () => {
  it('renders primaryRows in the given order (D-04/D-13 row order is now the component contract)', () => {
    const flagged = makeRow({ mr: makeMR({ id: 1, iid: 10 }), flagged: true, br: 'flag' });
    const clean = makeRow({ mr: makeMR({ id: 2, iid: 5 }) });
    const taskB = makeIssue({ key: 'PROJ-2' });
    const taskA = makeIssue({ key: 'PROJ-1' });
    renderSection({
      primaryRows: [
        { issue: taskB, mrs: [flagged] },
        { issue: taskA, mrs: [clean] },
      ],
    });

    const taskKeys = screen.getAllByTestId('task-row').map((el) => el.textContent);
    expect(taskKeys[0]).toContain('PROJ-2');
    expect(taskKeys[1]).toContain('PROJ-1');
    const rows = screen.getAllByTestId('drift-row');
    expect(rows[0]).toHaveTextContent('!10');
    expect(rows[1]).toHaveTextContent('!5');
  });

  it('renders the warning glyph for a flagged BR mark', () => {
    const row = makeRow({ br: 'flag', flagged: true });
    renderWithRows([row], { flaggedMrCount: 1 });
    const brCell = screen.getByTestId('drift-br');
    expect(brCell.querySelector('svg')).toBeTruthy();
  });

  it('renders a check for an ok mark and an em dash for na', () => {
    const row = makeRow({ br: 'ok', ms: 'na' });
    renderWithRows([row]);
    expect(screen.getByTestId('drift-br').querySelector('svg')).toBeTruthy();
    expect(screen.getByTestId('drift-ms')).toHaveTextContent('—');
  });

  it('mutes title text for a non-evaluated row and renders an em dash in both BR/MS columns', () => {
    const row = makeRow({
      evaluated: false,
      br: 'na',
      ms: 'na',
      task: 'na',
      mr: makeMR({ state: 'merged', title: 'Merged thing' }),
    });
    renderWithRows([row]);
    expect(screen.getByTestId('drift-br')).toHaveTextContent('—');
    expect(screen.getByTestId('drift-ms')).toHaveTextContent('—');
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
    renderWithRows([row], { flaggedMrCount: 1 });
    expect(screen.getByTestId('drift-br').querySelector('svg')).toBeTruthy();
    expect(screen.getByTestId('drift-br')).not.toHaveTextContent('—');
  });

  it('renders the primary-table empty-state copy when primaryRows is empty and not loading', () => {
    renderSection({ primaryRows: [], isLoadingIssues: false });
    expect(screen.getByText('No issues in this fix version')).toBeInTheDocument();
  });

  it('renders the passed flaggedMrCount in the flagged-count badge', () => {
    renderSection({ flaggedMrCount: 3 });
    expect(screen.getByText('Issues')).toBeInTheDocument();
    expect(screen.getByTestId('flagged-count-badge')).toHaveTextContent('3');
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
        renderWithRows([makeRow({ mr: makeMR({ title }) })]);
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
});

describe('per-MR corrective actions', () => {
  beforeEach(() => {
    mockUpdateMergeRequest.mockReset();
  });

  it('pending: clicking a flagged BR cell whose write never resolves leaves a spinner, second click does not re-fire', async () => {
    mockUpdateMergeRequest.mockReturnValueOnce(new Promise(() => {}));
    const row = makeRow({ br: 'flag', flagged: true });
    const { container } = renderWithRows([row], { flaggedMrCount: 1 });

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

  // WR-05: the pending state used to swap the <button> for a <span>, which
  // drops focus to document.body — a keyboard user could not tab back to the
  // cell they just activated, and the resulting error button never got focus
  // either. The failure was also announced to nobody.
  it('a11y: keyboard focus survives pending and the failure, and the error is announced', async () => {
    let rejectWrite: (err: Error) => void = () => {};
    mockUpdateMergeRequest.mockReturnValueOnce(
      new Promise<GitLabMR>((_resolve, reject) => {
        rejectWrite = reject;
      }),
    );
    const row = makeRow({ br: 'flag', flagged: true });
    renderWithRows([row], { flaggedMrCount: 1 });

    const brCell = screen.getByTestId('drift-br');
    brCell.focus();
    expect(document.activeElement).toBe(brCell);

    fireEvent.click(brCell);

    await waitFor(() =>
      expect(screen.getByTestId('drift-br')).toHaveAttribute('aria-busy', 'true'),
    );
    // Still the same focused button, not a span and not document.body.
    expect(screen.getByTestId('drift-br').tagName).toBe('BUTTON');
    expect(document.activeElement).toBe(screen.getByTestId('drift-br'));
    // Inert while pending without `disabled` (which would blur it).
    expect(screen.getByTestId('drift-br')).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByTestId('drift-br'));
    expect(mockUpdateMergeRequest).toHaveBeenCalledTimes(1);

    await act(async () => {
      rejectWrite(new Error('protected branch'));
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(screen.getByTestId('drift-br').querySelector('.text-red-600')).toBeTruthy(),
    );
    expect(document.activeElement).toBe(screen.getByTestId('drift-br'));
    expect(screen.getByRole('status')).toHaveTextContent('protected branch');
  });

  it('success: with the write resolving and the cache-derived mark now ok, the cell renders the green check and is no longer a button', async () => {
    mockUpdateMergeRequest.mockResolvedValueOnce({} as GitLabMR);
    const row = makeRow({ br: 'flag', flagged: true });
    const { rerender, props } = renderWithRows([row], { flaggedMrCount: 1 });

    fireEvent.click(screen.getByTestId('drift-br'));
    await waitFor(() => expect(mockUpdateMergeRequest).toHaveBeenCalledTimes(1));

    // Simulate the parent re-rendering once the cache-derived mark flips to 'ok'.
    const settledRow = { ...row, br: 'ok' as const, flagged: false };
    rerender(
      <UnifiedTaskTable
        {...props}
        primaryRows={[{ issue: props.primaryRows[0].issue, mrs: [settledRow] }]}
        flaggedMrCount={0}
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
    const { container } = renderWithRows([row], { flaggedMrCount: 1 }, queryClient);

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
    renderWithRows([row], { flaggedMrCount: 1 });

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
    renderWithRows([row], { flaggedMrCount: 1 });

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

  // WR-08: the error branch used to be evaluated before both `actionable` and
  // `mark === 'ok'`, so a red cell stayed a live button whose retry could not
  // possibly succeed, and stayed red over a row that was already fixed.
  it('error + prerequisite gone: the cell stops being a retry button and explains itself', async () => {
    mockUpdateMergeRequest.mockRejectedValueOnce(new Error('protected branch'));
    const row = makeRow({ br: 'flag', flagged: true });
    const { rerender, props } = renderWithRows([row], { flaggedMrCount: 1 });

    fireEvent.click(screen.getByTestId('drift-br'));
    await waitFor(() =>
      expect(screen.getByTestId('drift-br').querySelector('.text-red-600')).toBeTruthy(),
    );
    expect(screen.getByTestId('drift-br').tagName).toBe('BUTTON');

    // The release branch disappears underneath the failure.
    rerender(<UnifiedTaskTable {...props} fix={{ ...DEFAULT_FIX, releaseBranchExists: false }} />);

    const cell = screen.getByTestId('drift-br');
    expect(cell.tagName).not.toBe('BUTTON');
    expect(cell.querySelector('.text-red-600')).toBeTruthy();
    expect(cell).toHaveAttribute('title', 'protected branch');
    fireEvent.click(cell);
    expect(mockUpdateMergeRequest).toHaveBeenCalledTimes(1);
  });

  it('error cleared: a refetch showing the field is now ok replaces the red retry with the green check', async () => {
    mockUpdateMergeRequest.mockRejectedValueOnce(new Error('protected branch'));
    const row = makeRow({ br: 'flag', flagged: true });
    const { rerender, props } = renderWithRows([row], { flaggedMrCount: 1 });

    fireEvent.click(screen.getByTestId('drift-br'));
    await waitFor(() =>
      expect(screen.getByTestId('drift-br').querySelector('.text-red-600')).toBeTruthy(),
    );

    // A background refetch reports the branch is correct after all (fixed in
    // GitLab directly, or by another user).
    rerender(
      <UnifiedTaskTable
        {...props}
        primaryRows={[
          {
            issue: props.primaryRows[0].issue,
            mrs: [{ ...row, br: 'ok' as const, flagged: false }],
          },
        ]}
        flaggedMrCount={0}
      />,
    );

    await waitFor(() => {
      const cell = screen.getByTestId('drift-br');
      expect(cell.querySelector('.text-red-600')).toBeFalsy();
      expect(cell.querySelector('.text-green-600')).toBeTruthy();
      expect(cell.tagName).not.toBe('BUTTON');
    });
    // Clearing the stale failure must not have fired another write.
    expect(mockUpdateMergeRequest).toHaveBeenCalledTimes(1);
  });

  it('unavailable: with no release branch, drift-br is not a button, a click calls nothing, and MS on the same row is still actionable (MRFIX-04, D-14)', () => {
    const row = makeRow({ br: 'flag', ms: 'flag', flagged: true });
    renderWithRows([row], {
      flaggedMrCount: 1,
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

  it('inert cells: ok and na marks render no button (D-05, P89 D-11)', () => {
    const okRow = makeRow({ br: 'ok', ms: 'ok' });
    renderWithRows([okRow], { flaggedMrCount: 1 });
    expect(screen.getByTestId('drift-br').querySelector('button')).toBeNull();
    expect(screen.getByTestId('drift-ms').querySelector('button')).toBeNull();
  });

  it('inert cells: a non-evaluated (merged) row never renders a button in any column', () => {
    const mutedRow = makeRow({
      evaluated: false,
      br: 'na',
      ms: 'na',
      task: 'na',
      mr: makeMR({ state: 'merged' }),
    });
    renderWithRows([mutedRow]);
    expect(screen.getByTestId('drift-br').querySelector('button')).toBeNull();
    expect(screen.getByTestId('drift-ms').querySelector('button')).toBeNull();
  });

  it('degraded: with no matched milestone the banner renders and neither BR nor MS is a button (D-15, D-16)', () => {
    const row = makeRow({ br: 'na', ms: 'na' });
    renderWithRows([row], {
      hasMatchedMilestone: false,
      fix: { ...DEFAULT_FIX, matchedMilestone: null },
    });
    expect(screen.getByTestId('drift-degraded-banner')).toBeInTheDocument();
    expect(screen.getByTestId('drift-br').tagName).not.toBe('BUTTON');
    expect(screen.getByTestId('drift-ms').tagName).not.toBe('BUTTON');
  });

  it('BR and MS both carry the identical aria-label and title strings (D2)', () => {
    const row = makeRow({ br: 'flag', ms: 'flag', flagged: true });
    renderWithRows([row], { flaggedMrCount: 1 });
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
    const { container } = renderWithRows([row], { flaggedMrCount: 1 });
    fireEvent.click(screen.getByTestId('drift-br'));
    await waitFor(() =>
      expect(screen.getByTestId('drift-br').querySelector('.text-red-600')).toBeTruthy(),
    );
    expect(within(container).queryByRole('alert')).toBeNull();
  });
});

// D-17/CR-02: the five MR-slot states (pending/failed/none/unavailable/resolved)
// are mutually exclusive, with pending gated first, then failed, so a channel
// that never answered can never be mistaken for a verified absence.
describe('D-17: five mutually exclusive MR-slot states', () => {
  it('D-17: isLoadingDrift: true with mrs: [] renders mr-slot-pending and neither mr-slot-none nor mr-slot-unavailable', () => {
    renderWithRows([], { isLoadingDrift: true });
    expect(screen.getByTestId('mr-slot-pending')).toBeInTheDocument();
    expect(screen.queryByTestId('mr-slot-none')).toBeNull();
    expect(screen.queryByTestId('mr-slot-unavailable')).toBeNull();
  });

  it('isLoadingDrift: true does not flash the "No merge request" false alarm even for a task that will resolve to zero MRs', () => {
    renderWithRows([], { isLoadingDrift: true, hasMatchedMilestone: true });
    expect(screen.queryByTestId('mr-slot-none')).toBeNull();
    expect(screen.queryByText('No merge request')).toBeNull();
  });

  it('isLoadingDrift: false, mrs: [], hasMatchedMilestone: true renders mr-slot-none only', () => {
    renderWithRows([], { isLoadingDrift: false, hasMatchedMilestone: true });
    expect(screen.getByTestId('mr-slot-none')).toBeInTheDocument();
    expect(screen.queryByTestId('mr-slot-pending')).toBeNull();
    expect(screen.queryByTestId('mr-slot-unavailable')).toBeNull();
  });

  it('isLoadingDrift: false, mrs: [], hasMatchedMilestone: false renders mr-slot-unavailable only, with the tooltip and no orange warning', () => {
    renderWithRows([], { isLoadingDrift: false, hasMatchedMilestone: false });
    const unavailable = screen.getByTestId('mr-slot-unavailable');
    expect(unavailable).toHaveAttribute(
      'title',
      'No GitLab milestone matched — cannot check for MRs',
    );
    expect(screen.queryByTestId('mr-slot-none')).toBeNull();
    expect(screen.queryByTestId('mr-slot-pending')).toBeNull();
    expect(unavailable.querySelector('.text-orange-600')).toBeNull();
  });

  it('isLoadingDrift: false with two MRs renders two drift-row elements and no slot-state line', () => {
    const rowA = makeRow({ mr: makeMR({ id: 1, iid: 1 }) });
    const rowB = makeRow({ mr: makeMR({ id: 2, iid: 2 }) });
    renderWithRows([rowA, rowB], { isLoadingDrift: false });
    expect(screen.getAllByTestId('drift-row')).toHaveLength(2);
    expect(screen.queryByTestId('mr-slot-pending')).toBeNull();
    expect(screen.queryByTestId('mr-slot-none')).toBeNull();
    expect(screen.queryByTestId('mr-slot-unavailable')).toBeNull();
  });

  it('Test 3 (CR-02): driftUnavailable: true, mrs: [], hasMatchedMilestone: true renders mr-slot-failed only', () => {
    renderWithRows([], {
      isLoadingDrift: false,
      driftUnavailable: true,
      hasMatchedMilestone: true,
    });
    expect(screen.getByTestId('mr-slot-failed')).toBeInTheDocument();
    expect(screen.queryByTestId('mr-slot-none')).toBeNull();
    expect(screen.queryByTestId('mr-slot-unavailable')).toBeNull();
    expect(screen.queryByTestId('mr-slot-pending')).toBeNull();
  });

  it('Test 4 (CR-02): mr-slot-failed contains no .text-orange-600 element (neutral, not a warning)', () => {
    renderWithRows([], {
      isLoadingDrift: false,
      driftUnavailable: true,
      hasMatchedMilestone: true,
    });
    const failed = screen.getByTestId('mr-slot-failed');
    expect(failed.querySelector('.text-orange-600')).toBeNull();
    expect(failed).toHaveAttribute(
      'title',
      "GitLab merge request lookup failed — this task's MR status is unknown",
    );
  });

  it('Test 5 (CR-02): isLoadingDrift: true still wins over driftUnavailable: true (mr-slot-pending renders, mr-slot-failed does not)', () => {
    renderWithRows([], { isLoadingDrift: true, driftUnavailable: true });
    expect(screen.getByTestId('mr-slot-pending')).toBeInTheDocument();
    expect(screen.queryByTestId('mr-slot-failed')).toBeNull();
  });
});

describe('D-04: task row click behaviour', () => {
  it('clicking the row body calls onSeedBreadcrumb then onOpenIssue with the issue key, and does NOT call onOpenIssueFull', () => {
    const onOpenIssue = vi.fn();
    const onOpenIssueFull = vi.fn();
    const onSeedBreadcrumb = vi.fn();
    const issue = makeIssue({ key: 'PROJ-7' });
    renderSection({
      primaryRows: [{ issue, mrs: [] }],
      onOpenIssue,
      onOpenIssueFull,
      onSeedBreadcrumb,
    });

    fireEvent.click(screen.getByTestId('task-row-overlay'));
    expect(onSeedBreadcrumb).toHaveBeenCalledTimes(1);
    expect(onOpenIssue).toHaveBeenCalledWith('PROJ-7');
    expect(onOpenIssueFull).not.toHaveBeenCalled();
  });

  it('clicking the key button calls onOpenIssueFull and does NOT call onOpenIssue', () => {
    const onOpenIssue = vi.fn();
    const onOpenIssueFull = vi.fn();
    const issue = makeIssue({ key: 'PROJ-7' });
    renderSection({ primaryRows: [{ issue, mrs: [] }], onOpenIssue, onOpenIssueFull });

    fireEvent.click(screen.getByText('PROJ-7'));
    expect(onOpenIssueFull).toHaveBeenCalledWith('PROJ-7');
    expect(onOpenIssue).not.toHaveBeenCalled();
  });

  it('the task row container is not role="button" and the overlay is a sibling of the key button, not its ancestor', () => {
    const issue = makeIssue({ key: 'PROJ-7' });
    renderSection({ primaryRows: [{ issue, mrs: [] }] });

    const taskRow = screen.getByTestId('task-row');
    expect(taskRow).not.toHaveAttribute('role', 'button');
    const overlay = screen.getByTestId('task-row-overlay');
    const keyButton = screen.getByText('PROJ-7');
    expect(overlay.parentElement).toBe(taskRow);
    expect(keyButton.parentElement).toBe(taskRow);
    expect(overlay.contains(keyButton)).toBe(false);
    expect(keyButton.contains(overlay)).toBe(false);
  });

  it('an MR sub-line has no line-wide click target: clicking its title text (away from a linkified key) calls none of the row handlers', () => {
    const onOpenIssue = vi.fn();
    const onOpenIssueFull = vi.fn();
    const onSeedBreadcrumb = vi.fn();
    const onNavigateToIssueFromMR = vi.fn();
    const row = makeRow({ mr: makeMR({ title: 'Fix unrelated thing with no ticket key' }) });
    renderWithRows([row], {
      onOpenIssue,
      onOpenIssueFull,
      onSeedBreadcrumb,
      onNavigateToIssueFromMR,
    });

    fireEvent.click(screen.getByText(/Fix unrelated thing/));
    expect(onOpenIssue).not.toHaveBeenCalled();
    expect(onOpenIssueFull).not.toHaveBeenCalled();
    expect(onSeedBreadcrumb).not.toHaveBeenCalled();
    expect(onNavigateToIssueFromMR).not.toHaveBeenCalled();
  });
});

describe('D-05: hover-reveal scope', () => {
  // jsdom does not evaluate `:hover`, and 91.1-VALIDATION.md routes the
  // visual hover confirmation to manual UAT — assert on rendered structure
  // (className placement) instead. Do not "upgrade" this into a fake
  // pointer-simulated hover test.
  it('group/row is present on each MR sub-line element and absent from the task row element', () => {
    const row = makeRow();
    const issue = makeIssue();
    renderSection({ primaryRows: [{ issue, mrs: [row] }] });

    const taskRow = screen.getByTestId('task-row');
    const subLine = screen.getByTestId('drift-row');
    expect(subLine.className).toContain('group/row');
    expect(taskRow.className).not.toContain('group/row');
  });

  it('with two MR sub-lines under one task, the two sub-lines are separate group roots', () => {
    const rowA = makeRow({ mr: makeMR({ id: 1, iid: 1 }) });
    const rowB = makeRow({ mr: makeMR({ id: 2, iid: 2 }) });
    renderWithRows([rowA, rowB]);

    const subLines = screen.getAllByTestId('drift-row');
    expect(subLines).toHaveLength(2);
    for (const line of subLines) {
      expect(line.className).toContain('group/row');
    }
    // Each carries its own group root, not a shared ancestor's class.
    expect(subLines[0]).not.toBe(subLines[1]);
    expect(subLines[0].parentElement).not.toBe(subLines[1]);
  });
});

describe('D-06 / criterion 4: task row gutter', () => {
  it('a task row renders no drift-br/drift-ms element of its own; the only such elements in the tree belong to MR sub-lines', () => {
    const row = makeRow();
    renderWithRows([row]);

    const taskRow = screen.getByTestId('task-row');
    expect(within(taskRow).queryByTestId('drift-br')).toBeNull();
    expect(within(taskRow).queryByTestId('drift-ms')).toBeNull();
    // The only drift-br/drift-ms in the whole tree live on the sub-line.
    expect(screen.getAllByTestId('drift-br')).toHaveLength(1);
    expect(screen.getAllByTestId('drift-ms')).toHaveLength(1);
  });
});

describe('D-09: duplication', () => {
  beforeEach(() => {
    mockUpdateMergeRequest.mockReset();
  });

  it('the same DriftRow supplied under two primaryRows entries renders two drift-row elements, each with its own actionable drift-br button', () => {
    const shared = makeRow({ mr: makeMR({ id: 1, iid: 1 }), br: 'flag', flagged: true });
    renderSection({
      primaryRows: [
        { issue: makeIssue({ key: 'PROJ-1' }), mrs: [shared] },
        { issue: makeIssue({ key: 'PROJ-2' }), mrs: [shared] },
      ],
      flaggedMrCount: 1,
    });

    const drifts = screen.getAllByTestId('drift-row');
    expect(drifts).toHaveLength(2);
    const brButtons = screen.getAllByTestId('drift-br');
    expect(brButtons).toHaveLength(2);
    for (const b of brButtons) expect(b.tagName).toBe('BUTTON');
  });

  it("firing one duplicated copy leaves the other copy's local error state untouched (the wrong-MR write defect this decision guards against)", async () => {
    mockUpdateMergeRequest.mockRejectedValueOnce(new Error('boom'));
    const shared = makeRow({ mr: makeMR({ id: 1, iid: 1 }), br: 'flag', flagged: true });
    renderSection({
      primaryRows: [
        { issue: makeIssue({ key: 'PROJ-1' }), mrs: [shared] },
        { issue: makeIssue({ key: 'PROJ-2' }), mrs: [shared] },
      ],
      flaggedMrCount: 1,
    });

    const [firstBr, secondBr] = screen.getAllByTestId('drift-br');
    fireEvent.click(firstBr);

    await waitFor(() => {
      expect(firstBr.querySelector('.text-red-600')).toBeTruthy();
    });
    // The second copy is an independent hook instance — still the orange
    // actionable button, unaffected by the first copy's failure.
    expect(secondBr.tagName).toBe('BUTTON');
    expect(secondBr.querySelector('.text-red-600')).toBeFalsy();
    expect(secondBr.querySelector('.text-orange-600')).toBeTruthy();
  });
});

describe('D-13: secondary table', () => {
  it('secondaryRows: [] renders no secondary-section and no "Not covered by tasks above" text at all', () => {
    renderSection({ secondaryRows: [] });
    expect(screen.queryByTestId('secondary-section')).toBeNull();
    expect(screen.queryByText('Not covered by tasks above')).toBeNull();
  });

  it('a non-empty secondaryRows renders the section, an out-of-scope-key row, a keyless row, and both carry actionable drift-br/drift-ms cells (D-10)', () => {
    const flaggedKeyRow = makeRow({
      mr: makeMR({ id: 1, iid: 1 }),
      taskReason: 'not-in-fix-version',
      taskKeys: ['PROJ-9'],
      br: 'flag',
      ms: 'flag',
      flagged: true,
    });
    const keylessRow = makeRow({
      mr: makeMR({ id: 2, iid: 2 }),
      taskReason: 'no-linked-task',
      taskKeys: [],
      br: 'flag',
      ms: 'flag',
      flagged: true,
    });
    renderSection({
      secondaryRows: [flaggedKeyRow, keylessRow],
      versionName: '33.5.0',
    });

    expect(screen.getByTestId('secondary-section')).toBeInTheDocument();
    const flaggedKey = screen.getByTestId('secondary-key-flagged');
    expect(flaggedKey).toHaveTextContent('PROJ-9');
    expect(flaggedKey).toHaveAttribute('title', 'PROJ-9 is not in fix version 33.5.0');
    expect(screen.getByTestId('secondary-key-none')).toHaveTextContent('—');

    const brButtons = screen.getAllByTestId('drift-br');
    const msButtons = screen.getAllByTestId('drift-ms');
    expect(brButtons).toHaveLength(2);
    expect(msButtons).toHaveLength(2);
    for (const b of [...brButtons, ...msButtons]) expect(b.tagName).toBe('BUTTON');
  });

  it('a multi-key out-of-scope row names all keys in the tooltip, not just the first (WR-04)', () => {
    const multiKeyRow = makeRow({
      mr: makeMR({ id: 1, iid: 1 }),
      taskReason: 'not-in-fix-version',
      taskKeys: ['PROJ-9', 'PROJ-8'],
      br: 'flag',
      ms: 'flag',
      flagged: true,
    });
    renderSection({
      secondaryRows: [multiKeyRow],
      versionName: '33.5.0',
    });

    const flaggedKey = screen.getByTestId('secondary-key-flagged');
    expect(flaggedKey).toHaveTextContent('PROJ-9 +1');
    expect(flaggedKey).toHaveAttribute('title', 'PROJ-9, PROJ-8 are not in fix version 33.5.0');
  });

  it('a non-evaluated (merged) MR with out-of-scope keys renders secondary-key-unevaluated, not a drift assertion (WR-04, T-91.1-14)', () => {
    const unevaluatedRow = makeRow({
      mr: makeMR({ id: 1, iid: 1, state: 'merged' }),
      evaluated: false,
      taskReason: null,
      taskKeys: ['PROJ-9'],
      task: 'na',
      br: 'na',
      ms: 'na',
      flagged: false,
    });
    renderSection({
      secondaryRows: [unevaluatedRow],
      versionName: '33.5.0',
    });

    const unevaluatedKey = screen.getByTestId('secondary-key-unevaluated');
    expect(unevaluatedKey).toHaveTextContent('PROJ-9');
    expect(unevaluatedKey.querySelector('.text-orange-600')).toBeNull();
    expect(unevaluatedKey).not.toHaveClass('text-orange-600');
    expect(unevaluatedKey.getAttribute('title')).not.toContain('is not in fix version');
    expect(unevaluatedKey).toHaveAttribute('title', 'PROJ-9 — not evaluated (MR is merged)');
  });

  it('no rendered element in the secondary section ever contains "undefined is not in fix version"', () => {
    const flaggedKeyRow = makeRow({
      mr: makeMR({ id: 1, iid: 1 }),
      taskReason: 'not-in-fix-version',
      taskKeys: ['PROJ-9'],
      br: 'flag',
      ms: 'flag',
      flagged: true,
    });
    const keylessRow = makeRow({
      mr: makeMR({ id: 2, iid: 2 }),
      taskReason: 'no-linked-task',
      taskKeys: [],
      br: 'flag',
      ms: 'flag',
      flagged: true,
    });
    const unevaluatedRow = makeRow({
      mr: makeMR({ id: 3, iid: 3, state: 'closed' }),
      evaluated: false,
      taskReason: null,
      taskKeys: ['PROJ-7'],
      task: 'na',
      br: 'na',
      ms: 'na',
      flagged: false,
    });
    const { container } = renderSection({
      secondaryRows: [flaggedKeyRow, keylessRow, unevaluatedRow],
      versionName: '33.5.0',
    });

    expect(container.innerHTML).not.toContain('undefined is not in fix version');
  });

  it('Test 1 (CR-01): isLoadingIssues: true with a non-empty secondaryRows renders no secondary-section and no secondary-key-flagged', () => {
    const flaggedKeyRow = makeRow({
      mr: makeMR({ id: 1, iid: 1 }),
      taskReason: 'not-in-fix-version',
      taskKeys: ['PROJ-9'],
      br: 'flag',
      ms: 'flag',
      flagged: true,
    });
    renderSection({
      secondaryRows: [flaggedKeyRow],
      isLoadingIssues: true,
    });
    expect(screen.queryByTestId('secondary-section')).toBeNull();
    expect(screen.queryByTestId('secondary-key-flagged')).toBeNull();
  });

  it('Test 2 (CR-01): isLoadingIssues: false with the same non-empty secondaryRows still renders secondary-section (no regression of D-13)', () => {
    const flaggedKeyRow = makeRow({
      mr: makeMR({ id: 1, iid: 1 }),
      taskReason: 'not-in-fix-version',
      taskKeys: ['PROJ-9'],
      br: 'flag',
      ms: 'flag',
      flagged: true,
    });
    renderSection({
      secondaryRows: [flaggedKeyRow],
      isLoadingIssues: false,
    });
    expect(screen.getByTestId('secondary-section')).toBeInTheDocument();
    expect(screen.getByTestId('secondary-key-flagged')).toBeInTheDocument();
  });
});

describe('D-14/D-15: header', () => {
  it('the done badge and the flagged-count badge both render, the latter showing the passed flaggedMrCount', () => {
    renderSection({
      issueCounts: { issuesFixed: 4, issuesTotal: 6 },
      flaggedMrCount: 2,
    });
    expect(screen.getByText('4 / 6 done')).toBeInTheDocument();
    expect(screen.getByTestId('flagged-count-badge')).toHaveTextContent('2');
  });

  it('Test 6 (IN-03): flagged-count-badge is hidden while isLoadingDrift, hidden while isLoadingIssues, and shown when both are false', () => {
    const { unmount } = renderSection({ flaggedMrCount: 2, isLoadingDrift: true });
    expect(screen.queryByTestId('flagged-count-badge')).toBeNull();
    unmount();

    const { unmount: unmount2 } = renderSection({ flaggedMrCount: 2, isLoadingIssues: true });
    expect(screen.queryByTestId('flagged-count-badge')).toBeNull();
    unmount2();

    renderSection({ flaggedMrCount: 2, isLoadingDrift: false, isLoadingIssues: false });
    expect(screen.getByTestId('flagged-count-badge')).toHaveTextContent('2');
  });
});

describe('D-16: banner', () => {
  it('with no matched milestone exactly one drift-degraded-banner renders in the whole tree', () => {
    const row = makeRow();
    renderSection({
      primaryRows: [{ issue: makeIssue(), mrs: [row] }],
      secondaryRows: [row],
      hasMatchedMilestone: false,
    });
    expect(screen.getAllByTestId('drift-degraded-banner')).toHaveLength(1);
  });
});
