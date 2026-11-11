import { StrictMode } from 'react';
// Tests for NotificationPopover — header, filters, flat list, triage, navigation, states

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openExternal } from '../../lib/openExternal';
import { useComposerFocus } from '../../stores/composer-focus.store';
import { useNotificationsStore } from '../../stores/notifications.store';
import NotificationPopover from './NotificationPopover';
import {
  NOTIF_ENTER_MS,
  NOTIF_EXIT_MS,
  NOTIF_FAN_MS,
  NOTIF_FLASH_MS,
  NOTIF_STACK_STAGGER_MS,
} from './notification-motion';

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
const seed = (items: unknown[], readIds: string[] = []) =>
  act(() => {
    useNotificationsStore.setState({ items: items as never, readIds });
  });

/** Let a pending clear animation finish so the store removal lands. */
const finishExit = (extra = 0) =>
  act(() => {
    vi.advanceTimersByTime(NOTIF_EXIT_MS + extra + 50);
  });

describe('NotificationPopover', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

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
    // no separate header entrance: the whole panel fades + slides in as one piece
    expect(header.className).not.toContain('notif-hd-in');
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
      vi.useFakeTimers();
      render(<NotificationPopover />);
      fireEvent.click(screen.getByRole('button', { name: /expand/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
      finishExit(NOTIF_STACK_STAGGER_MS);
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
      vi.useFakeTimers();
      render(<NotificationPopover />);
      // WR-02: the stack X is labelled with the number of cards it clears.
      fireEvent.click(screen.getByRole('button', { name: /^Clear \d+ notifications$/ }));
      finishExit();
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
      vi.useFakeTimers();
      render(<NotificationPopover />);
      fireEvent.click(screen.getByRole('button', { name: /expand/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
      finishExit(NOTIF_STACK_STAGGER_MS);
      seed([jiraItem('c'), jiraItem('d')]);
      expect(document.querySelector('[data-stack-header]')).toBeNull();
      expect(entryCount()).toBe(1);
    });

    it('Mark all read still marks every unread notification', () => {
      render(<NotificationPopover />);
      fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
      expect(useNotificationsStore.getState().readIds).toEqual(expect.arrayContaining(['a', 'b']));
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
    it('is ONE header row: title, Mark all read, Clear all; no read/source filters or overflow', () => {
      seed([jiraItem('a')]);
      const { container } = render(<NotificationPopover />);
      expect(container.querySelector('.border-b')).toBeNull();
      const heading = screen.getByRole('heading', { name: 'Notifications' });
      const row = heading.parentElement as HTMLElement;
      expect(document.querySelector('[data-header-subtitle]')).toBeNull();
      for (const name of ['Mark all read', 'Clear all notifications']) {
        expect(row.contains(screen.getByRole('button', { name }))).toBe(true);
      }
      for (const name of ['Unread', 'All', 'Filter by source', 'More actions']) {
        expect(screen.queryByRole('button', { name })).toBeNull();
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
      vi.useFakeTimers();
      render(<NotificationPopover />);
      fireEvent.click(screen.getAllByRole('button', { name: 'Clear notification' })[0]);
      finishExit();
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
      vi.useFakeTimers();
      fireEvent.keyDown(first, { key: 'e' });
      finishExit();
      expect(useNotificationsStore.getState().items.map((i) => i.id)).toEqual(['z']);
    });
  });

  it('row Done removes the item and read toggle flips state', () => {
    vi.useFakeTimers();
    seed([jiraItem('a')]);
    render(<NotificationPopover />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
    expect(useNotificationsStore.getState().readIds).toContain('a');
    fireEvent.click(screen.getByRole('button', { name: 'Mark as unread' }));
    expect(useNotificationsStore.getState().readIds).not.toContain('a');
    fireEvent.click(screen.getByRole('button', { name: 'Clear notification' }));
    finishExit();
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
    it('shows heading, Mark all read disabled at 0 unread, Clear all', () => {
      seed([jiraItem('a')], ['a']);
      render(<NotificationPopover />);
      expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Mark all read' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Clear all notifications' })).toBeEnabled();
    });

    it('Mark all read marks every source', () => {
      seed([jiraItem('j1'), glItem('g1')]);
      render(<NotificationPopover />);
      fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
      const { readIds } = useNotificationsStore.getState();
      expect(readIds).toContain('j1');
      expect(readIds).toContain('g1');
    });

    it('the empty state settings button calls onOpenSettings and onClose; absent without it', () => {
      const onOpenSettings = vi.fn();
      const onClose = vi.fn();
      const { unmount } = render(
        <NotificationPopover onOpenSettings={onOpenSettings} onClose={onClose} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Notification settings' }));
      expect(onOpenSettings).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
      unmount();
      render(<NotificationPopover />);
      expect(screen.queryByRole('button', { name: 'Notification settings' })).toBeNull();
    });

    it('Clear all: first click arms an inline confirmation, second click clears everything', () => {
      vi.useFakeTimers();
      seed([jiraItem('j1'), jiraItem('j2', 'PROJ-2'), glItem('g1')], ['j1']);
      render(<NotificationPopover />);
      fireEvent.click(screen.getByRole('button', { name: 'Clear all notifications' }));
      // armed, nothing removed yet
      expect(useNotificationsStore.getState().items).toHaveLength(3);
      const confirm = screen.getByRole('button', { name: 'Confirm: clear all notifications' });
      expect(confirm).toHaveTextContent('Clear all');
      fireEvent.click(confirm);
      // every card slides out first, then the store empties
      expect(document.querySelectorAll('[data-leaving]').length).toBeGreaterThan(0);
      finishExit(300);
      expect(useNotificationsStore.getState().items).toHaveLength(0);
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

describe('NotificationPopover motion (261111-m0g)', () => {
  const entry = (id: string) => document.querySelector(`[data-entry-id="${id}"]`) as HTMLElement;
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    act(() => {
      useNotificationsStore.setState({
        items: [],
        readIds: [],
        dismissedIds: [],
        fetchError: null,
        retryFetch: null,
      });
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('Done slides the card out first; removal waits for NOTIF_EXIT_MS and other rows keep their nodes', () => {
    seed([jiraItem('a', 'PROJ-1'), jiraItem('z', 'PROJ-9')]);
    render(<NotificationPopover />);
    const other = entry('event:z');
    const doomed = entry('event:a');
    fireEvent.click(doomed.querySelector('[data-corner-x]') as HTMLElement);
    expect(entry('event:a').getAttribute('data-leaving')).toBe('true');
    expect(entry('event:a').querySelector('[data-card]')).not.toBeNull();
    advance(NOTIF_EXIT_MS - 50);
    expect(useNotificationsStore.getState().items).toHaveLength(2);
    advance(100);
    expect(useNotificationsStore.getState().items.map((i) => i.id)).toEqual(['z']);
    expect(entry('event:z')).toBe(other);
    expect(other.isConnected).toBe(true);
    expect(other.hasAttribute('data-leaving')).toBe(false);
  });

  it('a double Done does not schedule a second removal', () => {
    seed([jiraItem('a', 'PROJ-1')]);
    const spy = vi.fn(useNotificationsStore.getState().removeItems);
    act(() => {
      useNotificationsStore.setState({ removeItems: spy });
    });
    render(<NotificationPopover />);
    const x = screen.getByRole('button', { name: 'Clear notification' });
    fireEvent.click(x);
    fireEvent.click(x);
    advance(NOTIF_EXIT_MS + 100);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('stack Clear staggers the header and every member out, then removes once', () => {
    seed([jiraItem('a'), jiraItem('b'), jiraItem('c'), jiraItem('z', 'PROJ-9')]);
    render(<NotificationPopover />);
    fireEvent.click(screen.getByRole('button', { name: /expand/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    const header = document.querySelector('[data-stack-header-entry]') as HTMLElement;
    expect(header.getAttribute('data-leaving')).toBe('true');
    const members = [...document.querySelectorAll<HTMLElement>('[data-leaving="true"]')].filter(
      (el) => el.getAttribute('data-entry-id')?.startsWith('event:'),
    );
    expect(members.length).toBeGreaterThanOrEqual(2);
    const delays = members.map((m) =>
      Number.parseInt(m.style.getPropertyValue('--leave-delay'), 10),
    );
    expect(delays).toEqual([...delays].sort((x, y) => x - y));
    expect(new Set(delays).size).toBe(delays.length);
    expect(delays[0]).toBe(0);
    expect(delays[1]).toBe(NOTIF_STACK_STAGGER_MS);
    advance(NOTIF_EXIT_MS + 3 * NOTIF_STACK_STAGGER_MS + 100);
    expect(useNotificationsStore.getState().items.map((i) => i.id)).toEqual(['z']);
  });

  it('a notification arriving while open slides in without rebuilding the other rows', () => {
    seed([jiraItem('a', 'PROJ-1'), jiraItem('b', 'PROJ-2')]);
    render(<NotificationPopover />);
    const before = [entry('event:a'), entry('event:b')];
    expect(before.every((el) => !el.hasAttribute('data-entering'))).toBe(true);
    act(() => {
      useNotificationsStore.getState().prependItems([jiraItem('n', 'PROJ-73') as never]);
    });
    expect(entry('event:n').getAttribute('data-entering')).toBe('true');
    expect(entry('event:n').className).toContain('notif-enter');
    expect(entry('event:a')).toBe(before[0]);
    expect(entry('event:b')).toBe(before[1]);
    advance(NOTIF_ENTER_MS + 50);
    expect(entry('event:n').hasAttribute('data-entering')).toBe(false);
  });

  it('an arrival on an existing stack keeps the stack node and only bumps +N', () => {
    seed([jiraItem('a'), jiraItem('b')]);
    render(<NotificationPopover />);
    const stack = entry('stack:jira:PROJ-1');
    expect(stack.querySelector('[data-stack-more]')?.textContent).toBe('+1');
    act(() => {
      useNotificationsStore.getState().prependItems([jiraItem('c', 'PROJ-1') as never]);
    });
    expect(entry('stack:jira:PROJ-1')).toBe(stack);
    expect(stack.hasAttribute('data-entering')).toBe(false);
    expect(stack.querySelector('[data-stack-more]')?.textContent).toBe('+2');
  });

  it('rows have no entrance animation on open (StrictMode)', () => {
    seed([jiraItem('a', 'PROJ-1'), jiraItem('b', 'PROJ-2'), jiraItem('c', 'PROJ-3')]);
    render(
      <StrictMode>
        <NotificationPopover />
      </StrictMode>,
    );
    const animated = [...document.querySelectorAll<HTMLElement>('[data-notif-entry]')].filter((r) =>
      /notif-(stagger|enter)/.test(r.className),
    );
    expect(animated).toEqual([]);
  });

  it('toggling read flashes the card in place and clears the flag', () => {
    seed([jiraItem('a', 'PROJ-1')]);
    render(<NotificationPopover />);
    const card = document.querySelector('[data-card]') as HTMLElement;
    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
    expect(entry('event:a').getAttribute('data-flash')).toBe('true');
    expect(document.querySelector('[data-card]')).toBe(card);
    advance(NOTIF_FLASH_MS + 50);
    expect(entry('event:a').hasAttribute('data-flash')).toBe(false);
  });

  it('fans the members out once when a stack expands, and not again afterwards', () => {
    seed([jiraItem('a'), jiraItem('b'), jiraItem('z', 'PROJ-9')]);
    render(<NotificationPopover />);
    fireEvent.click(screen.getByRole('button', { name: /expand/ }));
    const members = [...document.querySelectorAll<HTMLElement>('[data-entry-id^="event:"]')].filter(
      (el) => el.getAttribute('data-entry-id') !== 'event:z',
    );
    expect(members.length).toBe(2);
    expect(members.every((m) => m.className.includes('notif-fan'))).toBe(true);
    expect(members.map((m) => m.style.getPropertyValue('--i'))).toEqual(['0', '1']);
    advance(NOTIF_FAN_MS + 50);
    expect(members.some((m) => m.className.includes('notif-fan'))).toBe(false);
  });

  it('under prefers-reduced-motion Done removes immediately with no leaving state', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('reduce'),
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    seed([jiraItem('a', 'PROJ-1')]);
    render(<NotificationPopover />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear notification' }));
    expect(useNotificationsStore.getState().items).toHaveLength(0);
    expect(document.querySelector('[data-leaving]')).toBeNull();
  });

  it('closing mid-exit still applies the pending clear', () => {
    seed([jiraItem('a', 'PROJ-1')]);
    const { unmount } = render(<NotificationPopover />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear notification' }));
    expect(useNotificationsStore.getState().items).toHaveLength(1);
    unmount();
    expect(useNotificationsStore.getState().items).toHaveLength(0);
  });
});
