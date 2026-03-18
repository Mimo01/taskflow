import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import NotificationRow from './NotificationRow';
import type { NotificationItem } from '../../stores/notifications.store';

vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));

function makeItem(source: 'jira' | 'gitlab'): NotificationItem {
  return {
    id: `${source}-item-1`,
    source,
    entityTitle: 'PROJ-123: Fix login bug',
    author: 'J.Smith',
    bodyPreview: 'The issue was caused by a race condition',
    fullBody: 'The issue was caused by a race condition in the auth flow',
    createdAt: '2026-03-11T10:00:00.000Z',
  };
}

describe('NotificationRow', () => {
  // Issue key extraction
  it('extracts and renders issue key separately from title', () => {
    render(<NotificationRow item={makeItem('jira')} onClick={() => {}} />);
    expect(screen.getByText('PROJ-123')).toBeInTheDocument();
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
  });

  it('renders full title when no issue key pattern present', () => {
    const item: NotificationItem = {
      ...makeItem('gitlab'),
      entityTitle: 'Some merge request title without key',
    };
    render(<NotificationRow item={item} onClick={() => {}} />);
    expect(screen.getByText('Some merge request title without key')).toBeInTheDocument();
  });

  // Body preview
  it('renders the body preview', () => {
    render(<NotificationRow item={makeItem('gitlab')} onClick={() => {}} />);
    expect(screen.getByText('The issue was caused by a race condition')).toBeInTheDocument();
  });

  // Type label
  it('renders type label when notificationType is set', () => {
    const item: NotificationItem = { ...makeItem('jira'), notificationType: 'comment-mention' };
    render(<NotificationRow item={item} onClick={() => {}} />);
    expect(screen.getByText('Mentioned')).toBeInTheDocument();
  });

  // Entity state
  it('renders entityState when provided', () => {
    const item: NotificationItem = { ...makeItem('gitlab'), entityState: 'merged' };
    render(<NotificationRow item={item} onClick={() => {}} />);
    expect(screen.getByText('merged')).toBeInTheDocument();
  });

  // Source dot on avatar
  it('renders source indicator dot for jira (orange)', () => {
    const { container } = render(<NotificationRow item={makeItem('jira')} onClick={() => {}} />);
    const dot = container.querySelector('.bg-orange-500');
    expect(dot).toBeInTheDocument();
  });

  it('renders source indicator dot for gitlab (purple)', () => {
    const { container } = render(<NotificationRow item={makeItem('gitlab')} onClick={() => {}} />);
    const dot = container.querySelector('.bg-purple-500');
    expect(dot).toBeInTheDocument();
  });

  // Timestamp
  it('renders relative timestamp', () => {
    render(<NotificationRow item={makeItem('jira')} onClick={() => {}} />);
    expect(screen.getByText(/\d+d/)).toBeInTheDocument();
  });

  // Author
  it('renders author name', () => {
    render(<NotificationRow item={makeItem('jira')} onClick={() => {}} />);
    expect(screen.getByText('J.Smith')).toBeInTheDocument();
  });

  // Unread state
  it('renders blue left accent when unread', () => {
    const { container } = render(<NotificationRow item={makeItem('jira')} isUnread onClick={() => {}} />);
    const accent = container.querySelector('.bg-blue-500');
    expect(accent).toBeInTheDocument();
  });

  it('does not render blue accent when read', () => {
    const { container } = render(<NotificationRow item={makeItem('jira')} isUnread={false} onClick={() => {}} />);
    const accent = container.querySelector('.bg-blue-500');
    // Source dot is orange for jira, no blue accent
    expect(accent).not.toBeInTheDocument();
  });

  it('applies font-medium to title when unread', () => {
    render(<NotificationRow item={makeItem('jira')} isUnread onClick={() => {}} />);
    const title = screen.getByText('Fix login bug');
    expect(title.className).toContain('font-medium');
  });

  // Parent key
  it('renders parent key context when parentKey and issueKey are present', () => {
    const item: NotificationItem = { ...makeItem('jira'), parentKey: 'PROJ-100' };
    render(<NotificationRow item={item} onClick={() => {}} />);
    expect(screen.getByText('PROJ-100')).toBeInTheDocument();
  });

  // Action tray
  it('renders action tray with icon buttons when actions are provided', () => {
    const { container } = render(
      <NotificationRow
        item={{ ...makeItem('jira'), url: 'https://jira.example.com/browse/PROJ-123' }}
        onClick={() => {}}
        onNavigate={() => {}}
        onDismiss={() => {}}
        onOpenInBrowser={() => {}}
      />,
    );
    const tray = container.querySelector('[data-testid="action-tray"]');
    expect(tray).toBeInTheDocument();
    // 3 action buttons
    const buttons = tray?.querySelectorAll('[role="button"]');
    expect(buttons?.length).toBe(3);
  });

  it('does not render action tray when no actions provided', () => {
    const { container } = render(<NotificationRow item={makeItem('jira')} onClick={() => {}} />);
    expect(container.querySelector('[data-testid="action-tray"]')).not.toBeInTheDocument();
  });

  // Change formatting
  it('renders status changes with arrow formatting', () => {
    const item: NotificationItem = {
      ...makeItem('jira'),
      notificationType: 'issue-update',
      bodyPreview: 'Status: In Progress → Done',
    };
    render(<NotificationRow item={item} onClick={() => {}} />);
    expect(screen.getByText('Done')).toBeInTheDocument();
  });
});
