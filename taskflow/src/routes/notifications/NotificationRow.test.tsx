import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NotificationRow from './NotificationRow';
import type { NotificationItem } from '../../stores/notifications.store';

vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));

function makeItem(source: 'jira' | 'gitlab', overrides?: Partial<NotificationItem>): NotificationItem {
  return {
    id: `${source}-item-1`,
    source,
    entityTitle: 'PROJ-123: Fix login bug',
    author: 'Jane Smith',
    authorAvatarUrl: 'https://example.com/avatar.jpg',
    bodyPreview: 'The issue was caused by a race condition',
    fullBody: 'The issue was caused by a race condition in the auth flow',
    createdAt: '2026-03-11T10:00:00.000Z',
    ...overrides,
  };
}

describe('NotificationRow', () => {
  // Avatar rendering
  it('renders author avatar image when authorAvatarUrl is provided', () => {
    const { container } = render(<NotificationRow item={makeItem('jira')} onClick={() => {}} />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img?.src).toContain('avatar.jpg');
  });

  it('renders initials fallback when no avatar', () => {
    render(<NotificationRow item={makeItem('jira', { authorAvatarUrl: undefined })} onClick={() => {}} />);
    expect(screen.getByText('JS')).toBeInTheDocument(); // Jane Smith → JS
  });

  // Source identification via left border
  it('renders orange left border for jira', () => {
    const { container } = render(<NotificationRow item={makeItem('jira')} onClick={() => {}} />);
    const btn = container.querySelector('[data-testid="notification-row"]');
    expect(btn?.className).toContain('border-orange-500');
  });

  it('renders purple left border for gitlab', () => {
    const { container } = render(<NotificationRow item={makeItem('gitlab')} onClick={() => {}} />);
    const btn = container.querySelector('[data-testid="notification-row"]');
    expect(btn?.className).toContain('border-purple-500');
  });

  // Author + verb sentence
  it('renders author name prominently', () => {
    render(<NotificationRow item={makeItem('jira')} onClick={() => {}} />);
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('renders action verb for comment-mention', () => {
    render(<NotificationRow item={makeItem('jira', { notificationType: 'comment-mention' })} onClick={() => {}} />);
    expect(screen.getByText('mentioned you in')).toBeInTheDocument();
  });

  it('renders action verb for mr-approval', () => {
    render(<NotificationRow item={makeItem('gitlab', { notificationType: 'mr-approval' })} onClick={() => {}} />);
    expect(screen.getByText('approved')).toBeInTheDocument();
  });

  it('renders action verb for issue-assignment', () => {
    render(<NotificationRow item={makeItem('jira', { notificationType: 'issue-assignment' })} onClick={() => {}} />);
    expect(screen.getByText('assigned you to')).toBeInTheDocument();
  });

  // Issue key + title
  it('extracts and renders issue key separately from title', () => {
    render(<NotificationRow item={makeItem('jira')} onClick={() => {}} />);
    expect(screen.getByText('PROJ-123')).toBeInTheDocument();
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
  });

  it('renders full title when no issue key', () => {
    render(<NotificationRow item={makeItem('gitlab', { entityTitle: 'Some MR title' })} onClick={() => {}} />);
    expect(screen.getByText('Some MR title')).toBeInTheDocument();
  });

  // Entity state badge
  it('renders entity state badge when present', () => {
    render(<NotificationRow item={makeItem('gitlab', { entityState: 'merged' })} onClick={() => {}} />);
    expect(screen.getByText('Merged')).toBeInTheDocument();
  });

  // Body preview
  it('renders body preview', () => {
    render(<NotificationRow item={makeItem('gitlab')} onClick={() => {}} />);
    expect(screen.getByText('The issue was caused by a race condition')).toBeInTheDocument();
  });

  // Timestamp
  it('renders relative timestamp', () => {
    render(<NotificationRow item={makeItem('jira')} onClick={() => {}} />);
    expect(screen.getByText(/\d+[dwh]|\d+m|just now/)).toBeInTheDocument();
  });

  // Unread state — blue tinted background + ring on avatar
  it('applies blue tint background when unread', () => {
    const { container } = render(<NotificationRow item={makeItem('jira')} isUnread onClick={() => {}} />);
    const btn = container.querySelector('[data-testid="notification-row"]');
    expect(btn?.className).toContain('bg-blue-500');
  });

  it('does not apply blue tint when read', () => {
    const { container } = render(<NotificationRow item={makeItem('jira')} isUnread={false} onClick={() => {}} />);
    const btn = container.querySelector('[data-testid="notification-row"]');
    expect(btn?.className).not.toContain('bg-blue-500');
  });

  // Parent story chip
  it('renders parent story chip when parentKey present', () => {
    render(<NotificationRow item={makeItem('jira', { parentKey: 'PROJ-100', parentSummary: 'User Login Flow' })} onClick={() => {}} />);
    expect(screen.getByText('PROJ-100')).toBeInTheDocument();
    expect(screen.getByText('User Login Flow')).toBeInTheDocument();
    expect(screen.getByText('Parent')).toBeInTheDocument();
  });

  // Click
  it('fires onClick on click', () => {
    const fn = vi.fn();
    render(<NotificationRow item={makeItem('jira')} onClick={fn} />);
    fireEvent.click(screen.getByTestId('notification-row'));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  // Action tray
  it('renders action tray when actions provided', () => {
    const { container } = render(
      <NotificationRow
        item={makeItem('jira', { url: 'https://jira.example.com/PROJ-123' })}
        onClick={() => {}}
        onMarkRead={() => {}}
        onDismiss={() => {}}
        onOpenInBrowser={() => {}}
      />,
    );
    expect(container.querySelector('[data-testid="action-tray"]')).toBeInTheDocument();
  });

  it('does not render action tray when no actions', () => {
    const { container } = render(<NotificationRow item={makeItem('jira')} onClick={() => {}} />);
    expect(container.querySelector('[data-testid="action-tray"]')).not.toBeInTheDocument();
  });

  // Status change formatting
  it('renders status changes with arrow formatting', () => {
    render(<NotificationRow item={makeItem('jira', {
      notificationType: 'issue-update',
      bodyPreview: 'Status: In Progress \u2192 Done',
    })} onClick={() => {}} />);
    expect(screen.getByText('Done')).toBeInTheDocument();
  });
});
