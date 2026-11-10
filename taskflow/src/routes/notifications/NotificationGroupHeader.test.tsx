import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NotificationItem } from '../../stores/notifications.store';
import NotificationGroupHeader from './NotificationGroupHeader';
import { buildEntries, type GroupEntry } from './notification-view';

vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));

const NOW = new Date('2026-03-11T12:00:00.000Z').getTime();

function makeItem(id: string, createdAt: string, overrides?: Partial<NotificationItem>) {
  return {
    id,
    source: 'jira',
    entityTitle: 'PROJ-123: Fix login bug',
    author: 'Jane Smith',
    bodyPreview: 'something happened',
    fullBody: 'something happened',
    createdAt,
    notificationType: 'jira-comment',
    ...overrides,
  } as NotificationItem;
}

function makeGroup(opts?: {
  read?: string[];
  expandOverrides?: Record<string, boolean>;
  items?: NotificationItem[];
}): GroupEntry {
  const items = opts?.items ?? [
    makeItem('a', '2026-03-11T10:00:00.000Z'),
    makeItem('b', '2026-03-11T09:00:00.000Z', { author: 'Bob Jones' }),
  ];
  const entries = buildEntries({
    items,
    readSet: new Set(opts?.read ?? []),
    source: 'all',
    unreadOnly: false,
    expandOverrides: opts?.expandOverrides ?? {},
    now: NOW,
  });
  const g = entries.find((e): e is GroupEntry => e.kind === 'group');
  if (!g) throw new Error('no group built');
  return g;
}

function setup(group: GroupEntry = makeGroup()) {
  const h = {
    onOpen: vi.fn(),
    onToggleExpanded: vi.fn(),
    onToggleRead: vi.fn(),
    onDone: vi.fn(),
  };
  render(<NotificationGroupHeader group={group} now={NOW} {...h} />);
  return h;
}

describe('NotificationGroupHeader', () => {
  it('renders ref, title, +N chip and relative time', () => {
    setup();
    expect(screen.getByText('PROJ-123')).toBeInTheDocument();
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.queryByText('JS')).not.toBeInTheDocument();
    expect(screen.getByText('2h')).toBeInTheDocument();
  });

  it('chevron reflects expanded state and only toggles expansion', () => {
    const h = setup(makeGroup({ expandOverrides: { 'jira:PROJ-123': false } }));
    const chevron = screen.getByRole('button', { name: 'Expand PROJ-123' });
    expect(chevron).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(chevron);
    expect(h.onToggleExpanded).toHaveBeenCalledTimes(1);
    expect(h.onOpen).not.toHaveBeenCalled();
  });

  it('shows Collapse when expanded', () => {
    setup();
    const chevron = screen.getByRole('button', { name: 'Collapse PROJ-123' });
    expect(chevron).toHaveAttribute('aria-expanded', 'true');
  });

  it('overlay click opens and carries data-entry-primary', () => {
    const h = setup();
    const overlay = screen.getByRole('button', {
      name: /^Unread\. PROJ-123 Fix login bug, 2 updates/,
    });
    expect(overlay).toHaveAttribute('data-entry-primary');
    fireEvent.click(overlay);
    expect(h.onOpen).toHaveBeenCalledTimes(1);
  });

  it('unread group offers "Mark group read"; tray buttons do not open', () => {
    const h = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Mark group read' }));
    expect(h.onToggleRead).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(h.onDone).toHaveBeenCalledTimes(1);
    expect(h.onOpen).not.toHaveBeenCalled();
  });

  it('fully read group offers "Mark group unread"', () => {
    const h = setup(makeGroup({ read: ['a', 'b'], expandOverrides: { 'jira:PROJ-123': false } }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark group unread' }));
    expect(h.onToggleRead).toHaveBeenCalledTimes(1);
  });

  it('renders a state pill for GitLab MRs only', () => {
    const mr = (id: string, at: string, state: 'merged' | 'opened' | 'closed') =>
      makeItem(id, at, {
        source: 'gitlab',
        entityTitle: 'Add feature',
        mrProjectId: 7,
        mrIid: 34,
        entityState: state,
        notificationType: 'mr-note',
      });
    const { unmount } = render(
      <NotificationGroupHeader
        group={makeGroup({
          items: [
            mr('x', '2026-03-11T10:00:00.000Z', 'merged'),
            mr('y', '2026-03-11T09:00:00.000Z', 'merged'),
          ],
        })}
        now={NOW}
        onOpen={() => {}}
        onToggleExpanded={() => {}}
        onToggleRead={() => {}}
        onDone={() => {}}
      />,
    );
    expect(screen.getByText('Merged')).toBeInTheDocument();
    expect(screen.getByText('!34')).toBeInTheDocument();
    unmount();

    for (const [state, label] of [
      ['opened', 'Open'],
      ['closed', 'Closed'],
    ] as const) {
      const r = render(
        <NotificationGroupHeader
          group={makeGroup({
            items: [
              mr('x', '2026-03-11T10:00:00.000Z', state),
              mr('y', '2026-03-11T09:00:00.000Z', state),
            ],
          })}
          now={NOW}
          onOpen={() => {}}
          onToggleExpanded={() => {}}
          onToggleRead={() => {}}
          onDone={() => {}}
        />,
      );
      expect(screen.getByText(label)).toBeInTheDocument();
      r.unmount();
    }
  });

  it('renders no pill for a Jira group', () => {
    setup();
    expect(screen.queryByText('Merged')).not.toBeInTheDocument();
    expect(screen.queryByText('Open')).not.toBeInTheDocument();
    expect(screen.queryByText('Closed')).not.toBeInTheDocument();
  });

  it('title is font-medium only when unread', () => {
    setup();
    expect(screen.getByText('Fix login bug').className).toContain('font-medium');
  });

  it('read title is muted without font-medium', () => {
    setup(makeGroup({ read: ['a', 'b'] }));
    const title = screen.getByText('Fix login bug');
    expect(title.className).not.toContain('font-medium');
    expect(title.className).toContain('text-muted-foreground');
  });
});
