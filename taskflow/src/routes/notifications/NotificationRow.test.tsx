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
  it('renders ref, entity title, verb + comment text on line 2 and injected-now relative time', () => {
    const { container } = setup();
    expect(screen.getByText('PROJ-123')).toBeInTheDocument();
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
    expect(screen.getByText('commented')).toBeInTheDocument();
    const line2 = container.querySelector('[data-line="detail"]') as HTMLElement;
    expect(line2.textContent).toBe('commented The issue was caused by a race condition');
    expect(line2.className).toContain('truncate');
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
    // parent summary capped at 55% of the title area and shrinks before the title
    expect(screen.getByText('PROJ-123')).toBeInTheDocument();
    expect(parent.className).toContain('max-w-[55%]');
    expect(parent.className).toContain('flex-[0_100_auto]');
    expect(
      screen.getByRole('button', {
        name: 'Unread. Jane commented on PROJ-123 Fix tax rounding (in PROJ-100 Checkout redesign): The issue was caused by a race condition',
      }),
    ).toBeInTheDocument();
  });

  it('shows every change of an issue update inline, joined by a dot', () => {
    const { container, unmount } = setup({
      item: makeItem('jira', {
        notificationType: 'issue-update',
        bodyPreview: 'Priority: Minor \u2192 Major',
        fullBody: 'Priority: Minor \u2192 Major',
      }),
    });
    const line = container.querySelector('[data-line="detail"]') as HTMLElement;
    expect(line.dataset.detail).toBe('changes');
    expect(line.textContent).toBe('priority Minor \u2192 Major');
    unmount();
    const multi = setup({
      item: makeItem('jira', {
        notificationType: 'issue-update',
        bodyPreview:
          'Sprint: S12 \u2192 S13\nLabels: a \u2192 a b\nAssignee: (none) \u2192 Ben\nDescription: updated',
        fullBody: 'x',
      }),
    });
    expect(multi.container.querySelector('[data-line="detail"]')?.textContent).toBe(
      'sprint S12 \u2192 S13 \u00B7 labels +b \u00B7 assignee \u2192 Ben \u00B7 description edited',
    );
    expect(
      screen.getByRole('button', {
        name: 'Unread. Jane changed sprint from S12 to S13, labels +b, assignee to Ben, description edited on PROJ-123 Fix login bug',
      }),
    ).toBeInTheDocument();
  });

  it('GitLab description note reads "edited" like Jira', () => {
    const { container } = setup({
      item: makeItem('gitlab', {
        id: 'gitlab-system-5',
        notificationType: 'mr-note',
        bodyPreview: 'Description: updated',
      }),
    });
    expect(container.querySelector('[data-line="detail"]')?.textContent).toBe('description edited');
  });

  it('is a flat row: no group chrome (rail, chevron, count bubble, avatar stack)', () => {
    const { container } = setup();
    expect(container.querySelector('[data-thread-rail]')).toBeNull();
    expect(container.querySelector('[data-group-toggle]')).toBeNull();
    expect(container.querySelector('[data-group-more]')).toBeNull();
    expect(container.querySelector('[data-avatar-stack]')).toBeNull();
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
    expect(due.container.querySelector('[data-line="detail"]')?.textContent).toBe('due tomorrow');
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
    expect(container.querySelector('[data-line="detail"]')?.textContent).toBe(
      'status To Do \u2192 In Review',
    );
    expect(screen.getByText('To Do').className).toContain('rounded');
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

  it('every row has a bottom divider and a two-line density-aware height', () => {
    const { container } = setup();
    const r = container.firstElementChild as HTMLElement;
    expect(r.className).toContain('border-b');
    expect(r.className).toContain('border-border/60');
    expect(r.className).toContain('h-14');
    expect(r.className).toContain('density-compact:h-12');
    expect(r.className).toContain('density-comfortable:h-16');
  });

  it('pipeline failure shows the pipeline number and branch', () => {
    const { container } = setup({
      item: makeItem('gitlab', {
        notificationType: 'pipeline-failure',
        author: '',
        bodyPreview: 'Pipeline #4821 failed on feature/burnup',
        mrProjectId: 1,
        mrIid: 11,
      }),
    });
    expect(container.querySelector('[data-line="detail"]')?.textContent).toBe(
      'pipeline failed #4821 on feature/burnup',
    );
  });

  it('long comments are truncated in the aria label', () => {
    setup({
      item: makeItem('jira', {
        notificationType: 'comment-mention',
        bodyPreview: 'word '.repeat(80),
      }),
    });
    const label = screen.getByRole('button', { name: /^Unread\. Jane mentioned you/ });
    expect(label.getAttribute('aria-label')?.length).toBeLessThan(260);
    expect(label.getAttribute('aria-label')).toContain('\u2026');
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
    expect(container.querySelector('[data-line="detail"]')?.textContent).toBe(
      'commented Please rename this',
    );
  });

  it('GitLab system notes render as changes with their own icon, never "commented"', () => {
    const sys = (body: string) =>
      makeItem('gitlab', {
        id: 'gitlab-system-1',
        notificationType: 'mr-note',
        bodyPreview: body,
        entityTitle: 'Add export',
      });
    const cases: [string, string, string][] = [
      ['State: opened \u2192 merged', 'merged', 'merged'],
      ['State: opened \u2192 closed', 'closed', 'closed'],
      ['State: closed \u2192 reopened', 'reopened', 'reopened'],
      ['Review requested: ana, ben', 'review', 'review \u2192 ana, ben'],
      ['Labels added: x, y', 'labels', 'labels +x, y'],
      ['Target branch: a \u2192 b', 'branch', 'target branch a \u2192 b'],
      ['Labels added: x\nMilestone: v1', 'labels', 'labels +x \u00B7 milestone \u2192 v1'],
    ];
    for (const [body, kind, line] of cases) {
      const { container, unmount } = setup({ item: sys(body) });
      expect(container.querySelector(`[data-event-badge="${kind}"]`), body).not.toBeNull();
      expect(container.querySelector('[data-line="detail"]')?.textContent, body).toBe(line);
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

  it('assignment line 2 is just the verb', () => {
    const { container } = setup({
      item: makeItem('jira', { notificationType: 'issue-assignment' }),
    });
    const d = container.querySelector('[data-line="detail"]') as HTMLElement;
    expect(d.dataset.detail).toBe('verb');
    expect(d.textContent).toBe('assigned you');
  });
});
