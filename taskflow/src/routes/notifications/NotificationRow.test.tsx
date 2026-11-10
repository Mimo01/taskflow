import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NotificationItem } from '../../stores/notifications.store';
import NotificationRow from './NotificationRow';

vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));

// LinkContextMenu (wrapping the open-in-browser button) calls useDetectedBrowsers,
// which needs a QueryClient; stub it rather than wrapping every render().
vi.mock('@/lib/useDetectedBrowsers', () => ({
  useDetectedBrowsers: () => [],
}));

const NOW = new Date('2026-03-11T12:00:00.000Z').getTime();

function makeItem(
  source: 'jira' | 'gitlab',
  overrides?: Partial<NotificationItem>,
): NotificationItem {
  return {
    id: `${source}-item-1`,
    source,
    entityTitle: 'PROJ-123: Fix login bug',
    author: 'Jane Smith',
    authorAvatarUrl: 'https://example.com/avatar.jpg',
    bodyPreview: 'The issue was caused by a race condition',
    fullBody: 'The issue was caused by a race condition in the auth flow',
    createdAt: '2026-03-11T10:00:00.000Z',
    notificationType: 'jira-comment',
    url: 'https://jira.example.com/browse/PROJ-123',
    ...overrides,
  };
}

function setup(props?: Partial<React.ComponentProps<typeof NotificationRow>>) {
  const handlers = {
    onOpen: vi.fn(),
    onToggleRead: vi.fn(),
    onDone: vi.fn(),
    onOpenInBrowser: vi.fn(),
  };
  const utils = render(
    <NotificationRow item={makeItem('jira')} isUnread={true} now={NOW} {...handlers} {...props} />,
  );
  return { ...utils, ...handlers };
}

