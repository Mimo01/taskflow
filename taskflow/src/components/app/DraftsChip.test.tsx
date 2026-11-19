import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { removeDraftFiles } from '@/lib/issue-draft-files';
import { useCreateModalStore } from '@/stores/create-modal.store';
import { type IssueDraft, useIssueDraftsStore } from '@/stores/issue-drafts.store';
import { DraftsChip } from './DraftsChip';

vi.mock('@/lib/issue-draft-files', () => ({
  removeDraftFiles: vi.fn(async () => {}),
}));

const NOW = new Date('2026-11-18T12:00:00Z').getTime();

function issueDraft(id: string, updatedAt: number, over: Record<string, unknown> = {}): IssueDraft {
  return {
    id,
    kind: 'issue',
    updatedAt,
    projectKey: 'PROJ',
    files: [],
    snapshot: {
      selectedIssueType: 'Story',
      summary: `Summary ${id}`,
      description: '',
      selectedAssignee: null,
      selectedAssigneeName: null,
      timeEstimate: '',
      priority: null,
      storyPoints: '',
      epicLinkKey: null,
      parentKey: null,
      labels: [],
      fixVersions: [],
      customFieldValues: {},
      customFieldInputValues: {},
      customFieldNames: {},
      linkRows: [],
      ...over,
    },
  } as IssueDraft;
}

function epicDraft(id: string, updatedAt: number): IssueDraft {
  return {
    id,
    kind: 'epic',
    updatedAt,
    projectKey: 'PROJ',
    files: [],
    snapshot: { epicName: 'My epic', description: '' },
  };
}

function seed(...drafts: IssueDraft[]) {
  act(() => {
    useIssueDraftsStore.setState({
      drafts: Object.fromEntries(drafts.map((d) => [d.id, d])),
      owner: null,
      saveFailed: false,
    });
  });
}

function openPopover() {
  fireEvent.click(screen.getByRole('button', { name: /^Drafts, \d+$/ }));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  useCreateModalStore.setState({ resumeDraft: vi.fn() });
  seed();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DraftsChip', () => {
  it('caps the neutral corner badge at 99+', () => {
    seed(...Array.from({ length: 100 }, (_, n) => issueDraft(`d${n}`, NOW - n)));
    render(<DraftsChip />);
    const trigger = screen.getByRole('button', { name: 'Drafts, 100' });
    expect(trigger.textContent).toContain('99+');
    const badge = Array.from(trigger.querySelectorAll('span')).find(
      (el) => el.textContent === '99+',
    );
    expect(badge).toBeDefined();
    expect(badge?.className).not.toMatch(/red/);
  });

  it('is a ghost button at rest and pressed when open', () => {
    seed(issueDraft('a', NOW));
    render(<DraftsChip />);
    const trigger = screen.getByRole('button', { name: 'Drafts, 1' });
    expect(trigger.classList.contains('border')).toBe(false);
    expect(trigger.classList.contains('rounded-full')).toBe(false);
    expect(trigger.classList.contains('bg-muted')).toBe(false);
    fireEvent.click(trigger);
    expect(trigger.getAttribute('data-active')).toBe('true');
    expect(trigger.classList.contains('bg-muted')).toBe(true);
  });

  it('renders nothing with 0 drafts', () => {
    const { container } = render(<DraftsChip />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing before hydration', () => {
    seed(issueDraft('a', NOW));
    const spy = vi.spyOn(useIssueDraftsStore.persist, 'hasHydrated').mockReturnValue(false);
    const { container } = render(<DraftsChip />);
    expect(container).toBeEmptyDOMElement();
    spy.mockRestore();
  });

  it('shows "Drafts, 2" with the count', () => {
    seed(issueDraft('a', NOW), issueDraft('b', NOW - 1000));
    render(<DraftsChip />);
    const btn = screen.getByRole('button', { name: 'Drafts, 2' });
    expect(btn).toHaveTextContent('Drafts');
    expect(btn).toHaveTextContent('2');
  });

  it('lists rows newest first with Untitled, keys, epic icon and relative time', () => {
    seed(
      issueDraft('old', NOW - 5 * 60_000, { summary: '' }),
      issueDraft('new', NOW, { selectedIssueType: 'Subtask', parentKey: 'PROJ-9' }),
      issueDraft('story', NOW - 1000, { epicLinkKey: 'PROJ-1' }),
      epicDraft('epic', NOW - 2000),
    );
    render(<DraftsChip />);
    openPopover();
    const rows = screen.getAllByRole('option');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent('Summary new');
    expect(rows[0]).toHaveTextContent('PROJ-9');
    expect(rows[1]).toHaveTextContent('PROJ-1');
    expect(rows[2]).toHaveTextContent('My epic');
    expect(rows[3]).toHaveTextContent('Untitled');
    expect(rows[3]).toHaveTextContent('edited 5m ago');
    expect(screen.getByText('Untitled').className).toContain('italic');
  });

  it('clicking a row closes the popover and resumes the draft', () => {
    seed(issueDraft('a', NOW));
    render(<DraftsChip />);
    openPopover();
    fireEvent.click(screen.getByText('Summary a'));
    expect(useCreateModalStore.getState().resumeDraft).toHaveBeenCalledWith('a');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('discard then Undo restores the draft and never deletes files', () => {
    seed(issueDraft('a', NOW), issueDraft('b', NOW - 1000));
    render(<DraftsChip />);
    openPopover();
    fireEvent.click(screen.getAllByLabelText('Discard draft')[0]);
    expect(useIssueDraftsStore.getState().drafts.a).toBeUndefined();
    expect(screen.getByText(/Draft discarded/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Undo'));
    expect(useIssueDraftsStore.getState().drafts.a).toBeDefined();
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(removeDraftFiles).not.toHaveBeenCalled();
    expect(screen.queryByText(/Draft discarded/)).not.toBeInTheDocument();
  });

  it('commits the discard after 5s', () => {
    seed(issueDraft('a', NOW), issueDraft('b', NOW - 1000));
    render(<DraftsChip />);
    openPopover();
    fireEvent.click(screen.getAllByLabelText('Discard draft')[0]);
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(removeDraftFiles).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(removeDraftFiles).toHaveBeenCalledWith('a');
    expect(screen.queryByText(/Draft discarded/)).not.toBeInTheDocument();
  });

  it('closing the popover commits pending discards immediately', () => {
    seed(issueDraft('a', NOW), issueDraft('b', NOW - 1000));
    render(<DraftsChip />);
    openPopover();
    fireEvent.click(screen.getAllByLabelText('Discard draft')[0]);
    expect(removeDraftFiles).not.toHaveBeenCalled();
    openPopover();
    expect(removeDraftFiles).toHaveBeenCalledWith('a');
  });

  it('unmounting commits pending discards', () => {
    seed(issueDraft('a', NOW), issueDraft('b', NOW - 1000));
    const { unmount } = render(<DraftsChip />);
    openPopover();
    fireEvent.click(screen.getAllByLabelText('Discard draft')[0]);
    unmount();
    expect(removeDraftFiles).toHaveBeenCalledWith('a');
  });

  it('ArrowDown moves the active row and Enter resumes it', () => {
    seed(issueDraft('a', NOW), issueDraft('b', NOW - 1000));
    render(<DraftsChip />);
    openPopover();
    const popup = screen.getByRole('listbox').parentElement as HTMLElement;
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(popup, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(popup, { key: 'ArrowUp' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(popup, { key: 'ArrowDown' });
    fireEvent.keyDown(popup, { key: 'Enter' });
    expect(useCreateModalStore.getState().resumeDraft).toHaveBeenCalledWith('b');
  });
});
