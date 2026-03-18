// Tests for NotificationPopover — permission banner, navigation clicks, tabs, unread filter
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from '@testing-library/react';
import NotificationPopover from './NotificationPopover';
import { useNotificationsStore } from '../../stores/notifications.store';

vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));

describe('NotificationPopover', () => {
  beforeEach(() => {
    act(() => {
      useNotificationsStore.setState({
        items: [],
        readIds: [],
        lastSeenCursor: null,
        permissionDenied: false,
        fetchError: null,
        retryFetch: null,
      });
    });
  });

  it('renders Alert containing "Desktop notifications are blocked" when permissionDenied is true', () => {
    act(() => {
      useNotificationsStore.setState({ permissionDenied: true });
    });

    render(<NotificationPopover />);

    expect(
      screen.getByText(/Desktop notifications are blocked/i),
    ).toBeInTheDocument();
  });

  it('does not render permission-denied alert when permissionDenied is false', () => {
    act(() => {
      useNotificationsStore.setState({ permissionDenied: false });
    });

    render(<NotificationPopover />);

    expect(
      screen.queryByText(/Desktop notifications are blocked/i),
    ).not.toBeInTheDocument();
  });

  it('calls onIssueClick and onClose when a Jira notification is clicked', () => {
    const onIssueClick = vi.fn();
    const onClose = vi.fn();

    act(() => {
      useNotificationsStore.setState({
        items: [
          {
            id: 'jira-1',
            source: 'jira',
            entityTitle: 'PROJ-42: Fix login bug',
            author: 'Jane',
            bodyPreview: 'Updated status',
            fullBody: 'Updated status',
            createdAt: new Date().toISOString(),
            url: 'https://jira.example.com/browse/PROJ-42',
          },
        ],
      });
    });

    render(
      <NotificationPopover
        onIssueClick={onIssueClick}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByText('PROJ-42: Fix login bug'));

    expect(onIssueClick).toHaveBeenCalledWith('PROJ-42');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onMRClick and onClose when a GitLab notification is clicked', () => {
    const onMRClick = vi.fn();
    const onClose = vi.fn();

    act(() => {
      useNotificationsStore.setState({
        items: [
          {
            id: 'gitlab-1',
            source: 'gitlab',
            entityTitle: 'Add dark mode support',
            author: 'Bob',
            bodyPreview: 'Merged MR',
            fullBody: 'Merged MR',
            createdAt: new Date().toISOString(),
            mrProjectId: 99,
            mrIid: 7,
          },
        ],
      });
    });

    render(
      <NotificationPopover
        onMRClick={onMRClick}
        onClose={onClose}
      />,
    );

    // All items visible under "All" tab by default
    fireEvent.click(screen.getByText('Add dark mode support'));

    expect(onMRClick).toHaveBeenCalledWith('99/7');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders source tabs (All, Jira, GitLab)', () => {
    render(<NotificationPopover />);

    // "All" appears both as a tab and in the unread filter button — use getAllByText
    expect(screen.getAllByText('All').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Jira')).toBeInTheDocument();
    expect(screen.getByText('GitLab')).toBeInTheDocument();
  });

  it('shows contextual empty state for Jira tab', () => {
    render(<NotificationPopover />);

    fireEvent.click(screen.getByText('Jira'));

    expect(screen.getByText('No Jira notifications')).toBeInTheDocument();
  });

  it('shows contextual empty state for GitLab tab', () => {
    render(<NotificationPopover />);

    fireEvent.click(screen.getByText('GitLab'));

    expect(screen.getByText('No GitLab notifications')).toBeInTheDocument();
  });

  it('shows "All caught up" when unread filter is active and no unread items', () => {
    act(() => {
      useNotificationsStore.setState({
        items: [
          {
            id: 'jira-1',
            source: 'jira',
            entityTitle: 'PROJ-1: Done item',
            author: 'Jane',
            bodyPreview: 'done',
            fullBody: 'done',
            createdAt: new Date().toISOString(),
          },
        ],
        readIds: ['jira-1'],
      });
    });

    render(<NotificationPopover />);

    // Toggle unread filter
    fireEvent.click(screen.getByTitle('Show unread only'));

    expect(screen.getByText('All caught up')).toBeInTheDocument();
  });

  it('renders time group headers for notifications', () => {
    act(() => {
      useNotificationsStore.setState({
        items: [
          {
            id: 'jira-today',
            source: 'jira',
            entityTitle: 'PROJ-1: Today item',
            author: 'Jane',
            bodyPreview: 'today',
            fullBody: 'today',
            createdAt: new Date().toISOString(),
          },
        ],
      });
    });

    render(<NotificationPopover />);

    expect(screen.getByText('Today')).toBeInTheDocument();
  });
});
