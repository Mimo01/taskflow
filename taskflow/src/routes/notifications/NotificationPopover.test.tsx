// Tests for NotificationPopover — header, filters, grouping, triage, navigation, states

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openExternal } from '../../lib/openExternal';
import { useNotificationsStore } from '../../stores/notifications.store';
import NotificationPopover from './NotificationPopover';

vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));
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

  it('renders Alert containing "System notifications are blocked" when permissionDenied', () => {
    act(() => {
      useNotificationsStore.setState({ permissionDenied: true });
    });
    render(<NotificationPopover />);
    expect(
      screen.getByText(
        'System notifications are blocked. Enable them in System Settings to get alerts outside the app.',
      ),
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

  describe('grouping', () => {
    beforeEach(() => seed([jiraItem('a'), jiraItem('b')]));

    it('renders one group header with +1 and children visible', () => {
      render(<NotificationPopover />);
      expect(screen.getByText('+1')).toBeInTheDocument();
      expect(entryCount()).toBe(3);
    });

    it('group click marks both read and navigates', () => {
      const onIssueClick = vi.fn();
      render(<NotificationPopover onIssueClick={onIssueClick} />);
      fireEvent.click(screen.getByRole('button', { name: /2 updates/ }));
      expect(useNotificationsStore.getState().readIds).toEqual(expect.arrayContaining(['a', 'b']));
      expect(onIssueClick).toHaveBeenCalledWith('PROJ-1');
    });

    it('Mark group read marks all group ids read', () => {
      render(<NotificationPopover />);
      fireEvent.click(screen.getByRole('button', { name: 'Mark group read' }));
      expect(useNotificationsStore.getState().readIds).toEqual(expect.arrayContaining(['a', 'b']));
    });

    it('group Done removes both items and tombstones them', () => {
      render(<NotificationPopover />);
      fireEvent.click(screen.getAllByRole('button', { name: 'Done' })[0]);
      const st = useNotificationsStore.getState();
      expect(st.items).toHaveLength(0);
      expect(st.dismissedIds).toEqual(expect.arrayContaining(['a', 'b']));
    });

    it('collapse hides children and survives a store update', () => {
      render(<NotificationPopover />);
      fireEvent.click(screen.getByRole('button', { name: /^Collapse/ }));
      expect(entryCount()).toBe(1);
      act(() => {
        useNotificationsStore.setState({ readIds: [] });
      });
      expect(entryCount()).toBe(1);
    });
  });

  it('row Done removes the item and read toggle flips state', () => {
    seed([jiraItem('a')]);
    render(<NotificationPopover />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
    expect(useNotificationsStore.getState().readIds).toContain('a');
    fireEvent.click(screen.getByRole('button', { name: 'Mark as unread' }));
    expect(useNotificationsStore.getState().readIds).not.toContain('a');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
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

    it('Mark all read on Jira tab only touches Jira', () => {
      seed([jiraItem('j1'), glItem('g1')]);
      render(<NotificationPopover />);
      fireEvent.click(screen.getByRole('button', { name: /^Jira/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
      const { readIds } = useNotificationsStore.getState();
      expect(readIds).toContain('j1');
      expect(readIds).not.toContain('g1');
    });

    it('Clear read removes only read items of the active tab', async () => {
      seed([jiraItem('j1'), jiraItem('j2', 'PROJ-2'), glItem('g1')], ['j1', 'g1']);
      render(<NotificationPopover />);
      fireEvent.click(screen.getByRole('button', { name: /^Jira/ }));
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

    it('renders source tabs', () => {
      render(<NotificationPopover />);
      expect(screen.getByText('All sources')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Jira/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^GitLab/ })).toBeInTheDocument();
    });

    it('unread chip is neutral and hidden at 0', () => {
      seed([jiraItem('a'), jiraItem('b', 'PROJ-2')]);
      const { unmount } = render(<NotificationPopover />);
      const chip = screen.getAllByText('2')[0];
      expect(chip.className).toContain('bg-muted');
      expect(chip.className).not.toMatch(/orange|purple|red/);
      unmount();
      seed([jiraItem('a')], ['a']);
      render(<NotificationPopover />);
      expect(screen.queryByText('1')).not.toBeInTheDocument();
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

    it('Jira tab with only GitLab items shows Nothing from Jira', () => {
      seed([glItem('g1')]);
      render(<NotificationPopover />);
      fireEvent.click(screen.getByRole('button', { name: /^Jira/ }));
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
