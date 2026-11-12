import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useNotificationDispatchLogStore } from '../../stores/notification-dispatch-log.store';
import type { NotificationItem } from '../../stores/notifications.store';
import { useSettingsStore } from '../../stores/settings.store';
import NotificationsTab from './NotificationsTab';

const item = { id: 'n1', source: 'jira', entityTitle: 'PROJ-1: Title' } as NotificationItem;

describe('NotificationsTab', () => {
  beforeEach(() => {
    act(() => {
      useSettingsStore.setState({ devToolsEnabled: true, desktopNotificationsEnabled: true });
      useNotificationDispatchLogStore.getState().clear();
    });
  });

  it('shows the disabled message when Developer Tools are off', () => {
    act(() => {
      useSettingsStore.setState({ devToolsEnabled: false });
    });
    render(<NotificationsTab />);
    expect(screen.getByText(/Developer Tools are disabled/)).toBeTruthy();
  });

  it('shows an empty state before anything is captured', () => {
    render(<NotificationsTab />);
    expect(screen.getByText('No desktop notifications yet')).toBeTruthy();
  });

  it('lists entries with result, title and body; expands to the full item', () => {
    act(() => {
      useNotificationDispatchLogStore.getState().append([
        {
          id: 'a',
          timestamp: '2026-11-12T10:00:00.000Z',
          item,
          title: 'Jira — PROJ-1: Title',
          body: 'Cara Doe: hi',
          outcome: 'error',
        },
      ]);
    });
    render(<NotificationsTab />);
    expect(screen.getByText('Error')).toBeTruthy();
    expect(screen.getByText('Cara Doe: hi')).toBeTruthy();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/"entityTitle": "PROJ-1: Title"/)).toBeTruthy();
  });
});