describe('NotificationRow', () => {
  it('renders ref, entity title, verb tail and injected-now relative time', () => {
    setup();
    expect(screen.getByText('PROJ-123')).toBeInTheDocument();
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
    expect(screen.getByText('commented')).toBeInTheDocument();
    expect(screen.queryByText(/race condition/)).not.toBeInTheDocument();
    expect(screen.getByText('2h')).toBeInTheDocument();
  });

  it('does not render fullBody or parent summary outside the tooltip', () => {
    setup({
      item: makeItem('jira', { parentKey: 'PROJ-1', parentSummary: 'Parent story' }),
    });
    expect(screen.queryByText(/in the auth flow/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Parent story/)).not.toBeInTheDocument();
  });

  it('shows the actor avatar and an aria label naming actor, event and entity', () => {
    const { container } = setup({
      item: makeItem('jira', { notificationType: 'issue-assignment' }),
    });
    expect(screen.getByRole('img', { name: 'Jane Smith' })).toBeInTheDocument();
    expect(container.querySelector('[data-event-badge="assignment"]')).not.toBeNull();
    expect(
      screen.getByRole('button', {
        name: 'Unread. Jane assigned you on PROJ-123 Fix login bug',
      }),
    ).toBeInTheDocument();
  });

  it('nested rows hide key and title and show the snippet after the tail', () => {
    setup({ nested: true });
    expect(screen.queryByText('PROJ-123')).not.toBeInTheDocument();
    expect(screen.queryByText('Fix login bug')).not.toBeInTheDocument();
    expect(screen.getByText('commented')).toBeInTheDocument();
    expect(screen.getByText('The issue was caused by a race condition')).toBeInTheDocument();
  });

  it('renders GitLab MR ref as !iid', () => {
    setup({
      item: makeItem('gitlab', {
        entityTitle: 'Fix the thing',
        mrProjectId: 7,
        mrIid: 34,
        notificationType: 'mr-note',
      }),
    });
    expect(screen.getByText('!34')).toBeInTheDocument();
  });

  it('marks unread via aria prefix and dot; read has neither', () => {
    const { container, rerender, ...h } = setup();
    expect(screen.getByRole('button', { name: /^Unread\. .* on PROJ-123/ })).toBeInTheDocument();
    expect(container.querySelector('[data-unread="true"]')).not.toBeNull();
    rerender(
      <NotificationRow
        item={makeItem('jira')}
        isUnread={false}
        now={NOW}
        onOpen={h.onOpen}
        onToggleRead={h.onToggleRead}
        onDone={h.onDone}
      />,
    );
    expect(screen.queryByRole('button', { name: /^Unread/ })).not.toBeInTheDocument();
    expect(container.querySelector('[data-unread="false"]')).not.toBeNull();
  });

  it('renders the right badge kind per type; system events use tiles', () => {
    const kinds: Record<string, string> = {
      'comment-mention': 'mention',
      'gitlab-mention': 'mention',
      'jira-comment': 'comment',
      'mr-note': 'comment',
      'issue-assignment': 'assignment',
      'mr-approval': 'approval',
      'pipeline-failure': 'failure',
    };
    for (const [t, kind] of Object.entries(kinds)) {
      const { container, unmount } = setup({
        item: makeItem('jira', { notificationType: t as NotificationItem['notificationType'] }),
      });
      expect(container.querySelector(`[data-event-badge="${kind}"]`), t).not.toBeNull();
      unmount();
    }
    const ci = setup({ item: makeItem('jira', { notificationType: 'pipeline-failure' }) });
    expect(ci.container.querySelector('[data-avatar-tile="ci"]')).not.toBeNull();
    expect(screen.queryByRole('img', { name: 'Jane Smith' })).toBeNull();
    ci.unmount();
    const due = setup({
      item: makeItem('jira', {
        notificationType: 'due-date-reminder',
        bodyPreview: 'Due tomorrow',
      }),
    });
    expect(due.container.querySelector('[data-avatar-tile="due"]')).not.toBeNull();
    expect(screen.getByText('due tomorrow')).toBeInTheDocument();
  });

  it('renders the verb in the event colour', () => {
    setup({ item: makeItem('jira', { notificationType: 'comment-mention' }) });
    expect(screen.getByText('mentioned you').className).toContain('text-violet-600');
  });

  it('renders status changes as old and new pills', () => {
    const { container } = setup({
      item: makeItem('jira', {
        notificationType: 'issue-update',
        bodyPreview: 'Status: To Do \u2192 In Review',
      }),
    });
    expect(container.querySelector('[data-tail="status"]')).not.toBeNull();
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Review')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Unread. Jane changed status from To Do to In Review on PROJ-123 Fix login bug',
      }),
    ).toBeInTheDocument();
  });

  it('overlay click calls onOpen once; key click calls onOpen once', () => {
    const { onOpen } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^Unread\./ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'PROJ-123' }));
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('tray buttons call only their handler', () => {
    const { onOpen, onToggleRead, onDone, onOpenInBrowser } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
    expect(onToggleRead).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Open in browser' }));
    expect(onOpenInBrowser).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('read row offers "Mark as unread"', () => {
    setup({ isUnread: false });
    expect(screen.getByRole('button', { name: 'Mark as unread' })).toBeInTheDocument();
  });

  it('omits Open in browser without a handler', () => {
    setup({ onOpenInBrowser: undefined });
    expect(screen.queryByRole('button', { name: 'Open in browser' })).not.toBeInTheDocument();
  });

  it('omits Open in browser without a url', () => {
    setup({ item: makeItem('jira', { url: undefined }) });
    expect(screen.queryByRole('button', { name: 'Open in browser' })).not.toBeInTheDocument();
  });

  it('keeps the same overlay node and focus when isUnread flips (D-05)', () => {
    const { rerender, ...h } = setup();
    const before = screen.getByRole('button', { name: /^Unread\./ });
    before.focus();
    rerender(
      <NotificationRow
        item={makeItem('jira')}
        isUnread={false}
        now={NOW}
        onOpen={h.onOpen}
        onToggleRead={h.onToggleRead}
        onDone={h.onDone}
        onOpenInBrowser={h.onOpenInBrowser}
      />,
    );
    const after = document.querySelector('[data-entry-primary]');
    expect(after).toBe(before);
    expect(document.activeElement).toBe(before);
  });

  it('nested hides the key button', () => {
    setup({ nested: true });
    expect(screen.queryByRole('button', { name: 'PROJ-123' })).not.toBeInTheDocument();
  });

  it('has no div[role=button]', () => {
    const { container } = setup();
    expect(container.querySelectorAll('div[role="button"]').length).toBe(0);
  });
});
