// Tests for NotificationPopover — header, filters, flat list, triage, navigation, states

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openExternal } from '../../lib/openExternal';
import { useComposerFocus } from '../../stores/composer-focus.store';
import { useNotificationsStore } from '../../stores/notifications.store';
import NotificationPopover from './NotificationPopover';

vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));

// Render-time person-avatar lookup needs a QueryClient + PAT; return the captured URL only.
vi.mock('./usePersonAvatar', () => ({
  usePersonAvatar: (_n: string, _s: string, _k: string | null, captured?: string) =>
    captured ?? null,
}));
vi.mock('../../lib/openExternal', () => ({ openExternal: vi.fn() }));

// LinkContextMenu (wrapping NotificationRow's open-in-browser icon) calls
// useDetectedBrowsers, which needs a QueryClient. Stub it directly.
vi.mock('@/lib/useDetectedBrowsers', () => ({
  useDetectedBrowsers: () => [],
}));

const base = {
  author: 'Jane',
  bodyPreview: 'body',
  fullBody: 'body',
  createdAt: new Date().toISOString(),
};
const jiraItem = (id: string, key = 'PROJ-1', extra = {}) => ({
  ...base,
  id,
  source: 'jira' as const,
  entityTitle: `${key}: Title ${key}`,
  ...extra,
});
const glItem = (id: string, extra = {}) => ({
  ...base,
  id,
  source: 'gitlab' as const,
  entityTitle: 'Fix MR thing',
  mrProjectId: 12,
  mrIid: 34,
  ...extra,
});
const entryCount = () => document.querySelectorAll('[data-entry-primary]').length;
/** Pick a source in the "All sources" dropdown. */
async function pickSource(name: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: 'Filter by source' }));
  fireEvent.click(await screen.findByRole('menuitemradio', { name }));
}
const seed = (items: unknown[], readIds: string[] = []) =>
  act(() => {
    useNotificationsStore.setState({ items: items as never, readIds });
  });

