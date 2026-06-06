// Phase 77 Plan 03 — PeekPanel unit tests.
// Requirements covered: PEEK-02, PEEK-03, PEEK-04, PEEK-06, PEEK-07
// PEEK-01 (handler sets peekIssueKey in AppLayout) and PEEK-05 (TaskCard key split) are
// covered in Plan 04 / TaskCard.test.tsx respectively.
//
// NOTE: The header (icon + key + title) is owned by PeekPanel, not IssueDetailView.
// PeekPanel issues a deduped useQuery for the issue detail so it can show the title.
// The query is mocked below to the loading state (data: undefined) so the tests exercise
// the "key + controls only, no title" branch — which matches what PEEK-04/PEEK-06 assert.

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PeekPanel } from './PeekPanel';

// Mock IssueDetailView so PeekPanel renders without live network/QueryClient.
// The mock renders a stable marker div that the tests assert against.
vi.mock('@/routes/dashboard/IssueDetailView', () => ({
  IssueDetailView: ({ issueKey }: { issueKey: string }) => (
    <div data-testid="issue-detail-body" data-issue-key={issueKey}>
      IssueDetailView mock for {issueKey}
    </div>
  ),
}));

// Mock useResizable — returns a stable width and noop handlers (no DOM resize logic needed in unit tests)
vi.mock('@/hooks/useResizable', () => ({
  useResizable: () => ({ width: 480, isDragging: false, handleMouseDown: vi.fn() }),
}));

// Mock useQuery — returns the loading state (data: undefined) so the header shows
// key + controls only (no icon or title). This matches what PEEK-04/PEEK-06 assert.
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ data: undefined, isLoading: false })),
}));

// Mock auth + settings stores (needed for the deduped useQuery in PeekPanel)
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn((selector?: (s: unknown) => unknown) => {
    const state = { jiraBaseUrl: 'https://jira.example', jiraConnected: true };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn((selector?: (s: unknown) => unknown) => {
    const state = {
      epicLinkFieldKey: '',
      epicNameFieldKey: '',
      sprintFieldKey: '',
      storyPointsFieldKey: '',
      epicColorFieldKey: '',
    };
    return selector ? selector(state) : state;
  }),
}));

// Mock stronghold + jira so imports resolve without native modules
vi.mock('@/services/stronghold', () => ({ readSecret: vi.fn() }));
vi.mock('@/services/jira', () => ({ fetchIssueDetail: vi.fn() }));

const defaultProps = {
  issueKey: 'PROJ-1',
  width: 480,
  onWidthChange: vi.fn(),
  onClose: vi.fn(),
  onOpenIssue: vi.fn(),
  onNavigateFull: vi.fn(),
  paletteOpen: false,
};

function renderPanel(props: Partial<typeof defaultProps> = {}) {
  return render(<PeekPanel {...defaultProps} {...props} />);
}

describe('PeekPanel', () => {
  // PEEK-02: PeekPanel renders issue-detail-body for a given issueKey
  it('PEEK-02: renders issue-detail-body for the given issueKey', () => {
    renderPanel({ issueKey: 'PROJ-42' });
    const body = screen.getByTestId('issue-detail-body');
    expect(body).toBeInTheDocument();
    expect(body).toHaveAttribute('data-issue-key', 'PROJ-42');
  });

  // PEEK-03: no element with role="dialog" (CSS panel, not Dialog)
  it('PEEK-03: does not render any element with role="dialog"', () => {
    renderPanel();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // PEEK-04: re-rendering with a different issueKey updates the header key label and IssueDetailView without crash.
  // The query is mocked to loading state (data: undefined), so only the key badge shows (no icon/title).
  it('PEEK-04: swapping issueKey prop updates content without unmount flash', () => {
    const { rerender } = render(<PeekPanel {...defaultProps} issueKey="PROJ-1" />);
    expect(screen.getByText('PROJ-1')).toBeInTheDocument();
    expect(screen.getByTestId('issue-detail-body')).toBeInTheDocument();

    rerender(<PeekPanel {...defaultProps} issueKey="PROJ-2" />);
    // Header shows new key; body stays mounted (same element, no unmount flash)
    expect(screen.getByText('PROJ-2')).toBeInTheDocument();
    expect(screen.getByTestId('issue-detail-body')).toBeInTheDocument();
    expect(screen.getByTestId('issue-detail-body')).toHaveAttribute('data-issue-key', 'PROJ-2');
  });

  // PEEK-06: "Open full page" button calls onNavigateFull with the issue key
  it('PEEK-06: "Open full page" button calls onNavigateFull with the issueKey', async () => {
    const onNavigateFull = vi.fn();
    renderPanel({ issueKey: 'PROJ-7', onNavigateFull });
    const btn = screen.getByRole('button', { name: /open full page/i });
    btn.click();
    expect(onNavigateFull).toHaveBeenCalledOnce();
    expect(onNavigateFull).toHaveBeenCalledWith('PROJ-7');
  });

  // PEEK-07a: Escape keydown calls onClose (when paletteOpen=false)
  it('PEEK-07: Escape keydown calls onClose', () => {
    const onClose = vi.fn();
    renderPanel({ onClose, paletteOpen: false });
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  // PEEK-07b: clicking the "Close preview" X button calls onClose
  it('PEEK-07: "Close preview" X button calls onClose', () => {
    const onClose = vi.fn();
    renderPanel({ onClose });
    const closeBtn = screen.getByRole('button', { name: /close preview/i });
    closeBtn.click();
    expect(onClose).toHaveBeenCalledOnce();
  });

  // Escape should NOT fire when paletteOpen=true (Pitfall 6)
  it('Escape does not call onClose while command palette is open (Pitfall 6)', () => {
    const onClose = vi.fn();
    renderPanel({ onClose, paletteOpen: true });
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
