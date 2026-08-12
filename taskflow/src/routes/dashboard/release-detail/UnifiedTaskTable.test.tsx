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
  selectDisplayMr,
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
    milestoneLookupFailed: false,
    primaryRows: [],
    secondaryRows: [],
    flaggedMrCount: 0,
    brFlaggedCount: 0,
    msFlaggedCount: 0,
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

    const taskRows = screen.getAllByTestId('task-row');
    expect(taskRows[0]).toHaveTextContent('PROJ-2');
    expect(taskRows[1]).toHaveTextContent('PROJ-1');
    const links = screen.getAllByTestId('mr-cell-link');
    expect(links[0]).toHaveTextContent('!10');
    expect(links[1]).toHaveTextContent('!5');
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

  it('a non-evaluated (merged) row renders an em dash in both BR/MS columns and does not show the title inline', () => {
    const row = makeRow({
      evaluated: false,
      br: 'na',
      ms: 'na',
      task: 'na',
      mr: makeMR({ state: 'merged', title: 'Merged thing', iid: 9 }),
    });
    renderWithRows([row]);
    expect(screen.getByTestId('drift-br')).toHaveTextContent('—');
    expect(screen.getByTestId('drift-ms')).toHaveTextContent('—');
    const taskRow = screen.getByTestId('task-row');
    expect(taskRow).toHaveTextContent('!9');
    expect(taskRow).not.toHaveTextContent('Merged thing');
    expect(screen.getByTestId('mr-cell-link')).toHaveAttribute(
      'title',
      expect.stringContaining('Merged thing'),
    );
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

  it('renders the br/ms badges from the passed per-category counts', () => {
    renderSection({ flaggedMrCount: 3, brFlaggedCount: 2, msFlaggedCount: 1 });
    expect(screen.getByText('Issues')).toBeInTheDocument();
    expect(screen.getByTestId('flagged-br-badge')).toHaveTextContent('2');
    expect(screen.getByTestId('flagged-ms-badge')).toHaveTextContent('1');
  });

  // UAT-91.1 (plan 10, task 4): the developer walked task 1/2's decluttered
  // sub-lines, then asked for full consolidation — "I want it all
  // consolidated into one single line for each task by the logic like it
  // was before." The task row now carries the MR link, state badge and
  // BR/MS cells directly; no MR sub-line renders in the primary table.
  describe('Task row MR cell shows the consolidated MR (UAT-91.1 consolidation)', () => {
    it('renders the !iid link and the state badge inline; no drift-row sub-line renders in the primary table', () => {
      const row = makeRow({ mr: makeMR({ iid: 7, title: 'Fix thing', state: 'opened' }) });
      renderWithRows([row]);
      const taskRow = screen.getByTestId('task-row');
      expect(taskRow).toHaveTextContent('!7');
      expect(taskRow).toHaveTextContent('opened');
      expect(screen.queryByTestId('drift-row')).toBeNull();
    });

    it('renders no MR-author avatar/img element and does not show the author name as visible text', () => {
      const row = makeRow({
        mr: makeMR({ author: { id: 1, name: 'Alice', username: 'alice', avatar_url: '' } }),
      });
      renderWithRows([row]);
      // Scope to the MR cell itself, not the whole task row — the task row's
      // own Assignee column legitimately renders an "Unassigned" avatar with
      // role="img" (unrelated to the MR author this test is about).
      const mrCell = screen.getByTestId('mr-cell-link').closest('div') as HTMLElement;
      expect(within(mrCell).queryByRole('img')).toBeNull();
      expect(within(mrCell).queryByText('Alice')).toBeNull();
    });

    it('the MR link carries a title attribute with the author name and the MR title', () => {
      const row = makeRow({
        mr: makeMR({
          author: { id: 1, name: 'Alice', username: 'alice', avatar_url: '' },
          title: 'Fix thing',
        }),
      });
      renderWithRows([row]);
      const link = screen.getByTestId('mr-cell-link');
      expect(link).toHaveAttribute('title', expect.stringContaining('Alice'));
      expect(link).toHaveAttribute('title', expect.stringContaining('Fix thing'));
    });

    it('drift-br and drift-ms cells still render on the consolidated row', () => {
      const row = makeRow({ br: 'flag', ms: 'ok', flagged: true });
      renderWithRows([row], { flaggedMrCount: 1 });
      expect(screen.getByTestId('drift-br')).toBeInTheDocument();
      expect(screen.getByTestId('drift-ms')).toBeInTheDocument();
    });

    it('a task with three MRs still keeps all three in the data — only the most relevant is shown, with a +2 marker', () => {
      const rows = [
        makeRow({ mr: makeMR({ id: 1, iid: 1 }) }),
        makeRow({ mr: makeMR({ id: 2, iid: 2 }) }),
        makeRow({ mr: makeMR({ id: 3, iid: 3 }) }),
      ];
      renderWithRows(rows);
      // No flagged MR — highest iid wins.
      expect(screen.getByTestId('mr-cell-link')).toHaveTextContent('!3');
      const extra = screen.getByTestId('mr-extra-count');
      expect(extra).toHaveTextContent('+2');
      expect(extra).toHaveAttribute('title', expect.stringContaining('!1'));
      expect(extra).toHaveAttribute('title', expect.stringContaining('!2'));
    });

    it('a single MR carries no +N marker', () => {
      renderWithRows([makeRow({ mr: makeMR({ iid: 1 }) })]);
      expect(screen.queryByTestId('mr-extra-count')).toBeNull();
    });
  });

  // MR selection when a task has 2+ MRs — the developer's explicit choice at
  // the live UAT checkpoint (2026-08-12): a flagged MR wins, ties broken by
  // highest iid; with no flag, highest iid wins.
  describe('MR selection when a task has 2+ MRs (UAT-91.1 consolidation)', () => {
    it('a flagged MR wins over a clean MR with a higher iid', () => {
      const clean = makeRow({ mr: makeMR({ id: 1, iid: 9 }) });
      const flagged = makeRow({ mr: makeMR({ id: 2, iid: 2 }), br: 'flag', flagged: true });
      renderWithRows([clean, flagged], { flaggedMrCount: 1 });
      expect(screen.getByTestId('mr-cell-link')).toHaveTextContent('!2');
    });

    it('ties among flagged MRs are broken by highest iid', () => {
      const flaggedLow = makeRow({ mr: makeMR({ id: 1, iid: 3 }), br: 'flag', flagged: true });
      const flaggedHigh = makeRow({ mr: makeMR({ id: 2, iid: 8 }), ms: 'flag', flagged: true });
      renderWithRows([flaggedLow, flaggedHigh], { flaggedMrCount: 1 });
      expect(screen.getByTestId('mr-cell-link')).toHaveTextContent('!8');
    });

    it('with no flagged MR, the highest iid wins', () => {
      const rows = [
        makeRow({ mr: makeMR({ id: 1, iid: 4 }) }),
        makeRow({ mr: makeMR({ id: 2, iid: 11 }) }),
        makeRow({ mr: makeMR({ id: 3, iid: 7 }) }),
      ];
      renderWithRows(rows);
      expect(screen.getByTestId('mr-cell-link')).toHaveTextContent('!11');
    });

    it('selectDisplayMr returns null for an empty list', () => {
      expect(selectDisplayMr([])).toBeNull();
    });

    // WR-09: merged MRs are not evaluated and, on a release branch that has
    // begun landing work, carry the highest iids — so highest-iid-wins
    // surfaced a merged MR and reported "not evaluated" (— / —) for a task
    // whose live MR was correctly targeted and milestoned.
    it('with no flagged MR, an evaluated open MR beats a non-evaluated merged MR with a higher iid', () => {
      const merged = makeRow({
        mr: makeMR({ id: 1, iid: 42, state: 'merged' }),
        evaluated: false,
        br: 'na',
        ms: 'na',
        task: 'na',
      });
      const open = makeRow({ mr: makeMR({ id: 2, iid: 17 }), br: 'ok', ms: 'ok' });

      expect(selectDisplayMr([merged, open])?.mr.iid).toBe(17);

      renderWithRows([merged, open]);
      expect(screen.getByTestId('mr-cell-link')).toHaveTextContent('!17');
      // The verified checks are visible again, not replaced by em dashes.
      expect(screen.getByTestId('drift-br')).not.toHaveTextContent('—');
      expect(screen.getByTestId('drift-br').querySelector('svg')).toBeTruthy();
    });

    it('the flagged tier still outranks the evaluated tier (a clean evaluated MR with a higher iid does not win)', () => {
      const flaggedLowIid = makeRow({
        mr: makeMR({ id: 1, iid: 2 }),
        br: 'flag',
        flagged: true,
      });
      const cleanEvaluatedHighIid = makeRow({ mr: makeMR({ id: 2, iid: 30 }) });

      expect(selectDisplayMr([flaggedLowIid, cleanEvaluatedHighIid])?.mr.iid).toBe(2);
    });

    it('with nothing evaluated and nothing flagged, highest iid still wins', () => {
      const a = makeRow({
        mr: makeMR({ id: 1, iid: 3, state: 'merged' }),
        evaluated: false,
        br: 'na',
        ms: 'na',
      });
      const b = makeRow({
        mr: makeMR({ id: 2, iid: 8, state: 'closed' }),
        evaluated: false,
        br: 'na',
        ms: 'na',
      });

      expect(selectDisplayMr([a, b])?.mr.iid).toBe(8);
    });
  });

  // Separators moved from every row to task-group boundaries at plan 09.
  // Task 4's consolidation removed sub-lines but did not touch the grouping
  // rule — still asserted here for regression coverage.
  describe('separators group task boundaries, not every row', () => {
    it('task-row elements carry no border-b class', () => {
      renderWithRows([makeRow()]);
      expect(screen.getByTestId('task-row').className).not.toContain('border-b');
    });

    it('each per-task group wrapper carries border-b — two tasks means two group separators', () => {
      const taskA = makeIssue({ key: 'PROJ-1' });
      const taskB = makeIssue({ key: 'PROJ-2' });
      renderSection({
        primaryRows: [
          { issue: taskA, mrs: [makeRow({ mr: makeMR({ id: 1 }) })] },
          { issue: taskB, mrs: [makeRow({ mr: makeMR({ id: 2 }) })] },
        ],
      });
      const groups = screen.getAllByTestId('task-group');
      expect(groups).toHaveLength(2);
      for (const g of groups) {
        expect(g.className).toContain('border-b');
      }
    });
  });

  // CR-01 regression: `extractTicketKeys` normalises what it returns (uppercases,
  // and rewrites the space form "PROJ 123" to "PROJ-123"), so the key is often NOT
  // a literal substring of the title. The old highlighter used indexOf(), got -1,
  // and then sliced at `-1 + key.length` — silently deleting `key.length - 1`
  // characters. Titles must render losslessly regardless of key spelling.
  //
  // The primary table no longer renders MR titles inline (task 4's
  // consolidation moved the title into the MR link's hover tooltip) — this
  // linkification behaviour now lives exclusively in the secondary
  // (uncovered-MRs) table's `MrSubLine`, which is unchanged by task 4.
  describe('title rendering does not mangle non-literal ticket keys (CR-01) — secondary table', () => {
    const cases = [
      ['space form', 'PROJ 123 fix the thing'],
      ['lowercase dash form', 'proj-123 fix the thing'],
      ['lowercase space form', 'proj 123 fix the thing'],
      ['canonical dash form', 'PROJ-123 fix the thing'],
      ['key mid-title', 'hotfix for PROJ 123 urgently'],
    ] as const;

    for (const [label, title] of cases) {
      it(`renders the full title verbatim — ${label}`, () => {
        renderSection({
          secondaryRows: [
            makeRow({ mr: makeMR({ title }), taskReason: 'no-linked-task', taskKeys: [] }),
          ],
        });
        // Text is split across button/text nodes, so compare normalised row text.
        // Scoped to the secondary section — the primary table's own empty-state
        // copy ("No issues in this fix version") also contains "fix".
        const secondarySection = screen.getByTestId('secondary-section');
        const row = within(secondarySection)
          .getByText(/fix|hotfix/i)
          .closest('div');
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

describe('WR-05: column header strip labels', () => {
  it('renders visible header text Key, Summary, Assignee and Status alongside BR and MS', () => {
    const issue = makeIssue({ key: 'PROJ-1' });
    renderSection({ primaryRows: [{ issue, mrs: [] }] });

    expect(screen.getByText('Key')).toBeInTheDocument();
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Assignee')).toBeInTheDocument();
    expect(screen.getAllByText('Status').length).toBeGreaterThan(0);
    expect(screen.getByText('BR')).toBeInTheDocument();
    expect(screen.getByText('MS')).toBeInTheDocument();
  });

  it('renders no element with role="table", role="row" or role="columnheader"', () => {
    const issue = makeIssue({ key: 'PROJ-1' });
    const { container } = renderSection({ primaryRows: [{ issue, mrs: [] }] });

    expect(container.querySelector('[role="table"]')).toBeNull();
    expect(container.querySelector('[role="row"]')).toBeNull();
    expect(container.querySelector('[role="columnheader"]')).toBeNull();
  });
});

// WR-06: consolidation deleted MrSubLine's avatar and state cells, but the
// secondary table kept rendering the SHARED strip, so "Assignee", "Status" and
// "MR" labelled columns that no longer exist — they sat over the middle of the
// MR title. Visible labels are the WR-05 accessibility answer; mislabelled ones
// invert it.
describe('WR-06: the secondary table has its own header strip', () => {
  function renderSecondary() {
    return renderSection({
      secondaryRows: [
        makeRow({ mr: makeMR({ id: 1, iid: 1 }), taskReason: 'no-linked-task', taskKeys: [] }),
      ],
    });
  }

  it('labels only the four columns a secondary row actually renders', () => {
    renderSecondary();
    const secondary = within(screen.getByTestId('secondary-section'));

    expect(secondary.getByText('Key')).toBeInTheDocument();
    expect(secondary.getByText('Merge request')).toBeInTheDocument();
    expect(secondary.getByText('BR')).toBeInTheDocument();
    expect(secondary.getByText('MS')).toBeInTheDocument();
  });

  it('does not label Assignee, Status or MR over columns the secondary row dropped', () => {
    renderSecondary();
    const secondary = within(screen.getByTestId('secondary-section'));

    expect(secondary.queryByText('Assignee')).toBeNull();
    expect(secondary.queryByText('Status')).toBeNull();
    expect(secondary.queryByText('MR')).toBeNull();
    expect(secondary.queryByText('Summary')).toBeNull();
  });

  it('the primary strip is unchanged and still labels all seven of its columns', () => {
    renderSection({
      primaryRows: [{ issue: makeIssue(), mrs: [makeRow()] }],
      secondaryRows: [
        makeRow({ mr: makeMR({ id: 2, iid: 2 }), taskReason: 'no-linked-task', taskKeys: [] }),
      ],
    });

    // Two strips now exist, so scope the primary assertions to the task table.
    const taskList = screen.getByTestId('task-list');
    const primaryStrip = taskList.previousElementSibling as HTMLElement;
    for (const label of ['Key', 'Summary', 'Assignee', 'Status', 'MR', 'BR', 'MS']) {
      expect(within(primaryStrip).getByText(label)).toBeInTheDocument();
    }
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
    expect(screen.getAllByTestId('task-row')).toHaveLength(1);
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

  it('isLoadingDrift: false with two MRs renders the consolidated MR cell (not a slot-state line)', () => {
    const rowA = makeRow({ mr: makeMR({ id: 1, iid: 1 }) });
    const rowB = makeRow({ mr: makeMR({ id: 2, iid: 2 }) });
    renderWithRows([rowA, rowB], { isLoadingDrift: false });
    expect(screen.getByTestId('mr-cell-link')).toBeInTheDocument();
    expect(screen.getByTestId('mr-extra-count')).toHaveTextContent('+1');
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

// WR-07: both slots are deliberately `pointer-events-none` (the row click has
// to fall through them), which means the browser never fires the hover their
// `title` needs. Whatever the user must know has to be in the visible text.
describe('WR-07: degraded MR slots explain themselves without a tooltip', () => {
  it('mr-slot-failed says the status is unknown in visible text', () => {
    renderWithRows([], { driftUnavailable: true, hasMatchedMilestone: true });

    const failed = screen.getByTestId('mr-slot-failed');
    expect(failed.className).toContain('pointer-events-none');
    expect(failed.textContent).toMatch(/unknown/i);
    // The tooltip survives as supplementary detail, never as the sole carrier.
    expect(failed).toHaveAttribute(
      'title',
      "GitLab merge request lookup failed — this task's MR status is unknown",
    );
  });

  it('mr-slot-unavailable names the missing milestone in visible text', () => {
    renderWithRows([], { hasMatchedMilestone: false });

    const unavailable = screen.getByTestId('mr-slot-unavailable');
    expect(unavailable.className).toContain('pointer-events-none');
    expect(unavailable.textContent).toMatch(/milestone/i);
    expect(unavailable.textContent).toMatch(/not checked/i);
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

  it('a secondary-table MR sub-line has no line-wide click target: clicking its title text calls none of the row handlers', () => {
    const onOpenIssue = vi.fn();
    const onOpenIssueFull = vi.fn();
    const onSeedBreadcrumb = vi.fn();
    const onNavigateToIssueFromMR = vi.fn();
    const row = makeRow({
      mr: makeMR({ title: 'Fix unrelated thing with no ticket key' }),
      taskReason: 'no-linked-task',
      taskKeys: [],
    });
    renderSection({
      secondaryRows: [row],
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

  it('the MR cell link is a sibling of the overlay, not nested inside it (sibling overlay pattern)', () => {
    const row = makeRow({ mr: makeMR({ iid: 4 }) });
    renderWithRows([row]);

    const overlay = screen.getByTestId('task-row-overlay');
    const mrLink = screen.getByTestId('mr-cell-link');
    expect(overlay.contains(mrLink)).toBe(false);
    expect(mrLink.contains(overlay)).toBe(false);
  });

  it('clicking the MR cell link does not trigger the row overlay handlers', () => {
    const onOpenIssue = vi.fn();
    const onSeedBreadcrumb = vi.fn();
    const row = makeRow({ mr: makeMR({ iid: 4 }) });
    renderWithRows([row], { onOpenIssue, onSeedBreadcrumb });

    fireEvent.click(screen.getByTestId('mr-cell-link'));
    expect(onOpenIssue).not.toHaveBeenCalled();
    expect(onSeedBreadcrumb).not.toHaveBeenCalled();
  });
});

// CR-05: the row's full-row click is an `absolute inset-0` overlay button, and
// every LATER positioned sibling with `z-index: auto` hit-tests ABOVE it. jsdom
// does not implement hit-testing or `pointer-events`, so a click test cannot
// see this class of defect at all — assert the class contract instead
// (deliberately, per the D-05 precedent above; do not "upgrade" these into
// simulated-pointer tests, which would pass either way).
describe('CR-05: overlay click model — cells opt out of hit-testing unless genuinely interactive', () => {
  it('the consolidated MR cell wrapper carries pointer-events-none so the row overlay keeps the click', () => {
    renderWithRows([makeRow({ mr: makeMR({ iid: 4 }) })]);

    const wrapper = screen.getByTestId('mr-cell-link').parentElement as HTMLElement;
    expect(wrapper.className).toContain('pointer-events-none');
    expect(wrapper.className).toContain('relative');
  });

  it('the MR link inside that wrapper opts back in with pointer-events-auto + relative z-10', () => {
    renderWithRows([makeRow({ mr: makeMR({ iid: 4 }) })]);

    const link = screen.getByTestId('mr-cell-link');
    expect(link.className).toContain('relative');
    expect(link.className).toContain('z-10');
    // `pointer-events` inherits, so the wrapper's `none` would otherwise make
    // the link itself unclickable.
    expect(link.className).toContain('pointer-events-auto');
    expect(link.className).not.toContain('pointer-events-none');
  });

  it('inert BR/MS cells (ok / na marks) sit in a pointer-events-none slot, not a z-10 one', () => {
    renderWithRows([makeRow({ br: 'ok', ms: 'na' })]);

    for (const testId of ['drift-br', 'drift-ms']) {
      const slot = screen.getByTestId(testId).parentElement as HTMLElement;
      expect(slot.className).toContain('pointer-events-none');
      expect(slot.className).not.toContain('z-10');
    }
  });

  it('a flagged, non-actionable BR cell (no release branch) is still an inert pointer-events-none slot', () => {
    renderWithRows([makeRow({ br: 'flag', ms: 'flag', flagged: true })], {
      flaggedMrCount: 1,
      fix: { ...DEFAULT_FIX, releaseBranchExists: false },
    });

    const brSlot = screen.getByTestId('drift-br').parentElement as HTMLElement;
    expect(screen.getByTestId('drift-br').tagName).not.toBe('BUTTON');
    expect(brSlot.className).toContain('pointer-events-none');
    // MS on the same row IS actionable, so it must still opt above the overlay.
    const msSlot = screen.getByTestId('drift-ms').parentElement as HTMLElement;
    expect(screen.getByTestId('drift-ms').tagName).toBe('BUTTON');
    expect(msSlot.className).toContain('z-10');
    expect(msSlot.className).not.toContain('pointer-events-none');
  });

  it('no interactive button on a task row is left inside a pointer-events-none subtree without opting back in', () => {
    renderWithRows([makeRow({ br: 'flag', ms: 'flag', flagged: true })], { flaggedMrCount: 1 });

    const taskRow = screen.getByTestId('task-row');
    for (const button of Array.from(taskRow.querySelectorAll('button'))) {
      const optsBackIn = button.className.includes('pointer-events-auto');
      let node: HTMLElement | null = button;
      while (node && node !== taskRow) {
        if (node.className.includes('pointer-events-none')) {
          expect(
            optsBackIn,
            `${button.getAttribute('data-testid') ?? button.textContent} is inside a pointer-events-none subtree and never opts back in`,
          ).toBe(true);
        }
        node = node.parentElement;
      }
    }
  });
});

// CR-08: `selectDisplayMr`'s contract is that nothing is dropped — "the rest
// surface behind the +N marker". They only surface if the marker is
// hit-testable: `pointer-events: none` removes it from hit-testing, so the
// browser never fires the hover its `title` needs, and there is no other route
// to those MRs anywhere in the UI (they are excluded from secondaryRows by
// construction).
describe('CR-08: the +N marker actually reveals the hidden MRs', () => {
  it('is hit-testable — it opts back into pointer events above the row overlay and never carries pointer-events-none', () => {
    renderWithRows([
      makeRow({ mr: makeMR({ id: 1, iid: 1 }) }),
      makeRow({ mr: makeMR({ id: 2, iid: 2 }) }),
      makeRow({ mr: makeMR({ id: 3, iid: 3 }) }),
    ]);

    const extra = screen.getByTestId('mr-extra-count');
    expect(extra.className).not.toContain('pointer-events-none');
    expect(extra.className).toContain('pointer-events-auto');
    expect(extra.className).toContain('z-10');
    expect(extra.className).toContain('cursor-help');
  });

  it('names every hidden MR with its state, both in the tooltip and in text the tooltip does not gate', () => {
    renderWithRows([
      makeRow({ mr: makeMR({ id: 1, iid: 1, state: 'merged' }) }),
      makeRow({ mr: makeMR({ id: 2, iid: 2, state: 'opened' }) }),
      makeRow({ mr: makeMR({ id: 3, iid: 3, state: 'opened' }) }),
    ]);

    const extra = screen.getByTestId('mr-extra-count');
    expect(extra).toHaveTextContent('+2');
    for (const fragment of ['!1 (merged)', '!2 (opened)']) {
      expect(extra).toHaveAttribute('title', expect.stringContaining(fragment));
      // Not reachable only through a hover the pointer-events rules could
      // silently disable again.
      expect(extra.textContent).toContain(fragment);
    }
    // The selected MR is not listed as one of the "others".
    expect(extra).toHaveAttribute('title', expect.not.stringContaining('!3'));
  });
});

describe('D-05: hover-reveal scope', () => {
  // jsdom does not evaluate `:hover`, and 91.1-VALIDATION.md routes the
  // visual hover confirmation to manual UAT — assert on rendered structure
  // (className placement) instead. Do not "upgrade" this into a fake
  // pointer-simulated hover test.
  it('group/row is present on the task row so its consolidated BR/MS action cells reveal on hover', () => {
    const row = makeRow();
    const issue = makeIssue();
    renderSection({ primaryRows: [{ issue, mrs: [row] }] });

    const taskRow = screen.getByTestId('task-row');
    expect(taskRow.className).toContain('group/row');
  });

  it('secondary-table MR sub-lines still each carry their own group/row root', () => {
    const rowA = makeRow({
      mr: makeMR({ id: 1, iid: 1 }),
      taskReason: 'no-linked-task',
      taskKeys: [],
    });
    const rowB = makeRow({
      mr: makeMR({ id: 2, iid: 2 }),
      taskReason: 'no-linked-task',
      taskKeys: [],
    });
    renderSection({ secondaryRows: [rowA, rowB] });

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

describe('D-06 / criterion 4: task row carries its own drift-br/drift-ms (consolidated row)', () => {
  it('a task row renders drift-br/drift-ms for its selected MR — no separate sub-line copy in the primary table', () => {
    const row = makeRow();
    renderWithRows([row]);

    const taskRow = screen.getByTestId('task-row');
    expect(within(taskRow).getByTestId('drift-br')).toBeInTheDocument();
    expect(within(taskRow).getByTestId('drift-ms')).toBeInTheDocument();
    // Only one of each in the whole tree — no separate sub-line copy.
    expect(screen.getAllByTestId('drift-br')).toHaveLength(1);
    expect(screen.getAllByTestId('drift-ms')).toHaveLength(1);
  });
});

describe('D-09: duplication', () => {
  beforeEach(() => {
    mockUpdateMergeRequest.mockReset();
  });

  it('the same DriftRow supplied under two primaryRows entries renders two task rows, each with its own actionable drift-br button', () => {
    const shared = makeRow({ mr: makeMR({ id: 1, iid: 1 }), br: 'flag', flagged: true });
    renderSection({
      primaryRows: [
        { issue: makeIssue({ key: 'PROJ-1' }), mrs: [shared] },
        { issue: makeIssue({ key: 'PROJ-2' }), mrs: [shared] },
      ],
      flaggedMrCount: 1,
    });

    const taskRows = screen.getAllByTestId('task-row');
    expect(taskRows).toHaveLength(2);
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

// CR-07: on the consolidated row the BR/MS cells render at a FIXED position
// whose `mr` prop changes with the selection. Their write state lives in
// component state (D-08), so without keying them to mr.id React reuses the
// hook instance and a sticky failure — plus the retry write behind it — binds
// to a different merge request than the one it describes.
describe('CR-07: per-cell write state follows MR identity, not row position', () => {
  beforeEach(() => {
    mockUpdateMergeRequest.mockReset();
  });

  it("a failure on the selected MR does not survive onto a different MR when a filter changes the selection, and the retry writes the NEW MR's iid", async () => {
    mockUpdateMergeRequest.mockRejectedValueOnce(new Error('protected branch'));
    // !9 is selected unfiltered (highest iid among the flagged). The "no
    // milestone" filter drops it — only !5 carries ms === 'flag'.
    const mr9 = makeRow({
      mr: makeMR({ id: 9, iid: 9 }),
      br: 'flag',
      ms: 'ok',
      flagged: true,
    });
    const mr5 = makeRow({
      mr: makeMR({ id: 5, iid: 5 }),
      br: 'flag',
      ms: 'flag',
      flagged: true,
    });
    renderWithRows([mr9, mr5], {
      flaggedMrCount: 2,
      brFlaggedCount: 2,
      msFlaggedCount: 1,
    });

    expect(screen.getByTestId('mr-cell-link')).toHaveTextContent('!9');
    fireEvent.click(screen.getByTestId('drift-br'));
    await waitFor(() =>
      expect(screen.getByTestId('drift-br').querySelector('.text-red-600')).toBeTruthy(),
    );
    expect(mockUpdateMergeRequest.mock.calls[0][3]).toBe(9);

    // Selection changes underneath the cell.
    fireEvent.click(screen.getByTestId('flagged-ms-badge'));
    expect(screen.getByTestId('mr-cell-link')).toHaveTextContent('!5');

    // !9's failure must not describe !5.
    const brCell = screen.getByTestId('drift-br');
    expect(brCell.querySelector('.text-red-600')).toBeFalsy();
    expect(brCell).not.toHaveAttribute('title', 'protected branch');

    mockUpdateMergeRequest.mockResolvedValueOnce({} as GitLabMR);
    fireEvent.click(brCell);
    await waitFor(() => expect(mockUpdateMergeRequest).toHaveBeenCalledTimes(2));
    expect(mockUpdateMergeRequest.mock.calls[1][3]).toBe(5);
  });

  it('a pending write does not migrate its spinner or its fire-lock onto the next selected MR', async () => {
    mockUpdateMergeRequest.mockReturnValueOnce(new Promise(() => {}));
    const mr9 = makeRow({
      mr: makeMR({ id: 9, iid: 9 }),
      br: 'flag',
      ms: 'ok',
      flagged: true,
    });
    const mr5 = makeRow({
      mr: makeMR({ id: 5, iid: 5 }),
      br: 'flag',
      ms: 'flag',
      flagged: true,
    });
    renderWithRows([mr9, mr5], {
      flaggedMrCount: 2,
      brFlaggedCount: 2,
      msFlaggedCount: 1,
    });

    fireEvent.click(screen.getByTestId('drift-br'));
    await waitFor(() =>
      expect(screen.getByTestId('drift-br').querySelector('.animate-spin')).toBeTruthy(),
    );

    fireEvent.click(screen.getByTestId('flagged-ms-badge'));
    expect(screen.getByTestId('mr-cell-link')).toHaveTextContent('!5');

    const brCell = screen.getByTestId('drift-br');
    expect(brCell.querySelector('.animate-spin')).toBeFalsy();
    // The lock belonged to !9's in-flight write, so !5 must still be firable.
    mockUpdateMergeRequest.mockReturnValueOnce(new Promise(() => {}));
    fireEvent.click(brCell);
    await waitFor(() => expect(mockUpdateMergeRequest).toHaveBeenCalledTimes(2));
    expect(mockUpdateMergeRequest.mock.calls[1][3]).toBe(5);
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
  it('the done badge and both br/ms flagged badges render, showing the passed per-category counts', () => {
    renderSection({
      issueCounts: { issuesFixed: 4, issuesTotal: 6 },
      flaggedMrCount: 3,
      brFlaggedCount: 2,
      msFlaggedCount: 1,
    });
    expect(screen.getByText('4 / 6 done')).toBeInTheDocument();
    expect(screen.getByTestId('flagged-br-badge')).toHaveTextContent('2');
    expect(screen.getByTestId('flagged-ms-badge')).toHaveTextContent('1');
    expect(screen.queryByTestId('flagged-count-badge')).toBeNull();
  });

  it('Test 6 (IN-03): flagged badges are hidden while isLoadingDrift, hidden while isLoadingIssues, and shown when both are false', () => {
    const { unmount } = renderSection({
      flaggedMrCount: 2,
      brFlaggedCount: 2,
      isLoadingDrift: true,
    });
    expect(screen.queryByTestId('flagged-br-badge')).toBeNull();
    unmount();

    const { unmount: unmount2 } = renderSection({
      flaggedMrCount: 2,
      brFlaggedCount: 2,
      isLoadingIssues: true,
    });
    expect(screen.queryByTestId('flagged-br-badge')).toBeNull();
    unmount2();

    renderSection({
      flaggedMrCount: 2,
      brFlaggedCount: 2,
      isLoadingDrift: false,
      isLoadingIssues: false,
    });
    expect(screen.getByTestId('flagged-br-badge')).toHaveTextContent('2');
  });
});

describe('UAT-91.1-B: filtering warning badges', () => {
  it('Test 2: brFlaggedCount 0 renders no flagged-br-badge at all (not a 0)', () => {
    renderSection({ flaggedMrCount: 1, brFlaggedCount: 0, msFlaggedCount: 1 });
    expect(screen.queryByTestId('flagged-br-badge')).toBeNull();
    expect(screen.getByTestId('flagged-ms-badge')).toBeInTheDocument();
  });

  it('Test 3: both counts zero renders neither badge', () => {
    renderSection({ flaggedMrCount: 0, brFlaggedCount: 0, msFlaggedCount: 0 });
    expect(screen.queryByTestId('flagged-br-badge')).toBeNull();
    expect(screen.queryByTestId('flagged-ms-badge')).toBeNull();
  });

  it('Test 5: clicking flagged-br-badge hides MR sub-lines whose br !== flag and hides task rows left with zero matching MRs', () => {
    const brFlagged = makeRow({ mr: makeMR({ id: 1, iid: 1 }), br: 'flag', flagged: true });
    const clean = makeRow({ mr: makeMR({ id: 2, iid: 2 }) });
    const taskWithFlagged = makeIssue({ key: 'PROJ-1' });
    const taskWithOnlyClean = makeIssue({ key: 'PROJ-2' });
    renderSection({
      primaryRows: [
        { issue: taskWithFlagged, mrs: [brFlagged] },
        { issue: taskWithOnlyClean, mrs: [clean] },
      ],
      flaggedMrCount: 1,
      brFlaggedCount: 1,
    });

    fireEvent.click(screen.getByTestId('flagged-br-badge'));

    const taskRows = screen.getAllByTestId('task-row');
    expect(taskRows).toHaveLength(1);
    expect(taskRows[0]).toHaveTextContent('PROJ-1');
    expect(screen.getByTestId('mr-cell-link')).toHaveTextContent('!1');
  });

  it('Test 5b: secondary rows are filtered by the same predicate', () => {
    const brFlaggedSecondary = makeRow({
      mr: makeMR({ id: 1, iid: 1 }),
      br: 'flag',
      flagged: true,
      taskKeys: [],
    });
    const cleanSecondary = makeRow({ mr: makeMR({ id: 2, iid: 2 }), taskKeys: [] });
    renderSection({
      secondaryRows: [brFlaggedSecondary, cleanSecondary],
      flaggedMrCount: 1,
      brFlaggedCount: 1,
    });

    fireEvent.click(screen.getByTestId('flagged-br-badge'));

    const rows = within(screen.getByTestId('secondary-section')).getAllByTestId('drift-row');
    expect(rows).toHaveLength(1);
  });

  it('Test 6: clicking flagged-br-badge twice restores every row (toggle-off), aria-pressed reflects state', () => {
    const brFlagged = makeRow({ mr: makeMR({ id: 1, iid: 1 }), br: 'flag', flagged: true });
    const clean = makeRow({ mr: makeMR({ id: 2, iid: 2 }) });
    renderSection({
      primaryRows: [
        { issue: makeIssue({ key: 'PROJ-1' }), mrs: [brFlagged] },
        { issue: makeIssue({ key: 'PROJ-2' }), mrs: [clean] },
      ],
      flaggedMrCount: 1,
      brFlaggedCount: 1,
    });

    const badge = screen.getByTestId('flagged-br-badge');
    expect(badge).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(badge);
    expect(badge).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByTestId('task-row')).toHaveLength(1);

    fireEvent.click(badge);
    expect(badge).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getAllByTestId('task-row')).toHaveLength(2);
  });

  it('Test 7: an MR flagged on both BR and MS is still rendered under either filter (Rule 1)', () => {
    const doubleFlagged = makeRow({
      mr: makeMR({ id: 1, iid: 1 }),
      br: 'flag',
      ms: 'flag',
      flagged: true,
    });
    renderSection({
      primaryRows: [{ issue: makeIssue({ key: 'PROJ-1' }), mrs: [doubleFlagged] }],
      flaggedMrCount: 1,
      brFlaggedCount: 1,
      msFlaggedCount: 1,
    });

    fireEvent.click(screen.getByTestId('flagged-br-badge'));
    expect(screen.getAllByTestId('task-row')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('flagged-br-badge')); // toggle off
    fireEvent.click(screen.getByTestId('flagged-ms-badge'));
    expect(screen.getAllByTestId('task-row')).toHaveLength(1);
  });

  // WR-08: `filteredPrimaryRows` replaces each task's `mrs` with the filtered
  // subset before the MR cell ever sees it. Counting `+N` from that subset made
  // a task's other MRs appear to vanish the moment a filter was applied.
  it("WR-08: the +N marker counts the task's MRs, not the filtered subset", () => {
    const flagged = makeRow({ mr: makeMR({ id: 1, iid: 1 }), br: 'flag', flagged: true });
    const cleanA = makeRow({ mr: makeMR({ id: 2, iid: 2 }) });
    const cleanB = makeRow({ mr: makeMR({ id: 3, iid: 3 }) });
    const cleanC = makeRow({ mr: makeMR({ id: 4, iid: 4 }) });
    renderSection({
      primaryRows: [
        { issue: makeIssue({ key: 'PROJ-1' }), mrs: [flagged, cleanA, cleanB, cleanC] },
      ],
      flaggedMrCount: 1,
      brFlaggedCount: 1,
    });

    expect(screen.getByTestId('mr-extra-count')).toHaveTextContent('+3');

    fireEvent.click(screen.getByTestId('flagged-br-badge'));

    // The filter changes which MR is DISPLAYED, never how many the task has.
    expect(screen.getByTestId('mr-cell-link')).toHaveTextContent('!1');
    const extra = screen.getByTestId('mr-extra-count');
    expect(extra).toHaveTextContent('+3');
    for (const iid of ['!2', '!3', '!4']) {
      expect(extra).toHaveAttribute('title', expect.stringContaining(iid));
    }
  });

  it('Test 8: with a filter active, filter-active-notice renders and filter-clear restores every row', () => {
    const brFlagged = makeRow({ mr: makeMR({ id: 1, iid: 1 }), br: 'flag', flagged: true });
    const clean = makeRow({ mr: makeMR({ id: 2, iid: 2 }) });
    renderSection({
      primaryRows: [
        { issue: makeIssue({ key: 'PROJ-1' }), mrs: [brFlagged] },
        { issue: makeIssue({ key: 'PROJ-2' }), mrs: [clean] },
      ],
      flaggedMrCount: 1,
      brFlaggedCount: 1,
    });

    fireEvent.click(screen.getByTestId('flagged-br-badge'));
    expect(screen.getByTestId('filter-active-notice')).toBeInTheDocument();
    expect(screen.getAllByTestId('task-row')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('filter-clear'));
    expect(screen.queryByTestId('filter-active-notice')).toBeNull();
    expect(screen.getAllByTestId('task-row')).toHaveLength(2);
  });

  it('while a filter is active, MrSlot empty-state lines never leak (excluded tasks are dropped entirely)', () => {
    const brFlagged = makeRow({ mr: makeMR({ id: 1, iid: 1 }), br: 'flag', flagged: true });
    renderSection({
      primaryRows: [{ issue: makeIssue({ key: 'PROJ-1' }), mrs: [brFlagged] }],
      flaggedMrCount: 1,
      brFlaggedCount: 1,
    });

    fireEvent.click(screen.getByTestId('flagged-br-badge'));
    expect(screen.queryByTestId('mr-slot-pending')).toBeNull();
    expect(screen.queryByTestId('mr-slot-none')).toBeNull();
    expect(screen.queryByTestId('mr-slot-unavailable')).toBeNull();
    expect(screen.queryByTestId('mr-slot-failed')).toBeNull();
  });
});

// CR-06: a failed milestone lookup and a verified "no milestone exists" both
// arrive as hasMatchedMilestone=false, but only one of them may be asserted.
describe('CR-06: a failed milestone lookup never renders as a verified absence', () => {
  it('milestoneLookupFailed: true replaces the "No GitLab milestone matched" assertion with an unknown-state banner', () => {
    renderSection({
      primaryRows: [{ issue: makeIssue(), mrs: [] }],
      hasMatchedMilestone: false,
      milestoneLookupFailed: true,
      driftUnavailable: true,
    });

    const banner = screen.getByTestId('drift-degraded-banner');
    expect(banner).toHaveTextContent(/Couldn't reach GitLab/);
    expect(banner).not.toHaveTextContent('No GitLab milestone matched');
    // Unknown, not a warning — no orange assertion styling.
    expect(banner.querySelector('.text-orange-600')).toBeNull();
  });

  it('milestoneLookupFailed: true never offers the "Set a release date" remedy, even with no release date', () => {
    renderSection({
      primaryRows: [{ issue: makeIssue(), mrs: [] }],
      hasMatchedMilestone: false,
      milestoneLookupFailed: true,
      driftUnavailable: true,
      hasReleaseDate: false,
    });

    expect(screen.getByTestId('drift-degraded-banner')).not.toHaveTextContent('Set a release date');
  });

  it('milestoneLookupFailed: false keeps the verified-absence copy (no regression of D-16)', () => {
    renderSection({
      primaryRows: [{ issue: makeIssue(), mrs: [] }],
      hasMatchedMilestone: false,
      milestoneLookupFailed: false,
      hasReleaseDate: false,
    });

    const banner = screen.getByTestId('drift-degraded-banner');
    expect(banner).toHaveTextContent('No GitLab milestone matched');
    expect(banner).toHaveTextContent('Set a release date');
  });

  it('with the lookup failed the task row shows mr-slot-failed, not the mr-slot-unavailable absence claim', () => {
    renderWithRows([], {
      hasMatchedMilestone: false,
      milestoneLookupFailed: true,
      driftUnavailable: true,
    });

    expect(screen.getByTestId('mr-slot-failed')).toBeInTheDocument();
    expect(screen.queryByTestId('mr-slot-unavailable')).toBeNull();
    expect(screen.queryByTestId('mr-slot-none')).toBeNull();
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
