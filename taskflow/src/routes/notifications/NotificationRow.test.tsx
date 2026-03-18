// NOTF-01: NotificationRow renders sleek card layout with source accents, metadata, and action tray
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
  // Source accent border
  it('renders with border-orange-500 for jira source', () => {
    const item = makeItem('jira');
    const { container } = render(<NotificationRow item={item} onClick={() => {}} />);
    const button = container.querySelector('button');
    expect(button?.className).toContain('border-orange-500');
  });

  it('renders with border-purple-500 for gitlab source', () => {
    const item = makeItem('gitlab');
    const { container } = render(<NotificationRow item={item} onClick={() => {}} />);
    const button = container.querySelector('button');
    expect(button?.className).toContain('border-purple-500');
  });

  // Title and issue key extraction
  it('extracts and renders issue key separately from title', () => {
    const item = makeItem('jira');
    render(<NotificationRow item={item} onClick={() => {}} />);
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
    const item = makeItem('gitlab');
    render(<NotificationRow item={item} onClick={() => {}} />);
    expect(screen.getByText('The issue was caused by a race condition')).toBeInTheDocument();
  });

  // Type badge
  it('renders type label Mentioned when notificationType is comment-mention', () => {
    const item: NotificationItem = { ...makeItem('jira'), notificationType: 'comment-mention' };
    render(<NotificationRow item={item} onClick={() => {}} />);
    expect(screen.getByText('Mentioned')).toBeInTheDocument();
  });

  // Entity state chip
  it('renders entityState chip when entityState is provided', () => {
    const item: NotificationItem = { ...makeItem('gitlab'), entityState: 'merged' };
    render(<NotificationRow item={item} onClick={() => {}} />);
    expect(screen.getByText('merged')).toBeInTheDocument();
  });

  // Source badge text
  it('renders source badge text "Jira" for jira source', () => {
    const item = makeItem('jira');
    render(<NotificationRow item={item} onClick={() => {}} />);
    expect(screen.getByText('Jira')).toBeInTheDocument();
  });

  it('renders source badge text "GitLab" for gitlab source', () => {
    const item = makeItem('gitlab');
    render(<NotificationRow item={item} onClick={() => {}} />);
    expect(screen.getByText('GitLab')).toBeInTheDocument();
  });

  // Timestamp
  it('renders the relative timestamp', () => {
    const item = makeItem('jira');
    render(<NotificationRow item={item} onClick={() => {}} />);
    // Compact format without "ago" — e.g. "7d"
    expect(screen.getByText(/\d+d/)).toBeInTheDocument();
  });

  // Author
  it('renders author name without "by" prefix', () => {
    const item = makeItem('jira');
    render(<NotificationRow item={item} onClick={() => {}} />);
    expect(screen.getByText('J.Smith')).toBeInTheDocument();
    expect(screen.queryByText('by J.Smith')).not.toBeInTheDocument();
  });

  // Unread indicator
  it('renders unread dot indicator when isUnread is true', () => {
    const item = makeItem('jira');
    const { container } = render(<NotificationRow item={item} isUnread={true} onClick={() => {}} />);
    const dot = container.querySelector('[data-testid="unread-dot"]');
    expect(dot).toBeInTheDocument();
    expect(dot?.className).toContain('bg-blue-500');
  });

  it('does not render unread dot when isUnread is false', () => {
    const item = makeItem('jira');
    const { container } = render(<NotificationRow item={item} isUnread={false} onClick={() => {}} />);
    const dot = container.querySelector('[data-testid="unread-dot"]');
    expect(dot).not.toBeInTheDocument();
  });

  it('applies font-semibold to title when unread', () => {
    const item = makeItem('jira');
    render(<NotificationRow item={item} isUnread={true} onClick={() => {}} />);
    const title = screen.getByText('Fix login bug');
    expect(title.className).toContain('font-semibold');
  });

  // Parent key
  it('renders parent key when parentKey is provided', () => {
    const item: NotificationItem = { ...makeItem('jira'), parentKey: 'PROJ-100' };
    render(<NotificationRow item={item} onClick={() => {}} />);
    expect(screen.getByText('PROJ-100')).toBeInTheDocument();
  });

  // Action tray
  it('renders action tray with labeled buttons when actions are provided', () => {
    const item = makeItem('jira');
    const { container } = render(
      <NotificationRow
        item={{ ...item, url: 'https://jira.example.com/browse/PROJ-123' }}
        onClick={() => {}}
        onNavigate={() => {}}
        onDismiss={() => {}}
        onOpenInBrowser={() => {}}
      />,
    );
    const tray = container.querySelector('[data-testid="action-tray"]');
    expect(tray).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Dismiss')).toBeInTheDocument();
  });

  it('does not render action tray when no actions provided', () => {
    const item = makeItem('jira');
    const { container } = render(<NotificationRow item={item} onClick={() => {}} />);
    const tray = container.querySelector('[data-testid="action-tray"]');
    expect(tray).not.toBeInTheDocument();
  });
});