describe('NotificationPopover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    act(() => {
      useNotificationsStore.setState({
        items: [],
        readIds: [],
        dismissedIds: [],
        lastSeenCursor: null,
        permissionDenied: false,
        notificationSendError: false,
        fetchError: null,
        retryFetch: null,
      });
    });
  });

  it('is a chrome-less flex column whose header floats (no background) and the list can scroll', () => {
    act(() => {
      useNotificationsStore.setState({ items: [jiraItem('a')] });
    });
    const { container } = render(<NotificationPopover />);
    const root = container.firstElementChild as HTMLElement;
    for (const c of ['flex', 'min-h-0', 'flex-1', 'flex-col']) {
      expect(root.classList.contains(c)).toBe(true);
    }
    const header = root.firstElementChild as HTMLElement;
    expect(header.className).toContain('flex-none');
    expect(header.className).toContain('notif-hd-in');
    expect(header.className).not.toMatch(/(^|\s)bg-/);
  });

  it('renders Alert containing "System notifications are blocked" when permissionDenied', () => {
    act(() => {
      useNotificationsStore.setState({ permissionDenied: true });
    });
    render(<NotificationPopover />);
    expect(
      screen.getByText('System notifications are blocked — enable them in System Settings.'),
    ).toBeInTheDocument();
  });

  it('does not render permission-denied alert when permissionDenied is false', () => {
    render(<NotificationPopover />);
    expect(screen.queryByText(/System notifications are blocked/i)).not.toBeInTheDocument();
  });

  it('Jira row click marks read, navigates full-page and closes', () => {
    seed([jiraItem('jira-1', 'PROJ-42', { entityTitle: 'PROJ-42: Fix login bug' })]);
    const onIssueClick = vi.fn();
    const onClose = vi.fn();
    render(<NotificationPopover onIssueClick={onIssueClick} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Fix login bug/ }));
    expect(onIssueClick).toHaveBeenCalledWith('PROJ-42');
    expect(useNotificationsStore.getState().readIds).toContain('jira-1');
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking a read row keeps it read', () => {
    seed([jiraItem('jira-1', 'PROJ-42', { entityTitle: 'PROJ-42: Fix login bug' })], ['jira-1']);
    render(<NotificationPopover />);
    fireEvent.click(screen.getByRole('button', { name: /Fix login bug/ }));
    expect(useNotificationsStore.getState().readIds).toContain('jira-1');
  });

  it('GitLab row click calls onMRClick with projectId/iid and closes', () => {
    seed([glItem('g1')]);
    const onMRClick = vi.fn();
    const onClose = vi.fn();
    render(<NotificationPopover onMRClick={onMRClick} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Fix MR thing/ }));
    expect(onMRClick).toHaveBeenCalledWith('12/34');
    expect(onClose).toHaveBeenCalled();
    expect(useNotificationsStore.getState().readIds).toContain('g1');
  });

  it('item with no target is marked read and the popover stays open', () => {
    seed([glItem('g1', { mrProjectId: undefined, mrIid: undefined })]);
    const onClose = vi.fn();
    render(<NotificationPopover onClose={onClose} onMRClick={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Fix MR thing/ }));
    expect(useNotificationsStore.getState().readIds).toContain('g1');
    expect(onClose).not.toHaveBeenCalled();
  });

  describe('stacks', () => {
    beforeEach(() => seed([jiraItem('a'), jiraItem('b')]));

    it('collapses 2+ notifications on one issue into one stack with +N and peek edges', () => {
      render(<NotificationPopover />);
      expect(entryCount()).toBe(1);
      expect(document.querySelector('[data-stack]')).not.toBeNull();
      expect(document.querySelectorAll('[data-stack-edge]')).toHaveLength(2);
      expect(document.querySelector('[data-stack-more]')?.textContent).toBe('+1');
      expect(document.querySelector('[data-stack-header]')).toBeNull();
    });

    it('clicking the stack expands it in place (header + every card); Show less collapses', () => {
      const onIssueClick = vi.fn();
      render(<NotificationPopover onIssueClick={onIssueClick} />);
      fireEvent.click(screen.getByRole('button', { name: /expand/ }));
      expect(onIssueClick).not.toHaveBeenCalled();
      expect(document.querySelector('[data-stack-header]')).not.toBeNull();
      expect(entryCount()).toBe(2);
      fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
      expect(document.querySelector('[data-stack-header]')).toBeNull();
      expect(entryCount()).toBe(1);
    });

    it('opening one expanded card marks only that notification read', () => {
      const onIssueClick = vi.fn();
      render(<NotificationPopover onIssueClick={onIssueClick} />);
      fireEvent.click(screen.getByRole('button', { name: /expand/ }));
      fireEvent.click(screen.getAllByRole('button', { name: /^Unread\. .* on PROJ-1/ })[0]);
      expect(useNotificationsStore.getState().readIds).toHaveLength(1);
      expect(onIssueClick).toHaveBeenCalledWith('PROJ-1');
    });

    it('Clear in the stack header removes and tombstones every card', () => {
      seed([jiraItem('a'), jiraItem('b'), jiraItem('z', 'PROJ-9')]);
      render(<NotificationPopover />);
      fireEvent.click(screen.getByRole('button', { name: /expand/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
      const st = useNotificationsStore.getState();
      expect(st.items.map((i) => i.id)).toEqual(['z']);
      expect(st.dismissedIds).toEqual(expect.arrayContaining(['a', 'b']));
      expect(document.querySelector('[data-stack-header]')).toBeNull();
    });

    it('the corner X on a collapsed stack clears the whole stack, including duplicate comment copies', () => {
      seed([
        jiraItem('jira-comment-1', 'PROJ-1', { author: 'Ana Lee' }),
        jiraItem('jira-allcomment-1', 'PROJ-1', { author: 'Ana Lee' }),
        jiraItem('jira-comment-2', 'PROJ-1', { author: 'Ben Ito' }),
      ]);
      render(<NotificationPopover />);
      // WR-02: the stack X is labelled with the number of cards it clears.
      fireEvent.click(screen.getByRole('button', { name: /^Clear \d+ notifications$/ }));
      const st = useNotificationsStore.getState();
      expect(st.items).toHaveLength(0);
      expect(st.dismissedIds).toEqual(
        expect.arrayContaining(['jira-comment-1', 'jira-allcomment-1', 'jira-comment-2']),
      );
    });

    it('the read toggle on a collapsed stack acts on every card', () => {
      render(<NotificationPopover />);
      fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
      expect(useNotificationsStore.getState().readIds).toEqual(expect.arrayContaining(['a', 'b']));
    });

    it('expanded state is forgotten when the stack disappears', () => {
      render(<NotificationPopover />);
      fireEvent.click(screen.getByRole('button', { name: /expand/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
      seed([jiraItem('c'), jiraItem('d')]);
      expect(document.querySelector('[data-stack-header]')).toBeNull();
      expect(entryCount()).toBe(1);
    });

    it('Mark all read still marks every unread notification', () => {
      render(<NotificationPopover />);
      fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
      expect(useNotificationsStore.getState().readIds).toEqual(expect.arrayContaining(['a', 'b']));
    });

    it('the bell/unread count still counts cards, not stacks', () => {
      render(<NotificationPopover />);
      fireEvent.click(screen.getByRole('button', { name: 'Filter by source' }));
      return screen.findByRole('menuitemradio', { name: /All sources/ }).then((el) => {
        expect(el.textContent).toContain('2');
      });
    });
  });

  describe('quick actions', () => {
    it('Jira Reply sets the composer focus flag, marks read, opens the issue and closes', () => {
      useComposerFocus.setState({ composerFocus: null });
      seed([jiraItem('a', 'PROJ-7', { notificationType: 'jira-comment' })]);
      const onIssueClick = vi.fn();
      const onClose = vi.fn();
      render(<NotificationPopover onIssueClick={onIssueClick} onClose={onClose} />);
      fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
      expect(useComposerFocus.getState().composerFocus).toBe('PROJ-7');
      expect(onIssueClick).toHaveBeenCalledWith('PROJ-7');
      expect(onClose).toHaveBeenCalled();
      expect(useNotificationsStore.getState().readIds).toContain('a');
    });

    it('GitLab Reply on a note opens the safe URL externally', () => {
      seed([
        glItem('g1', {
          notificationType: 'mr-note',
          url: 'https://gitlab.example.com/web/-/merge_requests/34#note_9',
        }),
      ]);
      render(<NotificationPopover />);
      fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
      expect(openExternal).toHaveBeenCalledWith(
        'https://gitlab.example.com/web/-/merge_requests/34#note_9',
      );
    });

    it('an unsafe URL offers no GitLab Reply and never reaches openExternal', () => {
      seed([glItem('g1', { notificationType: 'mr-note', url: 'javascript:alert(1)' })]);
      render(<NotificationPopover />);
      expect(screen.queryByRole('button', { name: 'Reply' })).toBeNull();
      expect(openExternal).not.toHaveBeenCalled();
    });

    it('Review on a review-request system note opens the MR in-app', () => {
      seed([
        glItem('gitlab-system-1', {
          notificationType: 'mr-note',
          author: 'Ben Ito',
          bodyPreview: 'Review requested: cara',
          fullBody: 'Review requested: cara',
        }),
      ]);
      const onMRClick = vi.fn();
      const onClose = vi.fn();
      render(<NotificationPopover onMRClick={onMRClick} onClose={onClose} />);
      fireEvent.click(screen.getByRole('button', { name: 'Review' }));
      expect(onMRClick).toHaveBeenCalledWith('12/34');
      expect(onClose).toHaveBeenCalled();
      expect(useNotificationsStore.getState().readIds).toContain('gitlab-system-1');
    });

    it('View pipeline opens the safe pipeline URL externally', () => {
      seed([
        glItem('p1', {
          notificationType: 'pipeline-failure',
          author: '',
          bodyPreview: 'Pipeline #4821 failed on feature/x',
          url: 'https://gitlab.example.com/web/-/pipelines/4821',
        }),
      ]);
      render(<NotificationPopover />);
      fireEvent.click(screen.getByRole('button', { name: 'View pipeline' }));
      expect(openExternal).toHaveBeenCalledWith('https://gitlab.example.com/web/-/pipelines/4821');
    });
  });

  describe('shell', () => {
    it('is ONE header row: no filter band, no inverted pressed state', () => {
      seed([jiraItem('a')]);
      const { container } = render(<NotificationPopover />);
      expect(container.querySelector('.border-b')).toBeNull();
      expect(screen.getByRole('button', { name: 'Unread' }).className).not.toContain(
        'bg-foreground',
      );
      expect(screen.getByRole('button', { name: 'All' }).className).toContain('bg-background');
      const heading = screen.getByRole('heading', { name: 'Notifications' });
      const row = heading.parentElement as HTMLElement;
      for (const name of ['Unread', 'All', 'Filter by source', 'Mark all read', 'More actions']) {
        expect(row.contains(screen.getByRole('button', { name }))).toBe(true);
      }
    });
  });

  describe('merged cards', () => {
    const t = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
    const comment = (id: string, min: number, who = 'Ben Carter') =>
      jiraItem(id, 'PROJ-5', { author: who, notificationType: 'jira-comment', createdAt: t(min) });
    beforeEach(() =>
      seed([
        comment('m1', 30),
        comment('m2', 20),
        comment('m3', 10),
        jiraItem('z', 'PROJ-9', { createdAt: t(45) }),
      ]),
    );

    it('renders consecutive same-actor comments as one card', () => {
      render(<NotificationPopover />);
      expect(entryCount()).toBe(2);
      expect(screen.getByText('commented 3 times')).toBeInTheDocument();
    });

    it('does not merge a same-actor pair split by another actor (3 cards, stacked on one issue)', () => {
      seed([comment('a', 30), comment('x', 20, 'Cara Diaz'), comment('b', 10)]);
      render(<NotificationPopover />);
      expect(entryCount()).toBe(1);
      expect(document.querySelector('[data-stack-more]')?.textContent).toBe('+2');
      fireEvent.click(screen.getByRole('button', { name: /expand/ }));
      expect(entryCount()).toBe(3);
    });

    it('Mark as read / unread act on every merged id', () => {
      render(<NotificationPopover />);
      fireEvent.click(screen.getAllByRole('button', { name: 'Mark as read' })[0]);
      expect(useNotificationsStore.getState().readIds).toEqual(
        expect.arrayContaining(['m1', 'm2', 'm3']),
      );
      fireEvent.click(screen.getAllByRole('button', { name: 'Mark as unread' })[0]);
      expect(useNotificationsStore.getState().readIds).not.toContain('m1');
      expect(useNotificationsStore.getState().readIds).not.toContain('m3');
    });

    it('Done removes and tombstones every merged id', () => {
      render(<NotificationPopover />);
      fireEvent.click(screen.getAllByRole('button', { name: 'Clear notification' })[0]);
      const st = useNotificationsStore.getState();
      expect(st.items.map((i) => i.id)).toEqual(['z']);
      expect(st.dismissedIds).toEqual(expect.arrayContaining(['m1', 'm2', 'm3']));
    });

    it('opening marks all read and navigates', () => {
      const onIssueClick = vi.fn();
      render(<NotificationPopover onIssueClick={onIssueClick} />);
      fireEvent.click(screen.getByRole('button', { name: /commented 3 times on PROJ-5/ }));
      expect(onIssueClick).toHaveBeenCalledWith('PROJ-5');
      expect(useNotificationsStore.getState().readIds).toEqual(
        expect.arrayContaining(['m1', 'm2', 'm3']),
      );
    });

    it('keyboard u and e act on the whole merged card', () => {
      render(<NotificationPopover />);
      const first = document.querySelectorAll<HTMLElement>('[data-entry-primary]')[0];
      first.focus();
      fireEvent.keyDown(first, { key: 'u' });
      expect(useNotificationsStore.getState().readIds).toEqual(
        expect.arrayContaining(['m1', 'm2', 'm3']),
      );
      fireEvent.keyDown(first, { key: 'e' });
      expect(useNotificationsStore.getState().items.map((i) => i.id)).toEqual(['z']);
    });
  });

  it('row Done removes the item and read toggle flips state', () => {
    seed([jiraItem('a')]);
    render(<NotificationPopover />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
    expect(useNotificationsStore.getState().readIds).toContain('a');
    fireEvent.click(screen.getByRole('button', { name: 'Mark as unread' }));
    expect(useNotificationsStore.getState().readIds).not.toContain('a');
    fireEvent.click(screen.getByRole('button', { name: 'Clear notification' }));
    expect(useNotificationsStore.getState().dismissedIds).toContain('a');
    expect(useNotificationsStore.getState().items).toHaveLength(0);
  });

  it('hides Open in browser for unsafe urls and opens https ones', () => {
    seed([
      jiraItem('a', 'PROJ-1', { url: 'javascript:alert(1)' }),
      jiraItem('b', 'PROJ-2', { url: 'https://jira.example.com/browse/PROJ-2' }),
    ]);
    render(<NotificationPopover />);
    const btns = screen.getAllByRole('button', { name: 'Open in browser' });
    expect(btns).toHaveLength(1);
    fireEvent.click(btns[0]);
    expect(openExternal).toHaveBeenCalledWith('https://jira.example.com/browse/PROJ-2');
    expect(useNotificationsStore.getState().readIds).toContain('b');
  });

  it('keyboard: u toggles read, e removes the focused item', async () => {
    seed([jiraItem('a', 'PROJ-1'), jiraItem('b', 'PROJ-2')]);
    render(<NotificationPopover />);
    const primaries = () => document.querySelectorAll<HTMLElement>('[data-entry-primary]');
    const first = primaries()[0];
    first.focus();
    fireEvent.keyDown(first, { key: 'u' });
    expect(useNotificationsStore.getState().readIds.length).toBeGreaterThan(0);
    const before = useNotificationsStore.getState().items.length;
    fireEvent.keyDown(first, { key: 'e' });
    await waitFor(() => expect(useNotificationsStore.getState().items.length).toBeLessThan(before));
  });

  describe('header and filters', () => {
    it('shows heading, Mark all read disabled at 0 unread, More actions', () => {
      seed([jiraItem('a')], ['a']);
      render(<NotificationPopover />);
      expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Mark all read' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'More actions' })).toBeInTheDocument();
    });

    it('Mark all read on Jira tab only touches Jira', async () => {
      seed([jiraItem('j1'), glItem('g1')]);
      render(<NotificationPopover />);
      await pickSource(/^Jira/);
      fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
      const { readIds } = useNotificationsStore.getState();
      expect(readIds).toContain('j1');
      expect(readIds).not.toContain('g1');
    });

    it('Clear read removes only read items of the active tab', async () => {
      seed([jiraItem('j1'), jiraItem('j2', 'PROJ-2'), glItem('g1')], ['j1', 'g1']);
      render(<NotificationPopover />);
      await pickSource(/^Jira/);
      fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
      fireEvent.click(await screen.findByText('Clear read'));
      const ids = useNotificationsStore
        .getState()
        .items.map((i) => i.id)
        .sort();
      expect(ids).toEqual(['g1', 'j2']);
    });

    it('settings menu item calls onOpenSettings and onClose; absent without it', async () => {
      const onOpenSettings = vi.fn();
      const onClose = vi.fn();
      const { unmount } = render(
        <NotificationPopover onOpenSettings={onOpenSettings} onClose={onClose} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Notification settings' }));
      expect(onOpenSettings).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
      unmount();
      render(<NotificationPopover />);
      fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
      await screen.findByText('Clear read');
      expect(screen.queryByRole('menuitem', { name: 'Notification settings' })).toBeNull();
    });

    it('Unread/All segmented buttons use aria-pressed; unread hides read items', () => {
      seed([jiraItem('a'), jiraItem('b', 'PROJ-2')], ['a']);
      render(<NotificationPopover />);
      expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(screen.getByRole('button', { name: 'Unread' }));
      expect(screen.getByRole('button', { name: 'Unread' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(entryCount()).toBe(1);
    });

    it('source filter is a dropdown with per-source choices', async () => {
      render(<NotificationPopover />);
      expect(screen.getByRole('button', { name: 'Filter by source' }).textContent).toContain(
        'All sources',
      );
      fireEvent.click(screen.getByRole('button', { name: 'Filter by source' }));
      expect(await screen.findByRole('menuitemradio', { name: /^Jira/ })).toBeInTheDocument();
      expect(screen.getByRole('menuitemradio', { name: /^GitLab/ })).toBeInTheDocument();
    });

    it('unread chip (in the source menu) is neutral and hidden at 0', async () => {
      seed([jiraItem('a'), jiraItem('b', 'PROJ-2')]);
      const { unmount } = render(<NotificationPopover />);
      fireEvent.click(screen.getByRole('button', { name: 'Filter by source' }));
      const all = await screen.findByRole('menuitemradio', { name: /All sources/ });
      const chip = all.querySelector('span.bg-muted') as HTMLElement;
      expect(chip.textContent).toBe('2');
      expect(chip.className).not.toMatch(/orange|purple|red/);
      unmount();
      seed([jiraItem('a')], ['a']);
      render(<NotificationPopover />);
      fireEvent.click(screen.getByRole('button', { name: 'Filter by source' }));
      const all0 = await screen.findByRole('menuitemradio', { name: /All sources/ });
      expect(all0.querySelector('span.bg-muted')).toBeNull();
    });
  });

  describe('states', () => {
    it('no items: empty state with settings action', () => {
      const onOpenSettings = vi.fn();
      render(<NotificationPopover onOpenSettings={onOpenSettings} />);
      expect(screen.getByText('No notifications yet')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Activity on your Jira issues and GitLab merge requests will show up here.',
        ),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Notification settings' }));
      expect(onOpenSettings).toHaveBeenCalled();
    });

    it('all read + Unread filter shows All caught up', () => {
      seed([jiraItem('a')], ['a']);
      render(<NotificationPopover />);
      fireEvent.click(screen.getByRole('button', { name: 'Unread' }));
      expect(screen.getByText('All caught up')).toBeInTheDocument();
      expect(screen.getByText('You have no unread notifications.')).toBeInTheDocument();
    });

    it('Jira tab with only GitLab items shows Nothing from Jira', async () => {
      seed([glItem('g1')]);
      render(<NotificationPopover />);
      await pickSource(/^Jira/);
      expect(screen.getByText('Nothing from Jira')).toBeInTheDocument();
      expect(screen.getByText('No notifications from this source.')).toBeInTheDocument();
    });

    it('fetchError with no items shows ErrorState and Retry', () => {
      const retry = vi.fn();
      act(() => {
        useNotificationsStore.setState({ fetchError: new Error('boom'), retryFetch: retry });
      });
      render(
        <MemoryRouter>
          <NotificationPopover />
        </MemoryRouter>,
      );
      expect(screen.getByText(/Couldn't load notifications/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /retry/i }));
      expect(retry).toHaveBeenCalled();
    });

    it('fetchError with items shows StaleDataBanner; dismiss hides, new error re-shows', () => {
      const retry = vi.fn();
      seed([jiraItem('a')]);
      act(() => {
        useNotificationsStore.setState({ fetchError: new Error('one'), retryFetch: retry });
      });
      render(<NotificationPopover />);
      expect(screen.getByText(/showing cached data/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(retry).toHaveBeenCalled();
      const banner = screen.getByText(/showing cached data/i).parentElement as HTMLElement;
      fireEvent.click(banner.querySelectorAll('button')[1]);
      expect(screen.queryByText(/showing cached data/i)).not.toBeInTheDocument();
      act(() => {
        useNotificationsStore.setState({ fetchError: new Error('two') });
      });
      expect(screen.getByText(/showing cached data/i)).toBeInTheDocument();
    });

    it('permission denied alert dismiss calls setPermissionDenied(false)', () => {
      act(() => {
        useNotificationsStore.setState({ permissionDenied: true });
      });
      render(<NotificationPopover />);
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      expect(useNotificationsStore.getState().permissionDenied).toBe(false);
    });
  });
});
