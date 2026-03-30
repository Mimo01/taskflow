import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NotificationItem } from '../../stores/notifications.store';
import NotificationRow from './NotificationRow';

vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));

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
    ...overrides,
  };
}

describe('NotificationRow', () => {
  // Avatar rendering
  it('renders author avatar element when authorAvatarUrl is provided', () => {
    render(<NotificationRow item={makeItem('jira')} onClick={() => {}} />);
    // CachedAvatar renders an accessible div with role="img" while the blob URL loads
    const avatar = screen.getByRole('img', { name: 'Jane Smith' });
    expect(avatar).toBeInTheDocument();
  });

  it('renders initials fallback when no avatar', () => {
    render(
      <NotificationRow
        item={makeItem('jira', { authorAvatarUrl: undefined })}
        onClick={() => {}}
      />,
    );
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

  it('renders type badge for comment-mention', () => {
    render(
      <NotificationRow
        item={makeItem('jira', { notificationType: 'comment-mention' })}
        onClick={() => {}}
      />,
    );
    expect(screen.getByText('Mentioned you')).toBeInTheDocument();
    expect(screen.getByTestId('type-badge')).toBeInTheDocument();
  });

  it('renders type badge for mr-approval', () => {
    render(
      <NotificationRow
        item={makeItem('gitlab', { notificationType: 'mr-approval' })}
        onClick={() => {}}
      />,
    );
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('renders type badge for issue-assignment', () => {
    render(
      <NotificationRow
        item={makeItem('jira', { notificationType: 'issue-assignment' })}
        onClick={() => {}}
      />,
    );
    expect(screen.getByText('Assigned to you')).toBeInTheDocument();
  });

  // Issue key + title
  it('extracts and renders issue key separately from title', () => {
    render(<NotificationRow item={makeItem('jira')} onClick={() => {}} />);
    expect(screen.getByText('PROJ-123')).toBeInTheDocument();
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
  });

  it('renders full title when no issue key', () => {
    render(
      <NotificationRow
        item={makeItem('gitlab', { entityTitle: 'Some MR title' })}
        onClick={() => {}}
      />,
    );
    expect(screen.getByText('Some MR title')).toBeInTheDocument();
  });

  // Entity state badge
  it('renders entity state badge when present', () => {
    render(
      <NotificationRow item={makeItem('gitlab', { entityState: 'merged' })} onClick={() => {}} />,
    );
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
    const { container } = render(
      <NotificationRow item={makeItem('jira')} isUnread onClick={() => {}} />,
    );
    const btn = container.querySelector('[data-testid="notification-row"]');
    expect(btn?.className).toContain('bg-blue-500');
  });

  it('does not apply blue tint when read', () => {
    const { container } = render(
      <NotificationRow item={makeItem('jira')} isUnread={false} onClick={() => {}} />,
    );
    const btn = container.querySelector('[data-testid="notification-row"]');
    expect(btn?.className).not.toContain('bg-blue-500');
  });

  // Parent story chip
  it('renders parent story chip when parentKey present', () => {
    render(
      <NotificationRow
        item={makeItem('jira', { parentKey: 'PROJ-100', parentSummary: 'User Login Flow' })}
        onClick={() => {}}
      />,
    );
    expect(screen.getByText('PROJ-100')).toBeInTheDocument();
    expect(screen.getByText('User Login Flow')).toBeInTheDocument();
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
  it('renders status changes with old→new chip style', () => {
    render(
      <NotificationRow
        item={makeItem('jira', {
          notificationType: 'issue-update',
          bodyPreview: 'Status: In Progress \u2192 Done',
        })}
        onClick={() => {}}
      />,
    );
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  // Structured field:value without arrow
  it('renders field:value updates in chip style', () => {
    render(
      <NotificationRow
        item={makeItem('jira', {
          notificationType: 'issue-update',
          bodyPreview: 'Priority: High',
        })}
        onClick={() => {}}
      />,
    );
    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });
});
