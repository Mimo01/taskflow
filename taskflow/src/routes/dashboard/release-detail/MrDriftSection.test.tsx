// DRIFT-04/05/06/07/08: MrDriftSection is presentational and props-driven —
// render assertions for flagged ordering, the three columns, muted states and
// the degraded banner.

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GitLabMR } from '@/services/gitlab';
import type { DriftRow } from './driftDetection';
import { matchTicketKeyInTitle, MrDriftSection } from './MrDriftSection';

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(),
}));

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

function renderSection(overrides: Partial<React.ComponentProps<typeof MrDriftSection>> = {}) {
  return render(
    <MrDriftSection
      rows={[]}
      flaggedCount={0}
      hasMatchedMilestone={true}
      isLoading={false}
      onNavigateToIssueFromMR={() => {}}
      {...overrides}
    />,
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
});
