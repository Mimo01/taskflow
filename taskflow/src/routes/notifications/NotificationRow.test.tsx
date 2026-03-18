import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  // Source identification
  it('renders J source badge for jira', () => {
    render(<NotificationRow item={makeItem('jira')} onClick={() => {}} />);
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('renders GL source badge for gitlab', () => {
    render(<NotificationRow item={makeItem('gitlab')} onClick={() => {}} />);
    expect(screen.getByText('GL')).toBeInTheDocument();
  });

  // Type identification
  it('renders type pill when notificationType is set', () => {
    const item: NotificationItem = { ...makeItem('jira'), notificationType: 'comment-mention' };
    render(<NotificationRow item={item} onClick={() => {}} />);
    expect(screen.getByText('Mentioned')).toBeInTheDocument();
  });

  it('renders Approved type for mr-approval', () => {
    const item: NotificationItem = { ...makeItem('gitlab'), notificationType: 'mr-approval' };
    render(<NotificationRow item={item} onClick={() => {}} />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  // Body preview
  it('renders body preview', () => {
    render(<NotificationRow item={makeItem('gitlab')} onClick={() => {}} />);
    expect(screen.getByText('The issue was caused by a race condition')).toBeInTheDocument();
  });

  // Entity state
  it('renders entityState when provided', () => {
    const item: NotificationItem = { ...makeItem('gitlab'), entityState: 'merged' };
    render(<NotificationRow item={item} onClick={() => {}} />);
    expect(screen.getByText('merged')).toBeInTheDocument();
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
  it('renders unread dot when unread', () => {
    const { container } = render(<NotificationRow item={makeItem('jira')} isUnread onClick={() => {}} />);
    expect(container.querySelector('[data-testid="unread-dot"]')).toBeInTheDocument();
  });

  it('does not render unread dot when read', () => {
    const { container } = render(<NotificationRow item={makeItem('jira')} isUnread={false} onClick={() => {}} />);
    expect(container.querySelector('[data-testid="unread-dot"]')).not.toBeInTheDocument();
  });

  it('applies font-medium to title when unread', () => {
    render(<NotificationRow item={makeItem('jira')} isUnread onClick={() => {}} />);
    const title = screen.getByText('Fix login bug');
    expect(title.className).toContain('font-medium');
  });

  // Parent key
  it('renders parent key when parentKey and issueKey are present', () => {
    const item: NotificationItem = { ...makeItem('jira'), parentKey: 'PROJ-100' };
    render(<NotificationRow item={item} onClick={() => {}} />);
    expect(screen.getByText('PROJ-100')).toBeInTheDocument();
  });

  // Click = mark read + navigate
  it('calls onClick on click', () => {
    const onClick = vi.fn();
    render(<NotificationRow item={makeItem('jira')} onClick={onClick} />);
    fireEvent.click(screen.getByText('Fix login bug').closest('button')!);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // External link hover action
  it('renders external link icon when onOpenInBrowser is provided', () => {
    const { container } = render(
      <NotificationRow
        item={{ ...makeItem('jira'), url: 'https://jira.example.com/browse/PROJ-123' }}
        onClick={() => {}}
        onOpenInBrowser={() => {}}
      />,
    );
    expect(container.querySelector('[data-testid="external-action"]')).toBeInTheDocument();
  });

  it('does not render external link when no url', () => {
    const { container } = render(
      <NotificationRow item={makeItem('jira')} onClick={() => {}} onOpenInBrowser={() => {}} />,
    );
    expect(container.querySelector('[data-testid="external-action"]')).not.toBeInTheDocument();
  });

  // Swipe backgrounds render
  it('renders notification-row container for swipe support', () => {
    const { container } = render(
      <NotificationRow item={makeItem('jira')} onClick={() => {}} onMarkRead={() => {}} onDismiss={() => {}} />,
    );
    expect(container.querySelector('[data-testid="notification-row"]')).toBeInTheDocument();
  });

  // Status change formatting
  it('renders status changes with arrow formatting', () => {
    const item: NotificationItem = {
      ...makeItem('jira'),
      notificationType: 'issue-update',
      bodyPreview: 'Status: In Progress \u2192 Done',
    };
    render(<NotificationRow item={item} onClick={() => {}} />);
    expect(screen.getByText('Done')).toBeInTheDocument();
  });
});
