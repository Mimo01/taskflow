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
import { fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { act } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateMergeRequest } from '@/services/gitlab';
import type { GitLabMR } from '@/services/gitlab';
import type { JiraIssue } from '@/services/jira';
import { addIssueFixVersion } from '@/services/jira';
import { usePeekStore } from '@/stores/peek.store';
import type { DriftRow } from './driftDetection';
import { useTaskIssueFilters } from './useTaskIssueFilters';
import {
  aggregateMark,
  matchTicketKeyInTitle,
  mrStatusSummary,
  stripLeadingTicketKeys,
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

vi.mock('@/services/stronghold', () => ({ readSecret: vi.fn().mockResolvedValue('jira-tok') }));
vi.mock('@/services/jira', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/jira')>()),
  addIssueFixVersion: vi.fn(),
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
function makeIssue(
  overrides: {
    key?: string;
    summary?: string;
    status?: string;
    statusCategory?: 'new' | 'indeterminate' | 'done';
    issuetype?: string;
    assignee?: string | null;
  } = {},
): JiraIssue {
  issueSeq += 1;
  return {
    id: String(issueSeq),
    key: overrides.key ?? `PROJ-${issueSeq}`,
    fields: {
      summary: overrides.summary ?? 'Something',
      status: {
        id: '1',
        name: overrides.status ?? 'Status',
        statusCategory: { key: overrides.statusCategory ?? 'new' },
      },
      assignee: overrides.assignee ? { displayName: overrides.assignee, avatarUrls: {} } : null,
      customfield_10016: null,
      issuetype: { name: overrides.issuetype ?? 'Story', subtask: false },
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

/**
 * Opens a task row's MR popover (chip by default). The popover portals to
 * document.body, so callers query `screen`, not `within(row)`.
 */
async function openMrPopover(trigger?: HTMLElement) {
  const el = trigger ?? screen.getAllByTestId('mr-status-chip')[0];
  // Idempotent: a trigger that already reports expanded must not be toggled shut.
  if (el.getAttribute('aria-expanded') !== 'true') fireEvent.click(el);
  // Rows that were opened earlier keep their (hidden) popover mounted; return the visible one.
  let popover: HTMLElement | undefined;
  await waitFor(() => {
    popover = screen
      .queryAllByTestId('mr-popover')
      .find((p) => p.closest('[hidden]') === null && p.getAttribute('data-open') !== null);
    expect(popover).toBeDefined();
  });
  return popover as HTMLElement;
}

/** The popover line for the MR with this iid. */
function mrLine(iid: number): HTMLElement {
  const line = screen
    .getAllByTestId('mr-popover-line')
    .find((l) => new RegExp(`!${iid}(?!\\d)`).test(l.textContent ?? ''));
  if (!line) throw new Error(`no popover line for !${iid}`);
  return line;
}

describe('UnifiedTaskTable', () => {
  beforeEach(() => {
    usePeekStore.setState({ peekIssueKey: null });
  });

  it('marks only the peeked task-row with data-peeked', () => {
    usePeekStore.setState({ peekIssueKey: 'PROJ-1' });
    renderSection({
      primaryRows: [
        { issue: makeIssue({ key: 'PROJ-1' }), mrs: [] },
        { issue: makeIssue({ key: 'PROJ-2' }), mrs: [] },
      ],
    });
    const rows = screen.getAllByTestId('task-row');
    expect(rows[0]).toHaveAttribute('data-peeked', 'true');
    expect(rows[1]).not.toHaveAttribute('data-peeked');
  });

  it('column header strip is sticky (P94 D-13)', () => {
    renderSection({ primaryRows: [{ issue: makeIssue({ key: 'PROJ-1' }), mrs: [] }] });
    const strip = screen.getByTestId('task-column-header');
    expect(strip.className).toContain('sticky');
    expect(strip.className).toContain('top-(--release-sticky-top,0px)');
    // Row cells use relative z-10 (click overlay convention); header must outrank them.
    expect(strip.className).toContain('z-20');
  });

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
    // Each row carries its own chip; the flagged row's BR aggregate is a flag.
    expect(screen.getAllByTestId('mr-status-chip')).toHaveLength(2);
    expect(within(taskRows[0]).getByTestId('task-drift-br').tagName).toBe('BUTTON');
    expect(within(taskRows[1]).getByTestId('task-drift-br').tagName).not.toBe('BUTTON');
  });

  it('renders the warning glyph for a flagged BR mark', () => {
    const row = makeRow({ br: 'flag', flagged: true });
    renderWithRows([row], { flaggedMrCount: 1 });
    const brCell = screen.getByTestId('task-drift-br');
    expect(brCell.querySelector('svg')).toBeTruthy();
  });

  it('renders a check for an ok mark and an em dash for na', () => {
    const row = makeRow({ br: 'ok', ms: 'na' });
    renderWithRows([row]);
    expect(screen.getByTestId('task-drift-br').querySelector('svg')).toBeTruthy();
    expect(screen.getByTestId('task-drift-ms')).toHaveTextContent('—');
  });

  it('a non-evaluated (merged) row renders an em dash in both BR/MS columns and does not show the title inline', async () => {
    const row = makeRow({
      evaluated: false,
      br: 'na',
      ms: 'na',
      task: 'na',
      mr: makeMR({ state: 'merged', title: 'Merged thing', iid: 9 }),
    });
    renderWithRows([row]);
    expect(screen.getByTestId('task-drift-br')).toHaveTextContent('—');
    expect(screen.getByTestId('task-drift-ms')).toHaveTextContent('—');
    const taskRow = screen.getByTestId('task-row');
    expect(taskRow).not.toHaveTextContent('!9');
    expect(taskRow).not.toHaveTextContent('Merged thing');
    expect(screen.getByTestId('mr-status-chip')).toHaveTextContent('merged');
    const popover = await openMrPopover();
    expect(popover).toHaveTextContent('!9');
    expect(popover).toHaveTextContent('Merged thing');
    expect(within(popover).getByTestId('drift-br')).toHaveTextContent('—');
    expect(within(popover).getByTestId('drift-ms')).toHaveTextContent('—');
  });

  it('261103-fqd: a merged row missing the milestone keeps BR as an em dash but MS is an actionable button', async () => {
    mockUpdateMergeRequest.mockResolvedValueOnce(makeMR());
    const row = makeRow({
      evaluated: false,
      br: 'na',
      ms: 'flag',
      task: 'ok',
      flagged: true,
      mr: makeMR({ state: 'merged', iid: 9 }),
    });
    renderWithRows([row], { flaggedMrCount: 1 });
    await openMrPopover(screen.getByTestId('task-drift-ms'));
    expect(screen.getByTestId('drift-br')).toHaveTextContent('—');
    expect(screen.getByTestId('drift-br').tagName).not.toBe('BUTTON');
    const ms = screen.getByTestId('drift-ms');
    expect(ms.tagName).toBe('BUTTON');
    fireEvent.click(ms);
    await waitFor(() => expect(mockUpdateMergeRequest).toHaveBeenCalledTimes(1));
    const [body] = mockUpdateMergeRequest.mock.calls[0].slice(4);
    expect(body).toEqual({ milestone_id: 1 });
  });

  it('renders real marks (not em dashes) for an evaluated draft MR', async () => {
    const row = makeRow({
      evaluated: true,
      br: 'flag',
      ms: 'ok',
      task: 'ok',
      flagged: true,
      mr: makeMR({ state: 'opened', draft: true }),
    });
    renderWithRows([row], { flaggedMrCount: 1 });
    expect(screen.getByTestId('mr-status-chip')).toHaveTextContent('draft');
    await openMrPopover();
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

  // UAT-91.1 consolidation, reworked by quick 261103-g8m: the primary row is
  // one line with an overall MR status chip (state dots + progress label) and
  // aggregate BR/MS marks; per-MR details live in a popover.
  describe('Task row MR cell shows an overall status chip (261103-g8m)', () => {
    it('renders a chip with a label and no !iid, title or link on the row; no drift-row sub-line', () => {
      const row = makeRow({ mr: makeMR({ iid: 7, title: 'Fix thing', state: 'opened' }) });
      renderWithRows([row]);
      const taskRow = screen.getByTestId('task-row');
      expect(screen.getByTestId('mr-status-chip')).toHaveTextContent('open');
      expect(taskRow).not.toHaveTextContent('!7');
      expect(taskRow).not.toHaveTextContent('Fix thing');
      expect(screen.queryByTestId('drift-row')).toBeNull();
    });

    it('the chip has no author; the popover shows author (with avatar) and title', async () => {
      const row = makeRow({
        mr: makeMR({
          title: 'Fix thing',
          author: { id: 1, name: 'Alice', username: 'alice', avatar_url: '' },
        }),
      });
      renderWithRows([row]);
      const chip = screen.getByTestId('mr-status-chip');
      expect(within(chip).queryByRole('img')).toBeNull();
      expect(within(chip).queryByText('Alice')).toBeNull();
      const popover = await openMrPopover();
      expect(within(popover).getByText('Alice')).toBeInTheDocument();
      expect(within(popover).getByText('Fix thing')).toHaveAttribute('title', 'Fix thing');
      expect(within(popover).getByText('Alice').parentElement).toHaveAttribute('title', 'Alice');
    });

    it('aggregate task-drift-br / task-drift-ms render on the row; per-MR drift-br / drift-ms only after opening', async () => {
      const row = makeRow({ br: 'flag', ms: 'ok', flagged: true });
      renderWithRows([row], { flaggedMrCount: 1 });
      expect(screen.getByTestId('task-drift-br')).toBeInTheDocument();
      expect(screen.getByTestId('task-drift-ms')).toBeInTheDocument();
      expect(screen.queryByTestId('drift-br')).toBeNull();
      expect(screen.queryByTestId('drift-ms')).toBeNull();
      await openMrPopover();
      expect(screen.getAllByTestId('drift-br')).toHaveLength(1);
      expect(screen.getAllByTestId('drift-ms')).toHaveLength(1);
    });

    it('a task with three MRs shows 3 dots on the row and lists all three in the popover (no selection, no +N)', async () => {
      const rows = [
        makeRow({ mr: makeMR({ id: 1, iid: 1 }) }),
        makeRow({ mr: makeMR({ id: 2, iid: 2 }) }),
        makeRow({ mr: makeMR({ id: 3, iid: 3 }) }),
      ];
      renderWithRows(rows);
      const chip = screen.getByTestId('mr-status-chip');
      expect(chip).toHaveTextContent('3 open');
      expect(chip.querySelectorAll('[data-mr-disc]')).toHaveLength(3);
      const popover = await openMrPopover();
      const lines = within(popover).getAllByTestId('mr-popover-line');
      expect(lines.map((l) => l.textContent)).toEqual([
        expect.stringContaining('!3'),
        expect.stringContaining('!2'),
        expect.stringContaining('!1'),
      ]);
    });

    it('the aggregate describes every MR: a flag on any MR flags the row, even a lower-iid one', () => {
      const clean = makeRow({ mr: makeMR({ id: 1, iid: 9 }) });
      const flagged = makeRow({ mr: makeMR({ id: 2, iid: 2 }), br: 'flag', flagged: true });
      renderWithRows([clean, flagged], { flaggedMrCount: 1 });
      expect(screen.getByTestId('task-drift-br').tagName).toBe('BUTTON');
      expect(screen.getByTestId('task-drift-ms').tagName).not.toBe('BUTTON');
    });

    it('the popover lists flagged MRs before unflagged ones, then opened, merged, closed (iid desc)', async () => {
      const merged = makeRow({
        mr: makeMR({ id: 1, iid: 42, state: 'merged' }),
        evaluated: false,
        br: 'na',
        ms: 'ok',
        task: 'na',
      });
      const openClean = makeRow({ mr: makeMR({ id: 2, iid: 17 }), br: 'ok', ms: 'ok' });
      const openFlagged = makeRow({
        mr: makeMR({ id: 3, iid: 5 }),
        br: 'flag',
        flagged: true,
      });
      renderWithRows([merged, openClean, openFlagged], { flaggedMrCount: 1 });
      const popover = await openMrPopover();
      const lines = within(popover).getAllByTestId('mr-popover-line');
      expect(lines.map((l) => l.textContent?.match(/!\d+/)?.[0])).toEqual(['!5', '!17', '!42']);
    });

    it('a single MR uses the same chip + popover (no direct link)', async () => {
      renderWithRows([makeRow({ mr: makeMR({ iid: 1, state: 'merged' }) })]);
      const chip = screen.getByTestId('mr-status-chip');
      expect(chip).toHaveTextContent('merged');
      expect(chip.querySelectorAll('[data-mr-disc]')).toHaveLength(1);
      const popover = await openMrPopover();
      expect(within(popover).getAllByTestId('mr-popover-line')).toHaveLength(1);
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
        // Scoped to the secondary row — the primary table's empty-state copy and
        // the secondary header's "Fix" column label also match /fix/.
        const row = within(screen.getByTestId('secondary-section')).getByTestId('drift-row');
        expect(row.textContent).toContain(title);
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

    // Scoped to the strip: the 261102-h1i toolbar also has Status/Assignee filter buttons.
    const strip = screen.getByTestId('task-column-header');
    expect(within(strip).getByText('Key')).toBeInTheDocument();
    expect(within(strip).getByText('Summary')).toBeInTheDocument();
    expect(within(strip).getByText('Assignee')).toBeInTheDocument();
    expect(within(strip).getByText('Status')).toBeInTheDocument();
    expect(within(strip).getByText('BR')).toBeInTheDocument();
    expect(within(strip).getByText('MS')).toBeInTheDocument();
  });

  // 261103-fg2: a trailing action-column spacer (only secondary rows render
  // that column) shifted every heading left of its column.
  it('has one header cell per task-row cell, ending at Assignee', () => {
    const issue = makeIssue({ key: 'PROJ-1' });
    renderSection({ primaryRows: [{ issue, mrs: [] }] });

    const strip = screen.getByTestId('task-column-header');
    const row = screen.getByTestId('task-row');
    const rowCells = Array.from(row.children).filter(
      (el) => el.getAttribute('data-testid') !== 'task-row-overlay',
    );
    expect(strip.children).toHaveLength(rowCells.length);
    expect(strip.lastElementChild).toHaveTextContent('Assignee');
    expect(rowCells[rowCells.length - 1]).toHaveTextContent('Unassigned');
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

  it('labels the nine columns a secondary row actually renders', () => {
    renderSecondary();
    const secondary = within(screen.getByTestId('secondary-section'));

    for (const label of [
      'State',
      'Key',
      'Merge request',
      'Author',
      'Reviewers',
      'MR state',
      'Fix',
      'BR',
      'MS',
    ]) {
      expect(secondary.getByText(label)).toBeInTheDocument();
    }
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
    for (const label of ['Key', 'Summary', 'Merge requests', 'BR', 'MS', 'Status', 'Assignee']) {
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
    renderWithRows([row], { flaggedMrCount: 1 });
    await openMrPopover();

    const brCell = screen.getByTestId('drift-br');
    fireEvent.click(brCell);

    await waitFor(() => {
      expect(screen.getByTestId('drift-br').querySelector('.animate-spin')).toBeTruthy();
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
    const popover = await openMrPopover();
    // The popup claims initial focus asynchronously; wait for that to settle so
    // it cannot steal focus back from the cell we focus below.
    await waitFor(() => expect(popover.contains(document.activeElement)).toBe(true));

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
    await openMrPopover();

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
    await openMrPopover();

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
    await openMrPopover();

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
    await openMrPopover();

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
    await openMrPopover();

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
    await openMrPopover();

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

  it('unavailable: with no release branch, drift-br is not a button, a click calls nothing, and MS on the same row is still actionable (MRFIX-04, D-14)', async () => {
    const row = makeRow({ br: 'flag', ms: 'flag', flagged: true });
    renderWithRows([row], {
      flaggedMrCount: 1,
      fix: { ...DEFAULT_FIX, releaseBranchExists: false },
    });
    await openMrPopover();

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

  it('inert cells: ok and na marks render no button (D-05, P89 D-11)', async () => {
    const okRow = makeRow({ br: 'ok', ms: 'ok' });
    renderWithRows([okRow], { flaggedMrCount: 1 });
    await openMrPopover();
    expect(screen.getByTestId('drift-br').querySelector('button')).toBeNull();
    expect(screen.getByTestId('drift-ms').querySelector('button')).toBeNull();
  });

  it('inert cells: a non-evaluated (merged) row never renders a button in any column', async () => {
    const mutedRow = makeRow({
      evaluated: false,
      br: 'na',
      ms: 'na',
      task: 'na',
      mr: makeMR({ state: 'merged' }),
    });
    renderWithRows([mutedRow]);
    await openMrPopover();
    expect(screen.getByTestId('drift-br').querySelector('button')).toBeNull();
    expect(screen.getByTestId('drift-ms').querySelector('button')).toBeNull();
  });

  it('degraded: with no matched milestone the banner renders and neither BR nor MS is a button (D-15, D-16)', async () => {
    const row = makeRow({ br: 'na', ms: 'na' });
    renderWithRows([row], {
      hasMatchedMilestone: false,
      fix: { ...DEFAULT_FIX, matchedMilestone: null },
    });
    await openMrPopover();
    expect(screen.getByTestId('drift-degraded-banner')).toBeInTheDocument();
    expect(screen.getByTestId('drift-br').tagName).not.toBe('BUTTON');
    expect(screen.getByTestId('drift-ms').tagName).not.toBe('BUTTON');
  });

  it('BR and MS both carry the identical aria-label and title strings (D2)', async () => {
    const row = makeRow({ br: 'flag', ms: 'flag', flagged: true });
    renderWithRows([row], { flaggedMrCount: 1 });
    await openMrPopover();
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
    await openMrPopover();
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

  it('isLoadingDrift: false with two MRs renders the consolidated MR cell (not a slot-state line)', async () => {
    const rowA = makeRow({ mr: makeMR({ id: 1, iid: 1 }) });
    const rowB = makeRow({ mr: makeMR({ id: 2, iid: 2 }) });
    renderWithRows([rowA, rowB], { isLoadingDrift: false });
    expect(screen.getByTestId('mr-status-chip')).toHaveTextContent('2 open');
    const popover = await openMrPopover();
    expect(within(popover).getAllByTestId('mr-popover-line')).toHaveLength(2);
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

  it('the MR chip and a flagged aggregate are siblings of the overlay, not nested inside it (sibling overlay pattern)', () => {
    const row = makeRow({ mr: makeMR({ iid: 4 }), br: 'flag', flagged: true });
    renderWithRows([row], { flaggedMrCount: 1 });

    const overlay = screen.getByTestId('task-row-overlay');
    for (const testId of ['mr-status-chip', 'task-drift-br']) {
      const trigger = screen.getByTestId(testId);
      expect(overlay.contains(trigger)).toBe(false);
      expect(trigger.contains(overlay)).toBe(false);
    }
  });

  it('clicking the MR chip or a flagged aggregate opens the popover and does not trigger the row overlay handlers', async () => {
    const onOpenIssue = vi.fn();
    const onOpenIssueFull = vi.fn();
    const onSeedBreadcrumb = vi.fn();
    const row = makeRow({ mr: makeMR({ iid: 4 }), br: 'flag', flagged: true });
    renderWithRows([row], { onOpenIssue, onOpenIssueFull, onSeedBreadcrumb, flaggedMrCount: 1 });

    const chip = screen.getByTestId('mr-status-chip');
    fireEvent.click(chip);
    expect(await screen.findByTestId('mr-popover')).toBeInTheDocument();
    fireEvent.click(chip);
    await waitFor(() => expect(screen.getByTestId('mr-popover')).not.toBeVisible());

    fireEvent.click(screen.getByTestId('task-drift-br'));
    await waitFor(() => expect(screen.getByTestId('mr-popover')).toBeVisible());
    expect(onOpenIssue).not.toHaveBeenCalled();
    expect(onOpenIssueFull).not.toHaveBeenCalled();
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

    const wrapper = screen.getByTestId('mr-status-chip').parentElement as HTMLElement;
    expect(wrapper.className).toContain('pointer-events-none');
    expect(wrapper.className).toContain('relative');
  });

  it('the MR chip inside that wrapper opts back in with pointer-events-auto + relative z-10', () => {
    renderWithRows([makeRow({ mr: makeMR({ iid: 4 }) })]);

    const link = screen.getByTestId('mr-status-chip');
    expect(link.className).toContain('relative');
    expect(link.className).toContain('z-10');
    // `pointer-events` inherits, so the wrapper's `none` would otherwise make
    // the link itself unclickable.
    expect(link.className).toContain('pointer-events-auto');
    expect(link).not.toHaveClass('pointer-events-none');
  });

  it('inert BR/MS cells (ok / na marks) sit in a pointer-events-none slot, not a z-10 one', () => {
    renderWithRows([makeRow({ br: 'ok', ms: 'na' })]);

    for (const testId of ['task-drift-br', 'task-drift-ms']) {
      expect(screen.getByTestId(testId).tagName).not.toBe('BUTTON');
      const slot = screen.getByTestId(testId).parentElement as HTMLElement;
      expect(slot.className).toContain('pointer-events-none');
      expect(slot.className).not.toContain('z-10');
    }
  });

  it('a flagged aggregate is a z-10 button even when no fix is possible (no release branch); the popover cell stays inert', async () => {
    renderWithRows([makeRow({ br: 'flag', ms: 'flag', flagged: true })], {
      flaggedMrCount: 1,
      fix: { ...DEFAULT_FIX, releaseBranchExists: false },
    });

    for (const testId of ['task-drift-br', 'task-drift-ms']) {
      const trigger = screen.getByTestId(testId);
      expect(trigger.tagName).toBe('BUTTON');
      expect(trigger.className).toContain('pointer-events-auto');
      expect(trigger.className).toContain('z-10');
      const slot = trigger.parentElement as HTMLElement;
      expect(slot.className).toContain('z-10');
      expect(slot.className).not.toContain('pointer-events-none');
    }
    await openMrPopover(screen.getByTestId('task-drift-br'));
    expect(screen.getByTestId('drift-br').tagName).not.toBe('BUTTON');
    expect(screen.getByTestId('drift-ms').tagName).toBe('BUTTON');
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

// CR-08 (reworked by 261103-g8m): the MRs of a task are only reachable through
// the chip's popover, so the chip must be hit-testable above the row overlay and
// the popover must name every MR with its state.
describe('CR-08: the MR chip actually reveals every MR', () => {
  it('is hit-testable — it opts back into pointer events above the row overlay and never carries pointer-events-none', () => {
    renderWithRows([
      makeRow({ mr: makeMR({ id: 1, iid: 1 }) }),
      makeRow({ mr: makeMR({ id: 2, iid: 2 }) }),
      makeRow({ mr: makeMR({ id: 3, iid: 3 }) }),
    ]);

    const chip = screen.getByTestId('mr-status-chip');
    expect(chip.tagName).toBe('BUTTON');
    expect(chip).not.toHaveClass('pointer-events-none');
    expect(chip.className).toContain('pointer-events-auto');
    expect(chip.className).toContain('z-10');
  });

  it('names every MR with its state in the popover and summarises them in the chip aria-label', async () => {
    renderWithRows([
      makeRow({ mr: makeMR({ id: 1, iid: 1, state: 'merged' }) }),
      makeRow({ mr: makeMR({ id: 2, iid: 2, state: 'opened' }) }),
    ]);

    expect(screen.getByTestId('mr-status-chip')).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/2 merge requests: 1 merged, 1 open/),
    );
    const popover = await openMrPopover();
    const lines = within(popover).getAllByTestId('mr-popover-line');
    expect(lines).toHaveLength(2);
    expect(popover).toHaveTextContent('!1');
    expect(popover).toHaveTextContent('Merged');
    expect(popover).toHaveTextContent('!2');
    expect(popover).toHaveTextContent('Open');
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

describe('D-06 / criterion 4: task row carries aggregate BR/MS (consolidated row)', () => {
  it('a task row renders aggregate task-drift-br/ms for its MRs — per-MR cells only live in the popover, never as a sub-line', async () => {
    const row = makeRow();
    renderWithRows([row]);

    const taskRow = screen.getByTestId('task-row');
    expect(within(taskRow).getByTestId('task-drift-br')).toBeInTheDocument();
    expect(within(taskRow).getByTestId('task-drift-ms')).toBeInTheDocument();
    expect(within(taskRow).queryByTestId('drift-br')).toBeNull();
    await openMrPopover();
    // Portalled out of the row: one per-MR cell in the whole tree.
    expect(within(taskRow).queryByTestId('drift-br')).toBeNull();
    expect(screen.getAllByTestId('drift-br')).toHaveLength(1);
    expect(screen.getAllByTestId('drift-ms')).toHaveLength(1);
  });
});

describe('D-09: duplication', () => {
  beforeEach(() => {
    mockUpdateMergeRequest.mockReset();
  });

  it('the same DriftRow supplied under two primaryRows entries renders two task rows, each with its own actionable drift-br button', async () => {
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
    await openMrPopover(screen.getAllByTestId('mr-status-chip')[0]);
    await openMrPopover(screen.getAllByTestId('mr-status-chip')[1]);
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

    await openMrPopover(screen.getAllByTestId('mr-status-chip')[0]);
    fireEvent.click(screen.getByTestId('drift-br'));
    await waitFor(() => {
      expect(screen.getByTestId('drift-br').querySelector('.text-red-600')).toBeTruthy();
    });
    await openMrPopover(screen.getAllByTestId('mr-status-chip')[1]);
    const [firstBr, secondBr] = screen.getAllByTestId('drift-br');
    expect(firstBr.querySelector('.text-red-600')).toBeTruthy();
    // The second copy is an independent hook instance — still the orange
    // actionable button, unaffected by the first copy's failure.
    expect(secondBr.tagName).toBe('BUTTON');
    expect(secondBr.querySelector('.text-red-600')).toBeFalsy();
    expect(secondBr.querySelector('.text-orange-600')).toBeTruthy();
  });
});

// CR-07: the popover's BR/MS cells hold their write state in component state
// (D-08), so they are keyed by mr.id — a sticky failure (and the retry write
// behind it) must stay bound to the merge request it describes, even when a
// category filter or a cache patch reshuffles which MRs the row shows.
describe('CR-07: per-cell write state follows MR identity, not row position', () => {
  beforeEach(() => {
    mockUpdateMergeRequest.mockReset();
  });

  function twoFlaggedMrs() {
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
    return [mr9, mr5];
  }
  const counts = { flaggedMrCount: 2, brFlaggedCount: 2, msFlaggedCount: 1 };

  it("a failure stays on its own MR when a filter toggles, and the other MR's retry writes its own iid", async () => {
    mockUpdateMergeRequest.mockRejectedValueOnce(new Error('protected branch'));
    renderWithRows(twoFlaggedMrs(), counts);

    await openMrPopover();
    const br9 = within(mrLine(9)).getByTestId('drift-br');
    fireEvent.click(br9);
    await waitFor(() =>
      expect(within(mrLine(9)).getByTestId('drift-br').querySelector('.text-red-600')).toBeTruthy(),
    );
    expect(mockUpdateMergeRequest.mock.calls[0][3]).toBe(9);

    // The filter changes which MRs the row's `mrs` holds; the popover still
    // lists the whole task (allMrs).
    fireEvent.click(screen.getByTestId('flagged-ms-badge'));
    await openMrPopover();
    expect(screen.getAllByTestId('mr-popover-line')).toHaveLength(2);

    // !9's failure must not describe !5.
    const br5 = within(mrLine(5)).getByTestId('drift-br');
    expect(br5.querySelector('.text-red-600')).toBeFalsy();
    expect(br5).not.toHaveAttribute('title', 'protected branch');
    expect(within(mrLine(9)).getByTestId('drift-br').querySelector('.text-red-600')).toBeTruthy();

    mockUpdateMergeRequest.mockResolvedValueOnce({} as GitLabMR);
    fireEvent.click(br5);
    await waitFor(() => expect(mockUpdateMergeRequest).toHaveBeenCalledTimes(2));
    expect(mockUpdateMergeRequest.mock.calls[1][3]).toBe(5);
  });

  it("a pending write does not migrate its spinner or its fire-lock onto another MR's cell", async () => {
    mockUpdateMergeRequest.mockReturnValueOnce(new Promise(() => {}));
    renderWithRows(twoFlaggedMrs(), counts);

    await openMrPopover();
    fireEvent.click(within(mrLine(9)).getByTestId('drift-br'));
    await waitFor(() =>
      expect(within(mrLine(9)).getByTestId('drift-br').querySelector('.animate-spin')).toBeTruthy(),
    );

    fireEvent.click(screen.getByTestId('flagged-ms-badge'));
    await openMrPopover();

    const br5 = within(mrLine(5)).getByTestId('drift-br');
    expect(br5.querySelector('.animate-spin')).toBeFalsy();
    // The lock belonged to !9's in-flight write, so !5 must still be firable.
    mockUpdateMergeRequest.mockReturnValueOnce(new Promise(() => {}));
    fireEvent.click(br5);
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

  it('a non-evaluated (locked) MR with out-of-scope keys renders secondary-key-unevaluated, not a drift assertion (WR-04, T-91.1-14)', () => {
    const unevaluatedRow = makeRow({
      mr: makeMR({ id: 1, iid: 1, state: 'locked' }),
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
    expect(unevaluatedKey).toHaveAttribute('title', 'PROJ-9 — not evaluated (MR is locked)');
  });

  it('the secondary table key is a link that opens the issue, like the primary table key (UAT test 5)', () => {
    const flaggedRow = makeRow({
      mr: makeMR({ id: 1, iid: 1 }),
      taskReason: 'not-in-fix-version',
      taskKeys: ['PROJ-9', 'PROJ-8'],
      br: 'flag',
      ms: 'flag',
      flagged: true,
    });
    const unevaluatedRow = makeRow({
      mr: makeMR({ id: 2, iid: 2, state: 'locked' }),
      evaluated: false,
      taskReason: null,
      taskKeys: ['PROJ-7'],
      task: 'na',
      br: 'na',
      ms: 'na',
      flagged: false,
    });
    const { props } = renderSection({
      secondaryRows: [flaggedRow, unevaluatedRow],
      versionName: '33.5.0',
    });

    // Flagged branch: only the leading key is clickable — the `+1` count is not.
    const flaggedKey = screen.getByTestId('secondary-key-flagged');
    const flaggedButtons = flaggedKey.querySelectorAll('button');
    expect(flaggedButtons).toHaveLength(1);
    expect(flaggedButtons[0]).toHaveTextContent('PROJ-9');
    fireEvent.click(flaggedButtons[0]);
    expect(props.onNavigateToIssueFromMR).toHaveBeenCalledWith('PROJ-9');

    // Unevaluated branch is linkified too, and keeps its muted styling.
    const unevaluatedKey = screen.getByTestId('secondary-key-unevaluated');
    const unevaluatedButton = unevaluatedKey.querySelector('button');
    expect(unevaluatedButton).not.toBeNull();
    expect(unevaluatedKey.querySelector('.text-orange-600')).toBeNull();
    if (unevaluatedButton) fireEvent.click(unevaluatedButton);
    expect(props.onNavigateToIssueFromMR).toHaveBeenCalledWith('PROJ-7');
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
      mr: makeMR({ id: 3, iid: 3, state: 'locked' }),
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
  it('both br/ms flagged badges render with no done badge or progress bar, showing the passed per-category counts', () => {
    renderSection({
      flaggedMrCount: 3,
      brFlaggedCount: 2,
      msFlaggedCount: 1,
    });
    expect(screen.queryByText(/ done$/)).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
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
    expect(within(taskRows[0]).getByTestId('mr-status-chip')).toHaveTextContent('open');
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
  // subset before the MR cell ever sees it. Summarising from that subset made
  // a task's other MRs appear to vanish the moment a filter was applied.
  it("WR-08: the chip, aggregates and popover describe the task's MRs, not the filtered subset", async () => {
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

    expect(screen.getByTestId('mr-status-chip')).toHaveTextContent('4 open');
    expect(screen.getByTestId('mr-status-chip').querySelectorAll('[data-mr-disc]')).toHaveLength(4);

    fireEvent.click(screen.getByTestId('flagged-br-badge'));

    // The filter changes which tasks/MRs match, never how many the task has.
    expect(screen.getByTestId('mr-status-chip')).toHaveTextContent('4 open');
    expect(screen.getByTestId('mr-status-chip').querySelectorAll('[data-mr-disc]')).toHaveLength(4);
    expect(screen.getByTestId('task-drift-br').tagName).toBe('BUTTON');
    const popover = await openMrPopover();
    expect(within(popover).getAllByTestId('mr-popover-line')).toHaveLength(4);
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

// WR-10: driftUnavailable was consumed only under `mrs.length === 0`, so a
// task that Channel A found an MR for rendered as a fully confident row while
// Channel C's failure meant other MRs were silently missing from it.
describe('WR-10: a partial channel failure is surfaced page-wide', () => {
  it('renders the partial-failure banner even when every task has MRs', () => {
    renderSection({
      primaryRows: [{ issue: makeIssue(), mrs: [makeRow({ mr: makeMR({ id: 1, iid: 1 }) })] }],
      driftUnavailable: true,
      hasMatchedMilestone: true,
    });

    expect(screen.getByTestId('drift-partial-banner')).toBeInTheDocument();
    // The row itself is unchanged — it has a real MR to show.
    expect(screen.getByTestId('mr-status-chip')).toHaveTextContent('open');
    expect(screen.queryByTestId('mr-slot-failed')).toBeNull();
  });

  it('renders no partial-failure banner when every channel answered', () => {
    renderSection({
      primaryRows: [{ issue: makeIssue(), mrs: [makeRow({ mr: makeMR({ id: 1, iid: 1 }) })] }],
      driftUnavailable: false,
    });

    expect(screen.queryByTestId('drift-partial-banner')).toBeNull();
  });

  it('does not double-report: a failed milestone lookup shows only the degraded banner', () => {
    renderSection({
      primaryRows: [{ issue: makeIssue(), mrs: [] }],
      driftUnavailable: true,
      hasMatchedMilestone: false,
      milestoneLookupFailed: true,
    });

    expect(screen.getByTestId('drift-degraded-banner')).toBeInTheDocument();
    expect(screen.queryByTestId('drift-partial-banner')).toBeNull();
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

// jsdom cannot evaluate container queries, so these lock the tier class
// strings (header strip and rows share the COL_* constants and must stay aligned).
describe('responsive container tiers', () => {
  const personTier = ['@max-[860px]:w-9'];

  it('the section is the @container and header strip carries every tier class', () => {
    const issue = makeIssue({ key: 'PROJ-1' });
    const { container } = renderSection({ primaryRows: [{ issue, mrs: [] }] });
    expect(container.querySelector('section')).toHaveClass('@container');

    const taskList = screen.getByTestId('task-list');
    const strip = taskList.previousElementSibling as HTMLElement;
    // Sortable headers (261102-h1i): the tier classes sit on the header cell that
    // wraps the sort button.
    const assignee = within(strip).getByText('Assignee');
    expect(assignee).toHaveClass('@max-[860px]:sr-only');
    expect(within(strip).getByTestId('task-sort-header-assignee').parentElement).toHaveClass(
      ...personTier,
    );
    expect(within(strip).getByTestId('task-sort-header-status').parentElement).toHaveClass(
      '@max-[400px]:hidden',
    );
    expect(within(strip).getByText('Merge requests').parentElement).toHaveClass(
      '@max-[860px]:w-[6.5rem]',
      '@max-[520px]:hidden',
    );
    expect(within(strip).getByText('MRs')).toHaveClass('hidden', '@max-[860px]:inline');
    expect(strip.firstElementChild).toHaveClass('@max-[640px]:hidden');
  });

  it('a task row carries the same tier classes and sr-only assignee/MR state', () => {
    const issue = makeIssue({ key: 'PROJ-1' });
    const row = makeRow({ mr: makeMR({ iid: 7, state: 'opened' }) });
    renderSection({ primaryRows: [{ issue, mrs: [row] }] });
    const taskRow = screen.getByTestId('task-row');
    const unassigned = within(taskRow).getByText('Unassigned');
    expect(unassigned).toHaveClass('@max-[860px]:sr-only');
    expect(unassigned.parentElement).toHaveClass(...personTier);
    // The avatar stays at every width — the assignee column compacts but never drops.
    expect(unassigned.parentElement?.className).not.toMatch(/:hidden/);
    const icon = within(taskRow).getByTestId('task-row-overlay').nextElementSibling;
    expect(icon).toHaveClass('@max-[640px]:hidden');
    const chip = within(taskRow).getByTestId('mr-status-chip');
    // Long label is sr-only at narrow widths; an aria-hidden short variant replaces it.
    expect(chip.querySelector('span.truncate:not([aria-hidden])')).toHaveClass(
      '@max-[860px]:sr-only',
    );
    const shortLabel = chip.querySelector('span[aria-hidden="true"].hidden') as HTMLElement;
    expect(shortLabel).toHaveClass('hidden', '@max-[860px]:inline');
    expect(chip.parentElement).toHaveClass('@max-[860px]:w-[6.5rem]', '@max-[520px]:hidden');
    const state = within(taskRow).getByText('Status');
    expect(state.parentElement).toHaveClass('@max-[400px]:hidden');
  });

  it('slot states keep the long text sr-only and add a short aria-hidden variant', () => {
    renderWithRows([], { driftUnavailable: true, hasMatchedMilestone: true });
    const failed = screen.getByTestId('mr-slot-failed');
    expect(within(failed).getByText('— MR status unknown')).toHaveClass('@max-[860px]:sr-only');
    const short = within(failed).getByText('— unknown');
    expect(short).toHaveAttribute('aria-hidden', 'true');
    expect(short).toHaveClass('hidden', '@max-[860px]:inline');
  });

  it('flagged badge words hide below 520 while counts and aria-labels remain', () => {
    renderSection({ flaggedMrCount: 3, brFlaggedCount: 2, msFlaggedCount: 1 });
    const br = screen.getByTestId('flagged-br-badge');
    expect(br).toHaveTextContent('2');
    expect(within(br).getByText('wrong branch')).toHaveClass('@max-[520px]:hidden');
    expect(br).toHaveAttribute('title', br.getAttribute('aria-label') as string);
  });
});

describe('MR label filter', () => {
  const lbl = (name: string) => ({ name, color: '#428BCA', text_color: '#fff' });

  it('keeps only tasks with an MR carrying the label, shows the notice, and clears via the escape hatch', () => {
    const onClear = vi.fn();
    renderSection({
      primaryRows: [
        {
          issue: makeIssue({ key: 'PROJ-1' }),
          mrs: [makeRow({ mr: makeMR({ id: 1, iid: 1, labels: [lbl('hotfix')] }) })],
        },
        {
          issue: makeIssue({ key: 'PROJ-2' }),
          mrs: [makeRow({ mr: makeMR({ id: 2, iid: 2, labels: [lbl('backend')] }) })],
        },
        { issue: makeIssue({ key: 'PROJ-3' }), mrs: [] },
      ],
      isLoadingDrift: false,
      labelFilter: 'hotfix',
      onClearLabelFilter: onClear,
    });
    expect(screen.getAllByTestId('task-group')).toHaveLength(1);
    expect(screen.getByTestId('filter-active-notice')).toHaveTextContent('"hotfix"');
    fireEvent.click(screen.getByTestId('filter-clear'));
    expect(onClear).toHaveBeenCalled();
  });

  it('shows the empty message when no MR carries the label', () => {
    renderSection({
      primaryRows: [
        {
          issue: makeIssue({ key: 'PROJ-1' }),
          mrs: [makeRow({ mr: makeMR({ labels: [lbl('backend')] }) })],
        },
      ],
      isLoadingDrift: false,
      labelFilter: 'nope',
    });
    expect(screen.getByText('No merge requests match this filter')).toBeInTheDocument();
  });
});

describe('261102-fkr: secondary row info', () => {
  const sec = () => within(screen.getByTestId('secondary-section'));

  it('renders a reason pill per row and no AlertTriangle in the flagged key', () => {
    renderSection({
      secondaryRows: [
        makeRow({
          mr: makeMR({ id: 1, iid: 1 }),
          taskReason: 'no-linked-task',
          taskKeys: [],
        }),
        makeRow({
          mr: makeMR({ id: 2, iid: 2 }),
          taskReason: 'not-in-fix-version',
          taskKeys: ['PROJ-9'],
        }),
        makeRow({
          mr: makeMR({ id: 3, iid: 3, state: 'locked' }),
          evaluated: false,
          taskReason: null,
          taskKeys: [],
        }),
      ],
    });
    const pills = sec().getAllByTestId('secondary-reason-pill');
    expect(pills.map((p) => p.getAttribute('data-reason'))).toEqual([
      'no-linked-task',
      'not-in-fix-version',
      'unevaluated',
    ]);
    expect(pills[0]).toHaveTextContent('No task');
    expect(pills[1]).toHaveTextContent('Not in version');
    expect(pills[1]).toHaveAttribute('title', 'PROJ-9 is not in fix version 33.5.0');
    expect(pills[2]).toHaveTextContent('Not evaluated');
    expect(pills[2]).toHaveAttribute('title', 'Not evaluated (MR is locked)');
    expect(pills[2].className).not.toContain('orange');
    expect(sec().getByTestId('secondary-key-flagged').querySelector('svg')).toBeNull();
  });

  it('shows the author and every reviewer without a +N cap', () => {
    const reviewers = ['Bob', 'Carol', 'Dan', 'Eve', 'Fay'].map((name, i) => ({
      id: 10 + i,
      name,
      username: name.toLowerCase(),
      avatar_url: '',
    }));
    renderSection({
      secondaryRows: [
        makeRow({
          mr: makeMR({ reviewers }),
          taskReason: 'no-linked-task',
          taskKeys: [],
        }),
      ],
    });
    const row = within(screen.getByTestId('drift-row'));
    expect(row.getByText('Alice')).toBeInTheDocument();
    const group = row.getByTitle('Reviewers: Bob, Carol, Dan, Eve, Fay');
    expect(group.textContent).not.toMatch(/\+\d/);
    expect(within(group).getAllByRole('img')).toHaveLength(5);
  });

  it('shows a muted dash when there are no reviewers', () => {
    renderSection({
      secondaryRows: [makeRow({ taskReason: 'no-linked-task', taskKeys: [] })],
    });
    expect(within(screen.getByTestId('drift-row')).getByTitle('No reviewers')).toHaveTextContent(
      '—',
    );
  });

  it.each([
    ['opened', false, 'Open'],
    ['opened', true, 'Draft'],
    ['merged', false, 'Merged'],
    ['closed', false, 'Closed'],
    ['locked', false, 'Locked'],
  ] as const)('state %s draft=%s renders %s', (state, draft, label) => {
    renderSection({
      secondaryRows: [
        makeRow({
          mr: makeMR({ state, draft }),
          evaluated: state === 'opened',
          taskReason: state === 'opened' ? 'no-linked-task' : null,
          taskKeys: [],
        }),
      ],
    });
    expect(sec().getByTestId('secondary-mr-state')).toHaveTextContent(label);
  });
});

describe('261102-fkr: secondary header', () => {
  const rows = () => [
    makeRow({
      mr: makeMR({
        id: 1,
        iid: 1,
        labels: [{ name: 'a', color: '#000000', text_color: '#ffffff' }],
      }),
      taskReason: 'no-linked-task',
      taskKeys: [],
    }),
    makeRow({ mr: makeMR({ id: 2, iid: 2 }), taskReason: 'no-linked-task', taskKeys: [] }),
    makeRow({
      mr: makeMR({ id: 3, iid: 3 }),
      taskReason: 'not-in-fix-version',
      taskKeys: ['PROJ-9'],
    }),
    makeRow({
      mr: makeMR({ id: 4, iid: 4, state: 'locked' }),
      evaluated: false,
      taskReason: null,
      taskKeys: [],
    }),
  ];

  it('shows one total count pill and no per-reason chips', () => {
    renderSection({ secondaryRows: rows() });
    expect(screen.getByText('Not covered by tasks above')).toBeInTheDocument();
    expect(screen.getByTestId('secondary-count')).toHaveTextContent('4');
    expect(screen.queryByTestId('secondary-reason-chip-no-linked-task')).toBeNull();
    expect(screen.queryByTestId('secondary-reason-chip-not-in-fix-version')).toBeNull();
    expect(screen.queryByTestId('secondary-reason-chip-unevaluated')).toBeNull();
  });

  it('count follows the active label filter', () => {
    renderSection({ secondaryRows: rows(), labelFilter: 'a' });
    expect(screen.getByTestId('secondary-count')).toHaveTextContent('1');
  });
});

describe('261102-fkr: secondary title drops the leading key', () => {
  it.each([
    ['PROJ-1 Fix the thing', 'Fix the thing'],
    ['[PROJ-1] Fix the thing', 'Fix the thing'],
    ['PROJ-1: Fix the thing', 'Fix the thing'],
    ['proj 1 - Fix the thing', 'Fix the thing'],
    ['(PROJ-1) \u2014 Fix the thing', 'Fix the thing'],
  ])('strips the prefix of %s', (title, expected) => {
    expect(stripLeadingTicketKeys(title, ['PROJ-1'])).toBe(expected);
  });

  it('keeps keys that are not a leading prefix, and never empties the title', () => {
    expect(stripLeadingTicketKeys('Fix PROJ-1 properly', ['PROJ-1'])).toBe('Fix PROJ-1 properly');
    expect(stripLeadingTicketKeys('PROJ-1', ['PROJ-1'])).toBe('PROJ-1');
    expect(stripLeadingTicketKeys('Other', [])).toBe('Other');
  });

  it('renders the secondary row title without the key prefix', () => {
    renderSection({
      secondaryRows: [
        makeRow({
          mr: makeMR({ title: 'PROJ-9: Tidy the cache' }),
          taskReason: 'not-in-fix-version',
          taskKeys: ['PROJ-9'],
        }),
      ],
    });
    const row = within(screen.getByTestId('secondary-section')).getByTestId('drift-row');
    expect(row).toHaveTextContent('Tidy the cache');
    expect(row).not.toHaveTextContent('PROJ-9: Tidy');
    expect(within(row).getAllByText('PROJ-9')).toHaveLength(1);
  });
});

describe('261102-h1i: issue filter + sort', () => {
  beforeEach(() => {
    usePeekStore.setState({ peekIssueKey: null });
  });

  function issues() {
    return [
      makeIssue({
        key: 'PROJ-10',
        summary: 'Fix Login bug',
        status: 'Done',
        statusCategory: 'done',
        issuetype: 'Bug',
        assignee: 'Alice',
      }),
      makeIssue({
        key: 'PROJ-9',
        summary: 'Add export',
        status: 'In Progress',
        statusCategory: 'indeterminate',
        issuetype: 'Story',
        assignee: null,
      }),
      makeIssue({
        key: 'PROJ-11',
        summary: 'Tidy styles',
        status: 'To Do',
        statusCategory: 'new',
        issuetype: 'Task',
        assignee: 'Bob',
      }),
    ];
  }

  // Popover options are buttons; the row text (status pill, 'Unassigned') is not.
  const pickOption = async (name: string) => {
    const opts = await screen.findAllByRole('button', { name });
    return opts[opts.length - 1];
  };

  const visibleKeys = () =>
    screen.queryAllByTestId('task-row').map((r) => r.textContent?.match(/PROJ-\d+/)?.[0] ?? '');

  function renderIssues(overrides: Partial<UnifiedTaskTableProps> = {}) {
    return renderSection({
      primaryRows: issues().map((issue) => ({ issue, mrs: [] })),
      ...overrides,
    });
  }

  it('shows the toolbar only once issues have loaded and exist', () => {
    const { unmount } = renderIssues({ isLoadingIssues: true });
    expect(screen.queryByTestId('task-filter-toolbar')).toBeNull();
    unmount();
    const empty = renderSection({ primaryRows: [] });
    expect(screen.queryByTestId('task-filter-toolbar')).toBeNull();
    empty.unmount();
    renderIssues();
    expect(screen.getByTestId('task-filter-toolbar')).toHaveAttribute('role', 'toolbar');
  });

  it('search hides non-matching rows', () => {
    renderIssues();
    fireEvent.change(screen.getByLabelText('Search issues'), { target: { value: 'login' } });
    expect(visibleKeys()).toEqual(['PROJ-10']);
    fireEvent.change(screen.getByLabelText('Search issues'), { target: { value: 'proj-11' } });
    expect(visibleKeys()).toEqual(['PROJ-11']);
  });

  it('Unassigned filter shows only unassigned rows; chip X removes it', async () => {
    renderIssues();
    fireEvent.click(screen.getByTestId('task-filter-assignee'));
    fireEvent.click(await pickOption('Unassigned'));
    expect(visibleKeys()).toEqual(['PROJ-9']);
    const chipRemove = screen.getByTestId('task-filter-chip-assignee-__unassigned__');
    expect(chipRemove.parentElement).toHaveTextContent('Assignee: Unassigned');
    fireEvent.click(chipRemove);
    expect(visibleKeys()).toHaveLength(3);
  });

  it('status and type filters narrow rows; Clear all resets everything', async () => {
    renderIssues();
    fireEvent.click(screen.getByTestId('task-filter-status'));
    fireEvent.click(await pickOption('In Progress'));
    expect(visibleKeys()).toEqual(['PROJ-9']);
    fireEvent.click(screen.getByTestId('task-filter-type'));
    fireEvent.click(await pickOption('Bug'));
    // AND across dimensions: In Progress AND Bug -> nothing.
    expect(visibleKeys()).toEqual([]);
    fireEvent.click(screen.getByTestId('task-filter-clear-all'));
    expect(visibleKeys()).toHaveLength(3);
    expect(screen.queryByTestId('task-filter-clear-all')).toBeNull();
  });

  it('type filter matches by type name', async () => {
    renderIssues();
    fireEvent.click(screen.getByTestId('task-filter-type'));
    fireEvent.click(await pickOption('Task'));
    expect(visibleKeys()).toEqual(['PROJ-11']);
  });

  it('Key header cycles asc, desc, original with an indicator', () => {
    renderIssues();
    expect(visibleKeys()).toEqual(['PROJ-10', 'PROJ-9', 'PROJ-11']);
    const header = screen.getByTestId('task-sort-header-key');
    fireEvent.click(header);
    expect(visibleKeys()).toEqual(['PROJ-9', 'PROJ-10', 'PROJ-11']);
    expect(screen.getByTestId('task-sort-indicator-key')).toBeInTheDocument();
    fireEvent.click(header);
    expect(visibleKeys()).toEqual(['PROJ-11', 'PROJ-10', 'PROJ-9']);
    fireEvent.click(header);
    expect(visibleKeys()).toEqual(['PROJ-10', 'PROJ-9', 'PROJ-11']);
    expect(screen.queryByTestId('task-sort-indicator-key')).toBeNull();
  });

  it('Status header orders To Do, In Progress, Done', () => {
    renderIssues();
    fireEvent.click(screen.getByTestId('task-sort-header-status'));
    expect(visibleKeys()).toEqual(['PROJ-11', 'PROJ-9', 'PROJ-10']);
  });

  it('issue filters compose with the BR badge; secondary rows are unaffected', () => {
    const [a, b, c] = issues();
    const flagged = () => makeRow({ br: 'flag', flagged: true });
    const secondary = makeRow({
      mr: makeMR({ iid: 99, title: 'Orphan MR' }),
      br: 'flag',
      task: 'flag',
      taskReason: 'no-linked-task',
      taskKeys: [],
    });
    renderSection({
      primaryRows: [
        { issue: a, mrs: [flagged()] },
        { issue: b, mrs: [flagged()] },
        { issue: c, mrs: [makeRow()] },
      ],
      secondaryRows: [secondary],
      flaggedMrCount: 2,
      brFlaggedCount: 2,
    });
    fireEvent.click(screen.getByTestId('flagged-br-badge'));
    expect(visibleKeys()).toEqual(['PROJ-10', 'PROJ-9']);
    fireEvent.change(screen.getByLabelText('Search issues'), { target: { value: 'export' } });
    expect(visibleKeys()).toEqual(['PROJ-9']);
    expect(screen.getByTestId('secondary-section')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search issues'), { target: { value: 'nothing-here' } });
    expect(screen.getByTestId('secondary-section')).toBeInTheDocument();
  });

  it('shows a no-match message with Clear filters and no header strip', () => {
    renderIssues();
    fireEvent.change(screen.getByLabelText('Search issues'), { target: { value: 'zzz' } });
    expect(screen.getByText(/No issues match the filters/)).toBeInTheDocument();
    expect(screen.queryByTestId('task-column-header')).toBeNull();
    fireEvent.click(screen.getByTestId('task-filter-clear'));
    expect(visibleKeys()).toHaveLength(3);
    expect(screen.getByTestId('task-column-header')).toBeInTheDocument();
  });

  it('261102-vuw: a controlled issueFilterState filters rows and shows its chip', () => {
    const { result } = renderHook(() => useTaskIssueFilters('v1'));
    act(() => result.current.toggle('statuses', ['In Progress']));
    renderIssues({ issueFilterState: result.current });
    expect(visibleKeys()).toEqual(['PROJ-9']);
    expect(screen.getByTestId('task-filter-chip-status-In Progress')).toBeInTheDocument();
  });
});

describe('261103-cln: not-covered section callout + fix actions', () => {
  const JIRA_FIX = { baseUrl: 'https://jira.example.com', versionId: '10100' };

  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  const notInVersion = (id: number, keys = ['PROJ-9']) =>
    makeRow({
      mr: makeMR({ id, iid: id }),
      taskReason: 'not-in-fix-version',
      taskKeys: keys,
    });
  const noTask = (id: number, title = 'Fix thing') =>
    makeRow({
      mr: makeMR({ id, iid: id, title }),
      taskReason: 'no-linked-task',
      taskKeys: [],
    });

  it('renders as an orange callout div with an h3', () => {
    renderSection({ secondaryRows: [noTask(1)] });
    const section = screen.getByTestId('secondary-section');
    expect(section.tagName).toBe('DIV');
    expect(section.className).toContain('border-orange-400');
    expect(within(section).getByRole('heading', { level: 3 })).toHaveTextContent(
      'Not covered by tasks above',
    );
  });

  it('shows 5 rows plus Show all N, and expands on click', () => {
    renderSection({ secondaryRows: [1, 2, 3, 4, 5, 6, 7].map((i) => noTask(i)) });
    expect(screen.getAllByTestId('drift-row')).toHaveLength(5);
    fireEvent.click(screen.getByTestId('secondary-show-all'));
    expect(screen.getAllByTestId('drift-row')).toHaveLength(7);
    expect(screen.getByTestId('secondary-count')).toHaveTextContent('7');
  });

  it('Apply adds the fix version for the single linked key and shows pending', async () => {
    let resolve: () => void = () => {};
    vi.mocked(addIssueFixVersion).mockImplementation(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    renderSection({ secondaryRows: [notInVersion(1)], jiraFix: JIRA_FIX });

    const btn = screen.getByRole('button', { name: 'Add PROJ-9 to 33.5.0' });
    fireEvent.click(btn);
    await waitFor(() =>
      expect(addIssueFixVersion).toHaveBeenCalledWith(
        'https://jira.example.com',
        'jira-tok',
        'PROJ-9',
        '10100',
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add PROJ-9 to 33.5.0' })).toBeDisabled(),
    );
    await act(async () => resolve());
  });

  it('Apply failure renders an inline role=alert error', async () => {
    vi.mocked(addIssueFixVersion).mockRejectedValue(new Error('Version is not valid'));
    renderSection({ secondaryRows: [notInVersion(1)], jiraFix: JIRA_FIX });

    fireEvent.click(screen.getByRole('button', { name: 'Add PROJ-9 to 33.5.0' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Version is not valid');
  });

  it('a row with several keys offers one Add entry per key', async () => {
    renderSection({
      secondaryRows: [notInVersion(1, ['PROJ-9', 'PROJ-10'])],
      jiraFix: JIRA_FIX,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Choose a task' }));
    expect(await screen.findByText('Add PROJ-9 to 33.5.0')).toBeInTheDocument();
    expect(screen.getByText('Add PROJ-10 to 33.5.0')).toBeInTheDocument();
  });

  it("the Fix column says what each row's button will do", () => {
    renderSection({
      secondaryRows: [notInVersion(1), noTask(2)],
      jiraFix: JIRA_FIX,
    });
    const targets = screen.getAllByTestId('secondary-fix-target');
    expect(targets[0]).toHaveTextContent('→ add to 33.5.0');
    expect(targets[0]).toHaveAttribute('title', expect.stringContaining('PROJ-9'));
    expect(targets[1]).toHaveTextContent('→ link a release task');
  });

  it('the Fix column is empty when the row has no action', () => {
    renderSection({ secondaryRows: [notInVersion(1)] });
    expect(screen.getByTestId('secondary-fix-target')).toBeEmptyDOMElement();
  });

  it('the header reserves the trailing action column so labels line up with row cells', () => {
    renderSection({ secondaryRows: [noTask(1)] });
    const header = screen.getByTestId('secondary-header');
    const spacer = within(header).getByTestId('secondary-header-fix-action');
    expect(header.lastElementChild).toBe(spacer);
    const row = screen.getByTestId('drift-row');
    expect(spacer.className).toBe((row.lastElementChild as HTMLElement).className);
  });

  it('the Fix column sits directly before the button column, in header and rows', () => {
    renderSection({ secondaryRows: [noTask(1)] });
    const header = screen.getByTestId('secondary-header');
    expect(header.lastElementChild?.previousElementSibling).toHaveTextContent('Fix');
    const row = screen.getByTestId('drift-row');
    expect(row.lastElementChild?.previousElementSibling).toBe(
      within(row).getByTestId('secondary-fix-target'),
    );
  });

  it('no Apply button when jiraFix is absent', () => {
    renderSection({ secondaryRows: [notInVersion(1)] });
    expect(screen.queryByRole('button', { name: /Add PROJ-9/ })).toBeNull();
  });

  it('Link task lists release issues, filters, and prepends the picked key to the MR title', async () => {
    mockUpdateMergeRequest.mockResolvedValue(makeMR({ id: 1, title: 'PROJ-1 Fix thing' }));
    renderSection({
      secondaryRows: [noTask(1)],
      primaryRows: [
        { issue: makeIssue({ key: 'PROJ-1', summary: 'Alpha work' }), mrs: [] },
        { issue: makeIssue({ key: 'PROJ-2', summary: 'Beta work' }), mrs: [] },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Link task' }));
    expect(await screen.findByRole('option', { name: /Alpha work/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Beta work/ })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search release issues…'), {
      target: { value: 'Alpha' },
    });
    await waitFor(() => expect(screen.queryByRole('option', { name: /Beta work/ })).toBeNull());

    fireEvent.click(screen.getByRole('option', { name: /Alpha work/ }));
    await waitFor(() =>
      expect(mockUpdateMergeRequest).toHaveBeenCalledWith(
        'https://gitlab.example.com',
        't',
        42,
        1,
        { title: 'PROJ-1 Fix thing' },
      ),
    );
  });

  it('Link task keeps a Draft prefix first', async () => {
    mockUpdateMergeRequest.mockResolvedValue(makeMR({ id: 1 }));
    renderSection({
      secondaryRows: [noTask(1, 'Draft: Fix thing')],
      primaryRows: [{ issue: makeIssue({ key: 'PROJ-1', summary: 'Alpha work' }), mrs: [] }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Link task' }));
    fireEvent.click(await screen.findByRole('option', { name: /Alpha work/ }));
    await waitFor(() =>
      expect(mockUpdateMergeRequest).toHaveBeenCalledWith(
        'https://gitlab.example.com',
        't',
        42,
        1,
        { title: 'Draft: PROJ-1 Fix thing' },
      ),
    );
  });

  it('261103-eu3: a merged not-in-version row gets the real pill, orange key, add-to target and Apply; BR/MS stay em dashes', () => {
    renderSection({
      secondaryRows: [
        makeRow({
          mr: makeMR({ id: 1, iid: 1, state: 'merged' }),
          evaluated: false,
          br: 'na',
          ms: 'na',
          task: 'flag',
          taskReason: 'not-in-fix-version',
          taskKeys: ['PROJ-9'],
          flagged: true,
        }),
      ],
      jiraFix: JIRA_FIX,
    });
    const row = screen.getByTestId('drift-row');
    const pill = within(row).getByTestId('secondary-reason-pill');
    expect(pill).toHaveAttribute('data-reason', 'not-in-fix-version');
    expect(pill.className).not.toContain('bg-muted');
    expect(within(row).getByTestId('secondary-key-flagged')).toHaveTextContent('PROJ-9');
    expect(within(row).getByTestId('secondary-fix-target')).toHaveTextContent('→ add to 33.5.0');
    expect(within(row).getByRole('button', { name: 'Add PROJ-9 to 33.5.0' })).toBeInTheDocument();
    expect(within(row).getByTestId('drift-br')).toHaveTextContent('—');
    expect(within(row).getByTestId('drift-ms')).toHaveTextContent('—');
    expect(within(row).getByTestId('drift-br').querySelector('button')).toBeNull();
    expect(within(row).getByTestId('drift-ms').querySelector('button')).toBeNull();
  });

  it('261103-eu3: a merged keyless row gets No task + Link task, which retitles the merged MR', async () => {
    mockUpdateMergeRequest.mockResolvedValue(makeMR({ id: 7, title: 'PROJ-1 Shipped thing' }));
    renderSection({
      secondaryRows: [
        makeRow({
          mr: makeMR({ id: 7, iid: 7, state: 'merged', title: 'Shipped thing' }),
          evaluated: false,
          br: 'na',
          ms: 'na',
          task: 'flag',
          taskReason: 'no-linked-task',
          taskKeys: [],
          flagged: true,
        }),
      ],
      primaryRows: [{ issue: makeIssue({ key: 'PROJ-1', summary: 'Alpha work' }), mrs: [] }],
    });
    expect(screen.getByTestId('secondary-reason-pill')).toHaveTextContent('No task');
    fireEvent.click(screen.getByRole('button', { name: 'Link task' }));
    fireEvent.click(await screen.findByRole('option', { name: /Alpha work/ }));
    await waitFor(() =>
      expect(mockUpdateMergeRequest).toHaveBeenCalledWith(
        'https://gitlab.example.com',
        't',
        42,
        7,
        { title: 'PROJ-1 Shipped thing' },
      ),
    );
  });

  it('an unevaluated row has a muted pill and no action button', () => {
    renderSection({
      secondaryRows: [
        makeRow({
          mr: makeMR({ id: 1, iid: 1, state: 'locked' }),
          evaluated: false,
          taskReason: null,
          taskKeys: ['PROJ-9'],
        }),
      ],
      jiraFix: JIRA_FIX,
    });
    const row = screen.getByTestId('drift-row');
    expect(within(row).getByTestId('secondary-reason-pill').className).toContain('bg-muted');
    expect(within(row).queryByRole('button', { name: /Link task|Add PROJ-9/ })).toBeNull();
  });

  describe('261103-f27: type icon + epic suppression', () => {
    const rowWith = (keys: string[]) =>
      makeRow({
        mr: makeMR({ id: 1, iid: 1 }),
        taskReason: 'not-in-fix-version',
        taskKeys: keys,
      });

    it('renders the issue type icon before the key, empty when the type is unknown', () => {
      renderSection({
        secondaryRows: [rowWith(['PROJ-9']), rowWith(['PROJ-8'])],
        secondaryKeyTypes: { 'PROJ-9': 'Bug' },
      });
      const icons = screen.getAllByTestId('secondary-type-icon');
      expect(icons).toHaveLength(2);
      expect(icons[0].querySelector('svg, img')).not.toBeNull();
      expect(icons[1]).toBeEmptyDOMElement();
      const key = screen.getAllByTestId('secondary-key-flagged')[0];
      expect(icons[0].nextElementSibling).toBe(key);
    });

    it('the header has an icon spacer before Key', () => {
      renderSection({ secondaryRows: [rowWith(['PROJ-9'])] });
      const header = screen.getByTestId('secondary-header');
      const keyLabel = within(header).getByText('Key');
      expect(keyLabel.previousElementSibling).toHaveAttribute('aria-hidden', 'true');
    });

    it('an epic-only row has no Apply button and explains why', () => {
      renderSection({
        secondaryRows: [rowWith(['EPIC-1'])],
        secondaryKeyTypes: { 'EPIC-1': 'Epic' },
        jiraFix: JIRA_FIX,
      });
      expect(screen.queryByRole('button', { name: /Add EPIC-1/ })).toBeNull();
      expect(screen.queryByText('Apply')).toBeNull();
      const pill = screen.getByTestId('secondary-reason-pill');
      expect(pill).toHaveAttribute('data-reason', 'not-in-fix-version');
      expect(pill).toHaveTextContent('Not in version');
      const target = screen.getByTestId('secondary-fix-target');
      expect(target).toHaveTextContent("Epics can't have a fix version");
      expect(target.textContent).not.toContain('→');
    });

    it('a mixed row offers Apply only for the non-epic key', () => {
      renderSection({
        secondaryRows: [rowWith(['EPIC-1', 'TASK-2'])],
        secondaryKeyTypes: { 'EPIC-1': 'Epic', 'TASK-2': 'Task' },
        jiraFix: JIRA_FIX,
      });
      expect(screen.getByRole('button', { name: 'Add TASK-2 to 33.5.0' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /EPIC-1 to/ })).toBeNull();
      expect(screen.getByTestId('secondary-reason-pill')).toHaveAttribute(
        'data-reason',
        'not-in-fix-version',
      );
    });

    it('unknown types keep offering Apply', () => {
      renderSection({ secondaryRows: [rowWith(['PROJ-9'])], jiraFix: JIRA_FIX });
      expect(screen.getByRole('button', { name: 'Add PROJ-9 to 33.5.0' })).toBeInTheDocument();
    });
  });
});

describe('aggregateMark', () => {
  it('is na for empty or all-na, ok if any ok, flag beats everything', () => {
    expect(aggregateMark([])).toBe('na');
    expect(aggregateMark(['na', 'na'])).toBe('na');
    expect(aggregateMark(['ok', 'na'])).toBe('ok');
    expect(aggregateMark(['ok', 'flag'])).toBe('flag');
    expect(aggregateMark(['flag'])).toBe('flag');
  });
});

describe('mrStatusSummary', () => {
  const r = (id: number, state: GitLabMR['state'], draft = false) =>
    makeRow({ mr: makeMR({ id, iid: id, state, draft }) });

  it('labels merged / mixed / open / draft / n open / closed', () => {
    expect(mrStatusSummary([r(1, 'merged'), r(2, 'merged')]).label).toBe('merged');
    const mixed = mrStatusSummary([r(1, 'opened'), r(2, 'merged')]);
    expect(mixed.label).toBe('1/2 merged');
    expect(mixed.shortLabel).toBe('1/2');
    expect(mrStatusSummary([r(1, 'opened')]).label).toBe('open');
    expect(mrStatusSummary([r(1, 'opened', true)]).label).toBe('draft');
    expect(mrStatusSummary([r(1, 'opened'), r(2, 'opened')]).label).toBe('2 open');
    expect(mrStatusSummary([r(1, 'closed'), r(2, 'locked')]).label).toBe('closed');
  });

  it('excludes closed MRs from the counts when something is live', () => {
    expect(mrStatusSummary([r(1, 'merged'), r(2, 'closed')]).label).toBe('merged');
  });

  it('orders dots merged, opened, closed and never collapses them', () => {
    const s = mrStatusSummary([r(1, 'closed'), r(2, 'opened'), r(3, 'merged')]);
    expect(s.dots.map((d) => d.mr.state)).toEqual(['merged', 'opened', 'closed']);
    const seven = mrStatusSummary([1, 2, 3, 4, 5, 6, 7].map((i) => r(i, 'opened')));
    expect(seven.dots).toHaveLength(7);
  });

  it('tones the pill by overall state', () => {
    expect(mrStatusSummary([r(1, 'merged')]).tone).toBe('green');
    expect(mrStatusSummary([r(1, 'opened'), r(2, 'merged')]).tone).toBe('blue');
    expect(mrStatusSummary([r(1, 'opened')]).tone).toBe('blue');
    expect(mrStatusSummary([r(1, 'opened', true)]).tone).toBe('muted');
    expect(mrStatusSummary([r(1, 'closed')]).tone).toBe('muted');
  });

  it('builds an aria label with singular/plural', () => {
    expect(mrStatusSummary([r(1, 'opened'), r(2, 'merged')]).ariaLabel).toBe(
      '1/2 merged — 2 merge requests: 1 merged, 1 open — show details',
    );
    expect(mrStatusSummary([r(1, 'merged')]).ariaLabel).toMatch(/^merged — 1 merge request: /);
  });
});

describe('task row MR status chip + popover (261103-g8m)', () => {
  beforeEach(() => {
    mockUpdateMergeRequest.mockReset();
  });

  it('a failed fix is still shown after the popover is closed and reopened (lazy keepMounted)', async () => {
    mockUpdateMergeRequest.mockRejectedValueOnce(new Error('protected branch'));
    renderWithRows([makeRow({ br: 'flag', flagged: true })], { flaggedMrCount: 1 });

    // Never opened: nothing is mounted for this row.
    expect(screen.queryByTestId('mr-popover')).toBeNull();

    const popover = await openMrPopover();
    fireEvent.click(screen.getByTestId('drift-br'));
    await waitFor(() =>
      expect(screen.getByTestId('drift-br').querySelector('.text-red-600')).toBeTruthy(),
    );

    fireEvent.keyDown(popover, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.getByTestId('mr-status-chip')).toHaveAttribute('aria-expanded', 'false'),
    );

    await openMrPopover();
    const br = screen.getByTestId('drift-br');
    expect(br.querySelector('.text-red-600')).toBeTruthy();
    expect(br).toHaveAttribute('title', 'protected branch');
    expect(mockUpdateMergeRequest).toHaveBeenCalledTimes(1);
  });

  it('the chip and a flagged aggregate are z-10 pointer-events-auto buttons, siblings of the overlay; an ok aggregate is inert', () => {
    renderWithRows([makeRow({ br: 'flag', ms: 'ok', flagged: true })], { flaggedMrCount: 1 });

    const overlay = screen.getByTestId('task-row-overlay');
    for (const id of ['mr-status-chip', 'task-drift-br']) {
      const el = screen.getByTestId(id);
      expect(el.tagName).toBe('BUTTON');
      expect(el).toHaveClass('pointer-events-auto', 'relative', 'z-10');
      expect(overlay.contains(el)).toBe(false);
    }
    const ok = screen.getByTestId('task-drift-ms');
    expect(ok.tagName).not.toBe('BUTTON');
    expect(ok.parentElement).toHaveClass('pointer-events-none');
  });

  it('clicking the chip never opens the issue peek', async () => {
    const onOpenIssue = vi.fn();
    renderWithRows([makeRow()], { onOpenIssue });
    await openMrPopover();
    expect(onOpenIssue).not.toHaveBeenCalled();
  });

  it('every popover line carries group/row and the scroller is positioned (sr-only live regions)', async () => {
    renderWithRows([
      makeRow({ mr: makeMR({ id: 1, iid: 1 }) }),
      makeRow({ mr: makeMR({ id: 2, iid: 2 }) }),
    ]);
    const popover = await openMrPopover();
    const lines = within(popover).getAllByTestId('mr-popover-line');
    expect(lines).toHaveLength(2);
    for (const l of lines) expect(l).toHaveClass('group/row');
    expect(lines[0].parentElement).toHaveClass('relative');
  });

  it('popover strips the leading task key from the MR title and shows the full author', async () => {
    renderWithRows([
      makeRow({
        mr: makeMR({
          title: '[PROJ-1] Fix login redirect',
          author: { id: 7, name: 'Alexandra Longname-Smith', username: 'al', avatar_url: '' },
        }),
      }),
    ]);
    const popover = await openMrPopover();
    const line = within(popover).getByTestId('mr-popover-line');
    expect(line).toHaveTextContent('Fix login redirect');
    expect(line).not.toHaveTextContent('PROJ-1');
    expect(line).toHaveTextContent('Alexandra Longname-Smith');
    expect(within(line).getByTestId('mr-popover-state')).toHaveTextContent('Open');
  });

  it('orders task columns Key / Summary / MRs / BR / MS / Status / Assignee', () => {
    renderWithRows([makeRow()]);
    const header = screen.getByTestId('task-column-header');
    const labels = [...header.children].map((c) => c.textContent?.trim()).filter(Boolean);
    expect(labels[0]).toMatch(/^Key/);
    expect(labels[1]).toMatch(/^Summary/);
    expect(labels[2]).toMatch(/^Merge requests/);
    expect(labels.slice(3, 5)).toEqual(['BR', 'MS']);
    expect(labels[5]).toMatch(/^Status/);
    expect(labels[6]).toMatch(/^Assignee/);
    const row = screen.getByTestId('task-row');
    expect(row.lastElementChild).toHaveTextContent(/Unassigned|.+/);
    expect(row.lastElementChild?.querySelector('[data-testid="mr-status-chip"]')).toBeNull();
  });

  it('shows one dot per MR with no +N for 5 MRs; a lone merged MR is 1 dot and "merged"', async () => {
    const five = [1, 2, 3, 4, 5].map((i) => makeRow({ mr: makeMR({ id: i, iid: i }) }));
    const { unmount } = renderWithRows(five);
    const chip = screen.getByTestId('mr-status-chip');
    expect(chip.querySelectorAll('[data-mr-disc]')).toHaveLength(5);
    expect(chip).not.toHaveTextContent('+');
    unmount();

    renderWithRows([makeRow({ mr: makeMR({ id: 9, iid: 9, state: 'merged' }) })]);
    const lone = screen.getByTestId('mr-status-chip');
    expect(lone.querySelectorAll('[data-mr-disc]')).toHaveLength(1);
    expect(lone).toHaveTextContent('merged');
    const popover = await openMrPopover();
    expect(within(popover).getAllByTestId('mr-popover-line')).toHaveLength(1);
  });

  it('the chip aria-label summarises merged/open counts', () => {
    renderWithRows([
      makeRow({ mr: makeMR({ id: 1, iid: 1, state: 'merged' }), evaluated: false }),
      makeRow({ mr: makeMR({ id: 2, iid: 2, state: 'opened' }) }),
    ]);
    expect(screen.getByTestId('mr-status-chip')).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/2 merge requests: 1 merged, 1 open/),
    );
  });
});
