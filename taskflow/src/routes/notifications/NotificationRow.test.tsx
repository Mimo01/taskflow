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
  it('extracts and renders issue key separately from title', () => {
    render(<NotificationRow item={makeItem('jira')} onClick={() => {}} />);
    expect(screen.getByText('PROJ-123')).toBeInTheDocument();
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
  });

  it('renders full title when no issue key pattern', () => {
    const item: NotificationItem = { ...makeItem('gitlab'), entityTitle: 'Some MR title' };
    render(<NotificationRow item={item} onClick={() => {}} />);
    expect(screen.getByText('Some MR title')).toBeInTheDocument();
  });

  it('renders J source badge for jira', () => {
    render(<NotificationRow item={makeItem('jira')} onClick={() => {}} />);
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('renders GL source badge for gitlab', () => {
    render(<NotificationRow item={makeItem('gitlab')} onClick={() => {}} />);
    expect(screen.getByText('GL')).toBeInTheDocument();
  });

  it('renders type pill when notificationType is set', () => {
    const item: NotificationItem = { ...makeItem('jira'), notificationType: 'comment-mention' };
    render(<NotificationRow item={item} onClick={() => {}} />);
    expect(screen.getByText('Mentioned')).toBeInTheDocument();
  });

  it('renders body preview', () => {
    render(<NotificationRow item={makeItem('gitlab')} onClick={() => {}} />);
    expect(screen.getByText('The issue was caused by a race condition')).toBeInTheDocument();
  });

  it('renders entityState', () => {
    const item: NotificationItem = { ...makeItem('gitlab'), entityState: 'merged' };
    render(<NotificationRow item={item} onClick={() => {}} />);
    expect(screen.getByText('merged')).toBeInTheDocument();
  });

  it('renders relative timestamp', () => {
    render(<NotificationRow item={makeItem('jira')} onClick={() => {}} />);
    expect(screen.getByText(/\d+d/)).toBeInTheDocument();
  });

  it('renders author name', () => {
    render(<NotificationRow item={makeItem('jira')} onClick={() => {}} />);
    expect(screen.getByText('J.Smith')).toBeInTheDocument();
  });

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
    expect(screen.getByText('Fix login bug').className).toContain('font-medium');
  });

  it('renders parent key when parentKey and issueKey present', () => {
    const item: NotificationItem = { ...makeItem('jira'), parentKey: 'PROJ-100' };
    render(<NotificationRow item={item} onClick={() => {}} />);
    expect(screen.getByText('PROJ-100')).toBeInTheDocument();
  });

  it('fires onClick on click', () => {
    const fn = vi.fn();
    render(<NotificationRow item={makeItem('jira')} onClick={fn} />);
    fireEvent.click(screen.getByTestId('notification-row'));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('renders action tray when actions provided', () => {
    const { container } = render(
      <NotificationRow
        item={{ ...makeItem('jira'), url: 'https://jira.example.com/PROJ-123' }}
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
