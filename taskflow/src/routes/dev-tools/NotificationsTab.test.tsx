import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useNotificationDispatchLogStore } from '../../stores/notification-dispatch-log.store';
import type { NotificationItem } from '../../stores/notifications.store';
import { useSettingsStore } from '../../stores/settings.store';
import { useDevToolsViewStore } from './dev-tools-view.store';
import NotificationsTab from './NotificationsTab';

const item = { id: 'n1', source: 'jira', entityTitle: 'PROJ-1: Title' } as NotificationItem;

describe('NotificationsTab', () => {
  beforeEach(() => {
    act(() => {
      useSettingsStore.setState({ devToolsEnabled: true, desktopNotificationsEnabled: true });
      useNotificationDispatchLogStore.getState().clear();
      useDevToolsViewStore.getState().setSelected('notifications', null);
      useDevToolsViewStore.getState().setSearch('notifications', '');
      useDevToolsViewStore.getState().setFacet('notificationOutcomes', new Set());
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

  it('lists entries with result, title and body; expands to a preview and the raw item', () => {
    act(() => {
      useNotificationDispatchLogStore.getState().append([
        {
          id: 'a',
          timestamp: '2026-11-12T10:00:00.000Z',
          item,
          title: 'PROJ-1 · Title',
          body: 'Cara: hi',
          outcome: 'error',
        },
      ]);
    });
    render(<NotificationsTab />);
    expect(screen.getByText('Error')).toBeTruthy();
    expect(screen.getByText('Cara: hi')).toBeTruthy();
    fireEvent.click(screen.getAllByTestId('devtools-row')[0]);
    expect(
      screen.getByRole('img', { name: 'Notification preview: PROJ-1 · Title. Cara: hi' }),
    ).toBeTruthy();
    expect(screen.getByText(/"entityTitle": "PROJ-1: Title"/)).toBeTruthy();
  });

  it('renders a summary row with the exact strings and its real outcome', () => {
    act(() => {
      useNotificationDispatchLogStore.getState().append([
        {
          id: 's',
          timestamp: '2026-11-12T10:00:00.000Z',
          kind: 'summary',
          items: [item, item, item, item],
          title: '4 new notifications',
          body: '3 Jira · 1 GitLab',
          outcome: 'sent',
        },
      ]);
    });
    render(<NotificationsTab />);
    expect(screen.getByText('summary')).toBeTruthy();
    expect(screen.getByText('4 new notifications')).toBeTruthy();
    expect(screen.getByText('3 Jira · 1 GitLab')).toBeTruthy();
    expect(screen.getByText('Sent')).toBeTruthy();
    fireEvent.click(screen.getAllByTestId('devtools-row')[0]);
    expect(screen.getByText('Raw items')).toBeTruthy();
  });

  it('renders a Grouped row with an explanatory note', () => {
    act(() => {
      useNotificationDispatchLogStore.getState().append([
        {
          id: 'g',
          timestamp: '2026-11-12T10:00:00.000Z',
          item,
          title: 'PROJ-1 · Title',
          body: 'Cara: hi',
          outcome: 'grouped',
        },
      ]);
    });
    render(<NotificationsTab />);
    expect(screen.getByText('Grouped')).toBeTruthy();
    fireEvent.click(screen.getAllByTestId('devtools-row')[0]);
    expect(screen.getByText('Not sent individually: folded into a summary banner.')).toBeTruthy();
  });
  it('filters rows by search text and by outcome', () => {
    act(() => {
      useNotificationDispatchLogStore.getState().append([
        {
          id: 'x1',
          timestamp: '2026-11-12T10:00:00.000Z',
          item,
          title: 'First thing',
          body: 'Cara: hi',
          outcome: 'error',
        },
        {
          id: 'x2',
          timestamp: '2026-11-12T10:00:00.000Z',
          item,
          title: 'Second thing',
          body: 'Dan: yo',
          outcome: 'sent',
        },
      ]);
    });
    render(<NotificationsTab />);
    expect(screen.getAllByTestId('devtools-row')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Search notifications'), { target: { value: 'dan' } });
    expect(screen.getAllByTestId('devtools-row')).toHaveLength(1);
    expect(screen.queryByText('First thing')).toBeNull();
    fireEvent.change(screen.getByLabelText('Search notifications'), { target: { value: '' } });
    act(() => {
      useDevToolsViewStore.getState().setFacet('notificationOutcomes', new Set(['error']));
    });
    expect(screen.getAllByTestId('devtools-row')).toHaveLength(1);
    expect(screen.queryByText('Second thing')).toBeNull();
  });
});
