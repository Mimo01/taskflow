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
  it('renders ref, description and injected-now relative time', () => {
    setup();
    expect(screen.getByText('PROJ-123')).toBeInTheDocument();
    expect(
      screen.getByText('Jane Smith commented: The issue was caused by a race condition'),
    ).toBeInTheDocument();
    expect(screen.getByText('2h')).toBeInTheDocument();
  });

  it('does not render fullBody or parent summary outside the tooltip', () => {
    setup({
      item: makeItem('jira', { parentKey: 'PROJ-1', parentSummary: 'Parent story' }),
    });
    expect(screen.queryByText(/in the auth flow/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Parent story/)).not.toBeInTheDocument();
  });

  it('renders the author avatar and an initials fallback', () => {
    setup({ item: makeItem('jira', { authorAvatarUrl: undefined }) });
    expect(screen.getByText('JS')).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: /^Unread\. PROJ-123/ })).toBeInTheDocument();
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

  it('only pipeline-failure, mr-approval and due-date-reminder glyphs are status-toned', () => {
    const status = ['pipeline-failure', 'mr-approval', 'due-date-reminder'] as const;
    const neutral = [
      'comment-mention',
      'jira-comment',
      'gitlab-mention',
      'mr-note',
      'issue-update',
      'issue-assignment',
    ] as const;
    for (const t of status) {
      const { container, unmount } = setup({
        item: makeItem('jira', { notificationType: t }),
      });
      expect(container.querySelector('[data-tone="status"]')).not.toBeNull();
      unmount();
    }
    for (const t of neutral) {
      const { container, unmount } = setup({
        item: makeItem('jira', { notificationType: t }),
      });
      expect(container.querySelector('[data-tone="neutral"]')).not.toBeNull();
      expect(container.querySelector('[data-tone="status"]')).toBeNull();
      unmount();
    }
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
