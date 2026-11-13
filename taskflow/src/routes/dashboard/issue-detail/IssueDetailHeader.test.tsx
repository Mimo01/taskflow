vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn((sel?: (s: unknown) => unknown) => {
    const state = { jiraBaseUrl: 'https://jira.example.com', jiraConnected: true };
    return sel ? sel(state) : state;
  }),
}));

vi.mock('./LogWorkPopover', () => ({
  LogWorkPopover: ({ triggerLabel }: { triggerLabel?: string }) => (
    <button type="button">{triggerLabel}</button>
  ),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { IssueDetailHeader, type IssueDetailHeaderProps } from './IssueDetailHeader';
import { IssueTitleBlock } from './IssueTitleBlock';

const issue = {
  id: '1',
  key: 'PROJ-10',
  fields: {
    summary: 'A subtask issue title',
    description: 'd',
    issuetype: { name: 'Sub-task', subtask: true },
    assignee: null,
    priority: null,
    attachment: [],
    issuelinks: [],
  },
} as never;

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const base: IssueDetailHeaderProps = {
  issueKey: 'PROJ-10',
  issue,
  jiraBaseUrl: 'https://jira.example.com',
  layout: 'page',
  compact: false,
  storyPointsFieldKey: 'story_points',
  epicLinkFieldKey: 'epic_link',
};

describe('IssueDetailHeader', () => {
  it('Refresh renders before Pin and calls onRefresh', async () => {
    const onRefresh = vi.fn();
    render(<IssueDetailHeader {...base} onRefresh={onRefresh} onTogglePin={vi.fn()} />, {
      wrapper,
    });
    const btn = screen.getByRole('button', { name: 'Refresh issue' });
    const pin = screen.getByRole('button', { name: /Pin issue PROJ-10/ });
    expect(btn.compareDocumentPosition(pin) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await userEvent.click(btn);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('Refresh spins and disables while refreshing', () => {
    render(<IssueDetailHeader {...base} onRefresh={vi.fn()} refreshing />, { wrapper });
    const btn = screen.getByRole('button', { name: 'Refresh issue' });
    expect(btn).toBeDisabled();
    expect(btn.querySelector('svg')).toHaveClass('animate-spin');
  });

  it('Refresh is absent without onRefresh', () => {
    render(<IssueDetailHeader {...base} />, { wrapper });
    expect(screen.queryByRole('button', { name: 'Refresh issue' })).toBeNull();
  });

  it('Pin labels reflect state and toggle calls onTogglePin', async () => {
    const onTogglePin = vi.fn();
    const { rerender } = render(<IssueDetailHeader {...base} onTogglePin={onTogglePin} />, {
      wrapper,
    });
    const pin = screen.getByRole('button', { name: 'Pin issue PROJ-10' });
    expect(pin).toHaveAttribute('title', 'Pin to tabs');
    await userEvent.click(pin);
    expect(onTogglePin).toHaveBeenCalledWith('PROJ-10');
    rerender(<IssueDetailHeader {...base} isPinned onTogglePin={onTogglePin} />);
    const unpin = screen.getByRole('button', { name: 'Unpin issue PROJ-10' });
    expect(unpin).toHaveAttribute('title', 'Unpin from tabs');
  });

  it('Edit calls onEdit with the built initial values', async () => {
    const onEdit = vi.fn();
    render(<IssueDetailHeader {...base} onEdit={onEdit} />, { wrapper });
    await userEvent.click(screen.getByRole('button', { name: 'Edit issue' }));
    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({ issueKey: 'PROJ-10', summary: 'A subtask issue title' }),
    );
  });

  it('lists every action inline (secondary ones also in a narrow-only ⋯ menu), Copy link joined to Open in Jira', () => {
    render(<IssueDetailHeader {...base} onRefresh={vi.fn()} onEdit={vi.fn()} onClone={vi.fn()} />, {
      wrapper,
    });
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual([
      'Refresh issue',
      'Pin issue PROJ-10',
      'Edit issue',
      null, // Log work trigger (named by its label text)
      'Clone issue',
      'Open in Jira',
      'Copy Jira link',
      'More actions',
    ]);
    // Secondary actions only show inline at 860px+; the ⋯ trigger only below it.
    for (const name of ['Refresh issue', 'Pin issue PROJ-10', 'Clone issue']) {
      expect(screen.getByRole('button', { name })).toHaveClass('hidden', '@[860px]:inline-flex');
    }
    expect(screen.getByRole('button', { name: 'More actions' })).toHaveClass('@[860px]:hidden');
    // Primary actions collapse to icons below 860px but keep their label.
    for (const label of ['Edit', 'Open in Jira']) {
      expect(screen.getByText(label).className).toContain('@[860px]:not-sr-only');
    }
  });

  it('narrow ⋯ menu offers Refresh, Pin and Clone', async () => {
    const onRefresh = vi.fn();
    const onTogglePin = vi.fn();
    const onClone = vi.fn();
    render(
      <IssueDetailHeader
        {...base}
        onRefresh={onRefresh}
        onTogglePin={onTogglePin}
        onClone={onClone}
      />,
      { wrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Refresh/ }));
    expect(onRefresh).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Pin to tabs/ }));
    expect(onTogglePin).toHaveBeenCalledWith('PROJ-10');
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Clone/ }));
    expect(onClone).toHaveBeenCalledWith(
      expect.objectContaining({ issueKey: '', summary: 'Clone - A subtask issue title' }),
    );
  });

  it('always shows the type icon + key; the title joins it only once compact', () => {
    const { rerender } = render(<IssueDetailHeader {...base} compact={false} />, { wrapper });
    expect(screen.getByText('PROJ-10')).toBeTruthy();
    expect(screen.queryByText('A subtask issue title')).toBeNull();
    rerender(<IssueDetailHeader {...base} compact />);
    expect(screen.getByText('PROJ-10')).toBeTruthy();
  });

  it('Clone calls onClone with the built clone values', async () => {
    const onClone = vi.fn();
    render(<IssueDetailHeader {...base} onClone={onClone} />, { wrapper });
    await userEvent.click(screen.getByRole('button', { name: 'Clone issue' }));
    expect(onClone).toHaveBeenCalledWith(
      expect.objectContaining({ issueKey: '', summary: 'Clone - A subtask issue title' }),
    );
  });

  it('shows the labelled Log work and Open in Jira actions', () => {
    render(<IssueDetailHeader {...base} />, { wrapper });
    expect(screen.getByRole('button', { name: 'Log work' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open in Jira' })).toBeTruthy();
  });

  it('ISSUE-09: Open in Jira calls openUrl with {jiraBaseUrl}/browse/{issueKey}', async () => {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    render(<IssueDetailHeader {...base} />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: 'Open in Jira' }));
    await waitFor(() => {
      expect(openUrl).toHaveBeenCalledWith('https://jira.example.com/browse/PROJ-10');
    });
  });

  it('renders headerTrailing', () => {
    render(
      <IssueDetailHeader {...base} headerTrailing={<button type="button">Close preview</button>} />,
      {
        wrapper,
      },
    );
    expect(screen.getByRole('button', { name: 'Close preview' })).toBeTruthy();
  });

  it('only mounts the compact title when compact, with the full summary as tooltip', () => {
    const { rerender } = render(<IssueDetailHeader {...base} compact={false} />, { wrapper });
    expect(screen.queryByText('A subtask issue title')).toBeNull();
    rerender(<IssueDetailHeader {...base} compact />);
    expect(screen.getByText('A subtask issue title')).toHaveAttribute(
      'title',
      'A subtask issue title',
    );
  });

  it('peek shows the parent link and calls onOpenIssue', async () => {
    const onOpenIssue = vi.fn();
    render(
      <IssueDetailHeader
        {...base}
        layout="peek"
        parent={{ key: 'PROJ-0', summary: 'Parent story', typeName: 'Story' }}
        onOpenIssue={onOpenIssue}
      />,
      { wrapper },
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open parent issue PROJ-0' }));
    expect(onOpenIssue).toHaveBeenCalledWith('PROJ-0');
  });

  it('without an issue shows only the key and headerTrailing (no issue actions)', () => {
    render(
      <IssueDetailHeader
        {...base}
        issue={undefined}
        onRefresh={vi.fn()}
        headerTrailing={<button type="button">Close preview</button>}
      />,
      { wrapper },
    );
    expect(screen.getByText('PROJ-10')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close preview' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Refresh issue' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy Jira link' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull();
  });
});

describe('IssueTitleBlock', () => {
  it('uses text-xl for peek and text-2xl for page', () => {
    const { unmount } = render(<IssueTitleBlock summary="Title" size="peek" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Title' })).toHaveClass('text-xl');
    unmount();
    render(<IssueTitleBlock summary="Title" size="page" />);
    const h = screen.getByRole('heading', { level: 2, name: 'Title' });
    expect(h).toHaveClass('text-2xl');
    expect(h).not.toHaveClass('text-xl');
    expect(screen.queryByText('PROJ-10')).toBeNull(); // key lives in the sticky header
  });

  it('shows the key only when passed (header-less hosts)', () => {
    render(<IssueTitleBlock issueKey="PROJ-10" summary="Title" size="page" />);
    expect(screen.getByText('PROJ-10')).toBeTruthy();
  });
});
