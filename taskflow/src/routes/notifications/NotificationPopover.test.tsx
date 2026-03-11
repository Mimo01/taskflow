// NOTF-03: Permission-denied banner renders from alert.tsx when permissionDenied is true
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
