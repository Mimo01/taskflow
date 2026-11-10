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
    const { container } = setup();
    expect(screen.getByText('PROJ-123')).toBeInTheDocument();
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
    expect(screen.getByText('commented')).toBeInTheDocument();
    // comment text lives in the detail column
    expect(container.querySelector('[data-col="detail"]')?.textContent).toContain('race condition');
    expect(screen.getByText('2h')).toBeInTheDocument();
  });

  it('never wraps the issue key (nowrap, column grows instead of breaking)', () => {
    setup();
    const key = screen.getByRole('button', { name: 'PROJ-123' });
    expect(key.className).toContain('whitespace-nowrap');
    expect(key.className).toContain('flex-none');
    expect(key.className).not.toMatch(/(^|\s)w-\[/);
  });

  it('does not render fullBody outside the tooltip', () => {
    setup();
    expect(screen.queryByText(/in the auth flow/)).not.toBeInTheDocument();
  });

  it('renders the parent before the title and names it in the aria label', () => {
    const { container } = setup({
      item: makeItem('jira', {
        entityTitle: 'PROJ-123: Fix tax rounding',
        parentKey: 'PROJ-100',
        parentSummary: 'Checkout redesign',
      }),
    });
    const parent = container.querySelector('[data-parent]') as HTMLElement;
    expect(parent.textContent).not.toContain('PROJ-100');
    expect(parent.textContent).toContain('Checkout redesign');
    expect(parent.textContent).toContain('\u203A');
    // subtask key stays in the fixed key column, parent summary capped at 55% of the title area
    expect(screen.getByText('PROJ-123')).toBeInTheDocument();
    expect(parent.className).toContain('max-w-[55%]');
    expect(
      screen.getByRole('button', {
        name: 'Unread. Jane commented on PROJ-123 Fix tax rounding (in PROJ-100 Checkout redesign)',
      }),
    ).toBeInTheDocument();
  });

  it('shows what changed for an issue update, with +N more', () => {
    const { container, unmount } = setup({
      item: makeItem('jira', {
        notificationType: 'issue-update',
        bodyPreview: 'Priority: Minor \u2192 Major',
        fullBody: 'Priority: Minor \u2192 Major',
      }),
    });
    expect(container.querySelector('[data-col="what"]')?.textContent).toBe('priority');
    const tail = container.querySelector('[data-col="detail"]') as HTMLElement;
    expect(tail.dataset.detail).toBe('change');
    expect(tail.textContent).toContain('Minor');
    expect(tail.textContent).toContain('Major');
    unmount();
    const multi = setup({
      item: makeItem('jira', {
        notificationType: 'issue-update',
        bodyPreview: 'Sprint: S12 \u2192 S13\nLabels: a \u2192 a b\nDescription: updated',
        fullBody: 'x',
      }),
    });
    expect(multi.container.querySelector('[data-col="what"]')?.textContent).toBe('sprint');
    const t2 = multi.container.querySelector('[data-col="detail"]') as HTMLElement;
    expect(t2.textContent).toContain('+2');
    multi.unmount();
    const desc = setup({
      item: makeItem('jira', {
        notificationType: 'issue-update',
        bodyPreview: 'Description: updated',
        fullBody: 'x',
      }),
    });
    expect(desc.container.querySelector('[data-col="what"]')?.textContent).toBe('description');
    expect(desc.container.querySelector('[data-col="detail"]')?.textContent).toBe('edited');
  });

  it('grouped row has an always-on rail, a gutter chevron toggle and a +N bubble, no "events" text', () => {
    const onToggleExpand = vi.fn();
    const { container, rerender, ...h } = setup({ groupCount: 2, onToggleExpand });
    expect(screen.getByText('PROJ-123')).toBeInTheDocument();
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
    expect(screen.getByText('commented')).toBeInTheDocument();
    expect(container.querySelector('[data-event-badge]')).not.toBeNull();
    const chip = screen.getByRole('button', { name: 'Show 2 earlier events on PROJ-123' });
    expect(chip).toHaveAttribute('data-group-toggle');
    expect(container.querySelector('[data-thread-rail]')).not.toBeNull();
    expect(container.querySelector('[data-group-more]')?.textContent).toBe('+2');
    expect(container.textContent).not.toMatch(/events/);
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(chip);
    expect(onToggleExpand).toHaveBeenCalledTimes(1);
    expect(h.onOpen).not.toHaveBeenCalled();
    rerender(
      <NotificationRow
        item={makeItem('jira')}
        isUnread
        now={NOW}
        groupCount={2}
        expanded
        onToggleExpand={onToggleExpand}
        onOpen={h.onOpen}
        onToggleRead={h.onToggleRead}
        onDone={h.onDone}
      />,
    );
    const open = screen.getByRole('button', { name: 'Hide 2 earlier events on PROJ-123' });
    expect(open).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(container.querySelector('[data-group-more]') as HTMLElement);
    expect(onToggleExpand).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Mark group read' })).toBeInTheDocument();
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
    expect(due.container.querySelector('[data-col="what"]')?.textContent).toBe('due');
    expect(due.container.querySelector('[data-col="detail"]')?.textContent).toBe('tomorrow');
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
    expect(container.querySelector('[data-col="what"]')?.textContent).toBe('status');
    expect(container.querySelector('[data-detail="status"]')).not.toBeNull();
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

  it('has no div[role=button]', () => {
    const { container } = setup();
    expect(container.querySelectorAll('div[role="button"]').length).toBe(0);
  });

  it('scopes hover/focus ring + background changes to its own row (named group)', () => {
    const { container } = setup();
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('group/row');
    expect(root.className).not.toMatch(/(^|\s)group(\s|$)/);
    const badge = container.querySelector('[data-event-badge]') as HTMLElement;
    expect(badge.className).toContain('group-hover/row:ring-accent');
    expect(badge.className).not.toMatch(/(^|\s)group-hover:/);
    // badge stays inside the row box: small overhang only, no -1.5 spill into neighbours
    expect(badge.className).not.toContain('-bottom-1.5');
  });

  it('every row has a bottom divider; nested rows are tinted, railed and lighter', () => {
    const single = setup();
    const r1 = single.container.firstElementChild as HTMLElement;
    expect(r1.className).toContain('border-b');
    expect(r1.className).toContain('border-border/60');
    expect(r1.querySelector('[data-thread-rail]')).toBeNull();
    single.unmount();
    const nested = setup({ nested: true });
    const r2 = nested.container.firstElementChild as HTMLElement;
    expect(r2.className).toContain('border-border/30');
    expect(r2.className).toContain('bg-muted/40');
    expect(r2.querySelector('[data-thread-rail]')).not.toBeNull();
  });

  it('nested rows keep every column and show the entity title (muted) with the comment in detail', () => {
    const { container } = setup({
      nested: true,
      item: makeItem('jira', { notificationType: 'comment-mention', bodyPreview: 'ping @you' }),
    });
    expect(screen.getByText('Fix login bug').className).toContain('text-muted-foreground');
    expect(container.querySelector('[data-col="what"]')?.textContent).toBe('mentioned you');
    expect(container.querySelector('[data-col="detail"]')?.textContent).toBe('ping @you');
    expect(screen.getByText('PROJ-123')).toBeInTheDocument();
  });

  it('GitLab comment rows put the MR title in the title column and the text in detail', () => {
    const { container } = setup({
      item: makeItem('gitlab', {
        id: 'gitlab-note-9',
        notificationType: 'mr-note',
        entityTitle: 'PROJ-9: Add export',
        bodyPreview: 'Please rename **this**',
      }),
    });
    expect(screen.getByText('Add export')).toBeInTheDocument();
    expect(container.querySelector('[data-col="what"]')?.textContent).toBe('commented');
    expect(container.querySelector('[data-col="detail"]')?.textContent).toBe('Please rename this');
  });

  it('GitLab system notes render as changes with their own icon, never "commented"', () => {
    const sys = (body: string) =>
      makeItem('gitlab', {
        id: 'gitlab-system-1',
        notificationType: 'mr-note',
        bodyPreview: body,
        entityTitle: 'Add export',
      });
    const cases: [string, string, string, string][] = [
      ['State: opened \u2192 merged', 'merged', 'merged', ''],
      ['State: opened \u2192 closed', 'closed', 'closed', ''],
      ['State: closed \u2192 reopened', 'reopened', 'reopened', ''],
      ['Review requested: ana, ben', 'review', 'review', '\u2192ana, ben'],
      ['Labels added: x, y', 'labels', 'labels', '+x, y'],
      ['Target branch: a \u2192 b', 'target branch', 'branch', 'a\u2192b'],
    ];
    for (const [body, what, kind, detail] of cases) {
      const { container, unmount } = setup({ item: sys(body) });
      expect(container.querySelector('[data-col="what"]')?.textContent, body).toBe(what);
      expect(container.querySelector(`[data-event-badge="${kind}"]`), body).not.toBeNull();
      expect(container.querySelector('[data-col="detail"]')?.textContent, body).toBe(detail);
      expect(container.textContent).not.toContain('commented');
      unmount();
    }
  });

  it('issue updates get a per-field badge (priority, sprint, labels)', () => {
    for (const [field, kind] of [
      ['Priority', 'priority'],
      ['Sprint', 'sprint'],
      ['Labels', 'labels'],
      ['Fix Version', 'version'],
    ]) {
      const { container, unmount } = setup({
        item: makeItem('jira', {
          notificationType: 'issue-update',
          bodyPreview: `${field}: a \u2192 b`,
        }),
      });
      expect(container.querySelector(`[data-event-badge="${kind}"]`), field).not.toBeNull();
      unmount();
    }
  });

  it('group rows draw a 2-avatar stack when a second actor is given', () => {
    const { container } = setup({
      groupCount: 2,
      stackItem: makeItem('jira', { author: 'Bob Brown' }),
    });
    expect(container.querySelector('[data-avatar-stack="true"]')).not.toBeNull();
    expect(container.querySelector('[data-avatar-behind]')).not.toBeNull();
  });

  it('every row type renders what and detail columns (detail empty without values)', () => {
    const { container } = setup({
      item: makeItem('jira', { notificationType: 'issue-assignment' }),
    });
    expect(container.querySelector('[data-col="what"]')).not.toBeNull();
    const d = container.querySelector('[data-col="detail"]') as HTMLElement;
    expect(d.dataset.detail).toBe('empty');
    expect(d.textContent).toBe('');
  });
});
