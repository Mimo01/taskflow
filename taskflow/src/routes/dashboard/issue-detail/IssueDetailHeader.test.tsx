vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn((sel?: (s: unknown) => unknown) => {
    const state = { jiraBaseUrl: 'https://jira.example.com', jiraConnected: true };
    return sel ? sel(state) : state;
  }),
}));

vi.mock('./LogWorkPopover', () => ({
  LogWorkPopover: ({
    triggerLabel,
    hideTrigger,
    open,
  }: {
    triggerLabel?: string;
    hideTrigger?: boolean;
    open?: boolean;
  }) => (
    <>
      {!hideTrigger && <button type="button">{triggerLabel}</button>}
      {open && <div data-testid="log-work-form" />}
    </>
  ),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
      'Clone issue',
      null, // Log work trigger (named by its label text)
      'More actions',
      'Open in Jira', // primary accent pair after the toolbar
      'Copy Jira link',
    ]);
    // Secondary actions only show inline at 860px+; the ⋯ trigger only below it.
    for (const name of ['Refresh issue', 'Pin issue PROJ-10', 'Clone issue']) {
      expect(screen.getByRole('button', { name })).toHaveClass('hidden', '@[860px]:inline-flex');
    }
    expect(screen.getByRole('button', { name: 'More actions' })).toHaveClass('@[860px]:hidden');
    // Edit collapses to an icon below 860px but keeps its label for AT.
    expect(screen.getByText('Edit').className).toContain('@[860px]:not-sr-only');
    // Open in Jira is never icon-only: its label is always visible.
    expect(screen.getByRole('button', { name: 'Open in Jira' })).toHaveTextContent('Open in Jira');
    expect(screen.getByText('Open in Jira').className).not.toContain('sr-only');
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

  it('always shows the key and the title (2-line clamp, full summary as tooltip)', () => {
    render(<IssueDetailHeader {...base} />, { wrapper });
    expect(screen.getByText('PROJ-10')).toBeTruthy();
    const h = screen.getByRole('heading', { level: 2, name: 'A subtask issue title' });
    expect(h).toHaveClass('line-clamp-2');
    expect(h).toHaveAttribute('title', 'A subtask issue title');
  });

  it('compact keeps the same content in one slim row: title inline next to the key', () => {
    const { rerender } = render(<IssueDetailHeader {...base} />, { wrapper });
    const heading = () => screen.getByRole('heading', { level: 2, name: 'A subtask issue title' });
    expect(heading()).toHaveClass('line-clamp-2', 'text-xl');
    expect(heading().parentElement?.parentElement).toHaveClass('grid-rows-[1fr]');
    rerender(<IssueDetailHeader {...base} compact />);
    // Same single accessible heading; its row collapses while the inline copy (decorative) shows.
    expect(heading().parentElement?.parentElement).toHaveClass('grid-rows-[0fr]', 'opacity-0');
    const inline = screen
      .getAllByText('A subtask issue title')
      .find((el) => el.getAttribute('aria-hidden') === 'true');
    expect(inline).toHaveClass('truncate', 'opacity-100');
    expect(inline?.parentElement).toContainElement(screen.getByText('PROJ-10'));
    expect(screen.getByRole('toolbar', { name: 'Issue actions' })).toBeTruthy();
  });
  it('groups the tools (incl. Log work) in a toolbar; Open in Jira + Copy link is the accent outside it', () => {
    render(<IssueDetailHeader {...base} onEdit={vi.fn()} />, { wrapper });
    const toolbar = screen.getByRole('toolbar', { name: 'Issue actions' });
    expect(within(toolbar).getByRole('button', { name: 'Edit issue' })).toBeTruthy();
    expect(within(toolbar).getByRole('button', { name: 'Log work' })).toBeTruthy();
    expect(within(toolbar).queryByRole('button', { name: 'Open in Jira' })).toBeNull();
    expect(within(toolbar).queryByRole('button', { name: 'Copy Jira link' })).toBeNull();
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

  it("shows the parent's title next to its key; both open the parent", async () => {
    const onOpenIssue = vi.fn();
    render(
      <IssueDetailHeader
        {...base}
        parent={{ key: 'PROJ-0', summary: 'Parent story title', typeName: 'Story' }}
        onOpenIssue={onOpenIssue}
      />,
      { wrapper },
    );
    // One link: icon + key + title share a single button (one tab stop, one hover).
    const link = screen.getByRole('button', { name: 'Open parent issue PROJ-0' });
    const title = screen.getByText('Parent story title');
    expect(link).toContainElement(title);
    expect(link).toContainElement(screen.getByText('PROJ-0'));
    expect(title).toHaveClass('truncate');
    await userEvent.click(title);
    expect(onOpenIssue).toHaveBeenCalledWith('PROJ-0');
  });

  it('the title tucks right under the key row (no extra gap) and the row stays clickable', () => {
    render(<IssueDetailHeader {...base} />, { wrapper });
    const h = screen.getByRole('heading', { level: 2, name: 'A subtask issue title' });
    expect(h.parentElement?.parentElement).toHaveClass('-mt-1');
    const row = screen.getByRole('toolbar', { name: 'Issue actions' }).parentElement?.parentElement;
    expect(row).toHaveClass('relative', 'z-10', 'h-7');
  });

  describe('nav trail (full page)', () => {
    const trail = [
      { path: '/backlog', label: 'Backlog' },
      { path: '/issue/PROJ-1', label: 'PROJ-1' },
    ];

    it('renders Go back and the trail before the key; entries navigate by index', async () => {
      const onBack = vi.fn();
      const onNavigate = vi.fn();
      render(<IssueDetailHeader {...base} nav={{ trail, onBack, onNavigate }} />, { wrapper });
      const back = screen.getByRole('button', { name: 'Go back' });
      expect(
        back.compareDocumentPosition(screen.getByText('PROJ-10')) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      await userEvent.click(back);
      expect(onBack).toHaveBeenCalledTimes(1);
      await userEvent.click(screen.getByRole('button', { name: 'PROJ-1' }));
      expect(onNavigate).toHaveBeenCalledWith(1);
    });

    it('collapses a longer trail into an "earlier pages" menu below 1200px', async () => {
      const onNavigate = vi.fn();
      render(<IssueDetailHeader {...base} nav={{ trail, onBack: vi.fn(), onNavigate }} />, {
        wrapper,
      });
      const more = screen.getByRole('button', { name: 'Show earlier pages' });
      expect(more.parentElement).toHaveClass('@[1200px]:hidden');
      await userEvent.click(more);
      await userEvent.click(await screen.findByRole('menuitem', { name: 'Backlog' }));
      expect(onNavigate).toHaveBeenCalledWith(0);
    });

    it('shows a trail ending at the parent once, as the parent crumb (walks the trail back)', async () => {
      const onNavigate = vi.fn();
      const onOpenIssue = vi.fn();
      render(
        <IssueDetailHeader
          {...base}
          parent={{ key: 'PROJ-1', summary: 'Parent', typeName: 'Story' }}
          onOpenIssue={onOpenIssue}
          nav={{ trail, onBack: vi.fn(), onNavigate }}
        />,
        { wrapper },
      );
      expect(screen.queryByRole('button', { name: 'PROJ-1' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Show earlier pages' })).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: 'Open parent issue PROJ-1' }));
      expect(onNavigate).toHaveBeenCalledWith(1);
      expect(onOpenIssue).not.toHaveBeenCalled();
    });

    it('has no Go back without a nav', () => {
      render(<IssueDetailHeader {...base} />, { wrapper });
      expect(screen.queryByRole('button', { name: 'Go back' })).toBeNull();
    });
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

describe('IssueDetailHeader — smallest width (only ⋯ + Close)', () => {
  // jsdom has no ResizeObserver: stub one that reports a given content width.
  function stubWidth(width: number) {
    class RO {
      constructor(private cb: ResizeObserverCallback) {}
      observe() {
        this.cb([{ contentRect: { width } } as ResizeObserverEntry], this as never);
      }
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal('ResizeObserver', RO);
  }
  afterEach(() => vi.unstubAllGlobals());

  it('wide: Open full page is a labelled button and the actions stay inline', () => {
    stubWidth(900);
    render(
      <IssueDetailHeader {...base} layout="peek" onEdit={vi.fn()} onOpenFullPage={vi.fn()} />,
      {
        wrapper,
      },
    );
    expect(screen.getByRole('button', { name: 'Open full page' })).toHaveTextContent(
      'Open full page',
    );
    expect(screen.getByRole('button', { name: 'Edit issue' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log work' })).toBeTruthy();
  });

  it('tiny: only ⋯, Open full page and Close remain; the menu holds the issue actions', async () => {
    stubWidth(400);
    const onEdit = vi.fn();
    const onOpenFullPage = vi.fn();
    render(
      <IssueDetailHeader
        {...base}
        layout="peek"
        onEdit={onEdit}
        onOpenFullPage={onOpenFullPage}
        headerTrailing={<button type="button">Close preview</button>}
      />,
      { wrapper },
    );
    // Open full page is never moved into ⋯.
    expect(screen.getByRole('button', { name: 'Open full page' })).toHaveTextContent(
      'Open full page',
    );
    expect(screen.queryByRole('button', { name: 'Edit issue' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Log work' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open in Jira' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy Jira link' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Close preview' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    for (const name of [/Open in Jira/, /Copy Jira link/, /Edit/, /Log work/]) {
      expect(await screen.findByRole('menuitem', { name })).toBeTruthy();
    }
    expect(screen.queryByRole('menuitem', { name: /Open full page/ })).toBeNull();
    fireEvent.click(await screen.findByRole('menuitem', { name: /Log work/ }));
    expect(screen.getByTestId('log-work-form')).toBeTruthy();
  });

  it('tiny while loading: Open full page stays a button (no menu without an issue)', () => {
    stubWidth(400);
    render(
      <IssueDetailHeader {...base} issue={undefined} layout="peek" onOpenFullPage={vi.fn()} />,
      { wrapper },
    );
    expect(screen.getByRole('button', { name: 'Open full page' })).toBeTruthy();
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
