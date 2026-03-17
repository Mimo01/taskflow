// NOTF-01: NotificationRow renders source-specific left border accent and source badges
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
  it('renders with border-orange-500 for jira source', () => {
    const item = makeItem('jira');
    const { container } = render(<NotificationRow item={item} onClick={() => {}} />);
    const row = container.firstElementChild;
    expect(row?.className).toContain('border-orange-500');
  });

  it('renders with border-purple-500 for gitlab source', () => {
    const item = makeItem('gitlab');
    const { container } = render(<NotificationRow item={item} onClick={() => {}} />);
    const row = container.firstElementChild;
    expect(row?.className).toContain('border-purple-500');
  });

  it('renders the entity title', () => {
    const item = makeItem('jira');
    render(<NotificationRow item={item} onClick={() => {}} />);
    expect(screen.getByText('PROJ-123: Fix login bug')).toBeInTheDocument();
  });

  it('renders the body preview', () => {
    const item = makeItem('gitlab');
    render(<NotificationRow item={item} onClick={() => {}} />);
    expect(screen.getByText('The issue was caused by a race condition')).toBeInTheDocument();
  });

  it('renders type label Mentioned when notificationType is comment-mention', () => {
    const item: NotificationItem = { ...makeItem('jira'), notificationType: 'comment-mention' };
    render(<NotificationRow item={item} onClick={() => {}} />);
    expect(screen.getByText('Mentioned')).toBeInTheDocument();
  });

  it('renders entityState chip when entityState is provided', () => {
    const item: NotificationItem = { ...makeItem('gitlab'), entityState: 'merged' };
    render(<NotificationRow item={item} onClick={() => {}} />);
    expect(screen.getByText('merged')).toBeInTheDocument();
  });

  // New tests for redesigned layout

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

  it('renders the relative timestamp in the metadata line', () => {
    const item = makeItem('jira');
    render(<NotificationRow item={item} onClick={() => {}} />);
    // The item is from March 11, so it should show "Xd ago"
    expect(screen.getByText(/\d+d ago/)).toBeInTheDocument();
  });

  it('renders author name in the row', () => {
    const item = makeItem('jira');
    render(<NotificationRow item={item} onClick={() => {}} />);
    expect(screen.getByText('by J.Smith')).toBeInTheDocument();
  });
});
