// Tests for NotificationPopover — permission banner + navigation click behavior
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from '@testing-library/react';
import NotificationPopover from './NotificationPopover';
import { useNotificationsStore } from '../../stores/notifications.store';

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

    render(<NotificationPopover source="jira" />);

    expect(
      screen.getByText(/Desktop notifications are blocked/i),
    ).toBeInTheDocument();
  });

  it('does not render permission-denied alert when permissionDenied is false', () => {
    act(() => {
      useNotificationsStore.setState({ permissionDenied: false });
    });

    render(<NotificationPopover source="jira" />);

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
        source="jira"
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
        source="gitlab"
        onMRClick={onMRClick}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByText('Add dark mode support'));

    expect(onMRClick).toHaveBeenCalledWith('99/7');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
