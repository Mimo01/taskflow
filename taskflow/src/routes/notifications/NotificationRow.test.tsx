import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
    // preview is a prefix of the longer full body -> ends with an ellipsis
    expect(line2.textContent).toBe(
      'Jane Smith commented The issue was caused by a race condition\u2026',
    );
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
        name: 'Unread. Jane commented on PROJ-123 Fix tax rounding (in PROJ-100 Checkout redesign): The issue was caused by a race condition\u2026',
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
    expect(line.textContent).toBe('Jane Smith changed priority Minor \u2192 Major');
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
      'Jane Smith updated 4 fields',
    );
    expect(
      screen.getByRole('button', {
        name: 'Unread. Jane changed assignee to Ben, sprint from S12 to S13, labels +b, description edited on PROJ-123 Fix login bug',
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
    expect(container.querySelector('[data-line="detail"]')?.textContent).toBe(
      'Jane Smith edited description',
    );
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
    expect(due.container.querySelector('[data-line="detail"]')?.textContent).toBe('Due tomorrow');
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
      'Jane Smith changed status To Do \u2192 In Review',
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

  it('is a rounded bordered card with density-aware padding, no divider', () => {
    const { container } = setup({ isUnread: false });
    const r = container.firstElementChild as HTMLElement;
    expect(r.className).toContain('rounded-xl');
    expect(r.className).toContain('border-border/60');
    expect(r.className).toContain('bg-card');
    expect(r.className).not.toMatch(/(^|\s)border-b(\s|$)/);
    expect(r.className).toContain('density-compact:py-1.5');
    expect(r.className).toContain('density-comfortable:py-3.5');
  });

  it('unread cards are tinted with a semibold title; read cards are plain', () => {
    const unread = setup({ isUnread: true });
    const u = unread.container.firstElementChild as HTMLElement;
    expect(u.className).toContain('bg-primary/[0.03]');
    expect(screen.getByText('Fix login bug').className).toContain('font-semibold');
    unread.unmount();
    const read = setup({ isUnread: false });
    const r = read.container.firstElementChild as HTMLElement;
    expect(r.className).not.toContain('bg-primary');
    expect(screen.getByText('Fix login bug').className).toContain('font-normal');
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
      'Pipeline failed #4821 on feature/burnup',
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
      'Jane Smith commented Please rename this',
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
      ['Review requested: ana, ben', 'review', 'changed review \u2192 ana, ben'],
      ['Labels added: x, y', 'labels', 'changed labels +x +y'],
      ['Target branch: a \u2192 b', 'branch', 'changed target branch a \u2192 b'],
      ['Labels added: x\nMilestone: v1', 'multi', 'updated 2 fields'],
    ];
    for (const [body, kind, line] of cases) {
      const { container, unmount } = setup({ item: sys(body) });
      expect(container.querySelector(`[data-event-badge="${kind}"]`), body).not.toBeNull();
      expect(container.querySelector('[data-line="detail"]')?.textContent, body).toBe(
        `Jane Smith ${line}`,
      );
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
    expect(d.textContent).toBe('Jane Smith assigned you');
  });

  describe('multi-change card', () => {
    const six = makeItem('jira', {
      notificationType: 'issue-update',
      bodyPreview:
        'Description: updated\nPriority: Minor \u2192 Major\nSprint: S12 \u2192 S13\nLabels: a \u2192 a perf\nStatus: To Do \u2192 In Progress\nAssignee: Ben \u2192 Cara',
      fullBody: 'x',
    });

    it('shows "updated N fields", the generic badge and a 3-row ordered change list', () => {
      const { container } = setup({ item: six });
      expect(container.querySelector('[data-event-badge="multi"]')).not.toBeNull();
      expect(container.querySelector('[data-line="detail"]')?.textContent).toBe(
        'Jane Smith updated 6 fields',
      );
      const rows = [...container.querySelectorAll('[data-change-row]')];
      expect(rows).toHaveLength(3);
      expect(rows.map((r) => r.textContent)).toEqual([
        'statusTo Do\u2192In Progress',
        'assigneeBen\u2192Cara',
        'priorityMinor\u2192Major',
      ]);
      expect(container.querySelector('[data-change-more]')?.textContent).toBe('+3 more changes');
      expect(screen.getByText('To Do').className).toContain('rounded');
    });

    it('renders label diffs as chips and omits the "more" row when it all fits', () => {
      const { container } = setup({
        item: makeItem('jira', {
          notificationType: 'issue-update',
          bodyPreview: 'Labels: wip \u2192 perf\nPriority: A \u2192 B',
        }),
      });
      expect(container.querySelector('[data-change-more]')).toBeNull();
      expect(screen.getByText('+perf').className).toContain('rounded');
      expect(screen.getByText('\u2212wip')).toBeInTheDocument();
    });
  });

  describe('merged conversation card', () => {
    const mk = (id: string, text: string, type: NotificationItem['notificationType']) =>
      makeItem('jira', {
        id,
        notificationType: type,
        author: 'Ben Carter',
        bodyPreview: text,
        fullBody: text,
      });
    const items = [
      mk('c3', 'Latest comment', 'jira-comment'),
      mk('c2', 'Middle', 'jira-comment'),
      mk('c1', 'First', 'jira-comment'),
    ];

    it('lists every comment (newest first) under the verb, with the aria summary', () => {
      const { container } = setup({ item: items[0], items });
      expect(screen.getByText('commented 3 times')).toBeInTheDocument();
      expect(container.querySelector('[data-line="detail"]')?.textContent).toBe(
        'Ben Carter commented 3 times',
      );
      const rows = [...container.querySelectorAll('[data-comment-row]')].map((r) => r.textContent);
      expect(rows).toHaveLength(3);
      expect(rows[0]).toContain('Latest comment');
      expect(rows[1]).toContain('Middle');
      expect(rows[2]).toContain('First');
      expect(container.querySelector('[data-comment-more]')).toBeNull();
      // one timestamp for the card (line 1), none per comment
      for (const r of container.querySelectorAll('[data-comment-row]')) {
        expect(r.textContent).not.toMatch(/\d+[mhdw]\b/);
      }
      expect(
        screen.getByRole('button', {
          name: 'Unread. Ben commented 3 times on PROJ-123 Fix login bug: Latest comment',
        }),
      ).toBeInTheDocument();
    });

    it('promotes to a mention when any item mentions the user', () => {
      const withMention = [items[0], mk('c2', '@you ping', 'comment-mention'), items[2]];
      const { container } = setup({ item: withMention[0], items: withMention });
      expect(container.querySelector('[data-event-badge="mention"]')).not.toBeNull();
      expect(container.querySelector('[data-line="detail"]')?.textContent).toContain(
        'Ben Carter mentioned you in 3 comments',
      );
    });

    it('caps the comment list at 3 with "+N more comments"', () => {
      const five = [
        ...items,
        mk('c0', 'Older', 'jira-comment'),
        mk('cz', 'Oldest', 'jira-comment'),
      ];
      const { container } = setup({ item: five[0], items: five });
      expect(container.querySelectorAll('[data-comment-row]')).toHaveLength(3);
      expect(container.querySelector('[data-comment-more]')?.textContent).toBe('+2 more comments');
    });
  });

  it('names the actor on line 2 (avatars alone do not say who)', () => {
    const { container } = setup();
    expect(container.querySelector('[data-actor]')?.textContent?.trim()).toBe('Jane Smith');
  });

  it('system events (pipeline, due) carry no actor name', () => {
    for (const notificationType of ['pipeline-failure', 'due-date-reminder'] as const) {
      const { container, unmount } = setup({
        item: makeItem('jira', { notificationType, bodyPreview: 'Due tomorrow' }),
      });
      expect(container.querySelector('[data-actor]'), notificationType).toBeNull();
      unmount();
    }
  });

  it('status pills get real padding (not squashed into the line)', () => {
    const { container } = setup({
      item: makeItem('jira', {
        notificationType: 'issue-update',
        bodyPreview: 'Status: To Do \u2192 In Review',
      }),
    });
    const pill = screen.getByText('In Review');
    expect(pill.className).toContain('h-4');
    expect(pill.className).toContain('px-1.5');
    expect(container.querySelector('[data-line="detail"]')?.className).toContain('h-5');
  });

  it('avatar inner circle fills its slot at every density (no egg shape)', () => {
    const { container } = setup();
    const slot = container.querySelector('[data-event-kind] > div');
    expect(slot?.className).toContain('[&>*]:size-full!');
  });

  describe('consistent card grammar', () => {
    const issue = (body: string) =>
      makeItem('jira', { notificationType: 'issue-update', bodyPreview: body });

    it('renders old/new the same way inline and in lists; list arrows share one grid column', () => {
      const single = setup({ item: issue('Priority: Minor \u2192 Major') });
      const inline = single.container.querySelector('[data-line="detail"] [data-value-change]');
      expect(inline?.textContent).toBe('Minor \u2192 Major');
      single.unmount();
      const multi = setup({
        item: issue(
          'Priority: Minor \u2192 Major\nSprint: Sprint 12 \u2192 S13\nFix Version: \u2192 1.14.0',
        ),
      });
      const list = multi.container.querySelector('[data-change-list]') as HTMLElement;
      // one grid: icon | field | old | arrow | new -> arrows align across rows
      expect(list.className).toContain('grid-cols-[auto_auto_auto_auto_minmax(0,1fr)]');
      expect(multi.container.querySelectorAll('[data-change-row]')).toHaveLength(3);
      expect(multi.container.querySelectorAll('[data-list-arrow]')).toHaveLength(3);
      const from = [...multi.container.querySelectorAll('[data-list-from]')].map(
        (e) => e.textContent,
      );
      expect(from).toEqual(['Minor', 'Sprint 12', 'none']);
    });

    it('signals an empty old value as "none" (none -> value), inline too', () => {
      const { container } = setup({ item: issue('Fix Version: \u2192 1.14.0') });
      expect(container.querySelector('[data-line="detail"] [data-value-change]')?.textContent).toBe(
        'none \u2192 1.14.0',
      );
    });

    it('review requests keep "→ people" without a "none" old side', () => {
      const { container } = setup({
        item: makeItem('gitlab', {
          id: 'gitlab-system-9',
          notificationType: 'mr-note',
          bodyPreview: 'Review requested: ana, ben',
        }),
      });
      expect(container.querySelector('[data-value-none]')).toBeNull();
    });

    it('status pills and label chips share one chip geometry, inline and in lists', () => {
      const a = setup({ item: issue('Status: To Do \u2192 In Review') });
      const pills = [...a.container.querySelectorAll('[data-chip]')];
      a.unmount();
      const b = setup({ item: issue('Status: To Do \u2192 Done\nLabels: a \u2192 a perf') });
      const all = [...pills, ...b.container.querySelectorAll('[data-chip]')];
      expect(all.length).toBeGreaterThanOrEqual(5);
      for (const chip of all) {
        for (const c of ['h-4', 'rounded', 'px-1.5', 'text-[11px]', 'font-medium']) {
          expect(chip.className).toContain(c);
        }
      }
    });

    it('change rows and comment rows share the list-row geometry and the more-row indent', () => {
      const ch = setup({
        item: issue('A: 1 \u2192 2\nB: 1 \u2192 2\nC: 1 \u2192 2\nD: 1 \u2192 2'),
      });
      const list = ch.container.querySelector('[data-change-list]') as HTMLElement;
      const row = ch.container.querySelector('[data-change-row]') as HTMLElement;
      const more = ch.container.querySelector('[data-change-more]') as HTMLElement;
      expect(row.hasAttribute('data-list-row')).toBe(true);
      expect(list.className).toContain('text-[11px]');
      expect(list.className).toContain('leading-5');
      expect((ch.container.querySelector('[data-list-field]') as HTMLElement).className).toContain(
        'h-5',
      );
      expect(more.className).toContain('pl-[1.125rem]');
      ch.unmount();
      const mk = (id: string, t: string) =>
        makeItem('jira', { id, bodyPreview: t, createdAt: '2026-03-11T10:00:00.000Z' });
      const comments = [mk('c1', 'one'), mk('c2', 'two'), mk('c3', 'three'), mk('c4', 'four')];
      const cm = setup({ item: comments[0], items: comments });
      const crow = cm.container.querySelector('[data-comment-row]') as HTMLElement;
      expect(crow.className).toContain('h-5');
      expect(crow.className).toContain('text-[11px]');
      expect(cm.container.querySelector('[data-comment-more]')?.className).toContain(
        'pl-[1.125rem]',
      );
    });

    it('has no hover tooltip on the card (all info is on the card itself)', () => {
      const src = readFileSync(resolve(__dirname, 'NotificationRow.tsx'), 'utf8');
      expect(src).not.toContain('data-notification-tooltip');
      expect(src).not.toContain('TooltipBody');
    });

    it('renders an empty value as a dashed "none" chip, distinct from real values', () => {
      const { container } = setup({ item: issue('Fix Version: \u2192 1.14.0') });
      const none = container.querySelector('[data-value-none]') as HTMLElement;
      expect(none.textContent).toBe('none');
      expect(none.className).toContain('border-dashed');
      expect(none.className).toContain('bg-transparent');
    });

    it('separates actor, action and detail with a real gap (space + margin)', () => {
      const { container } = setup();
      expect((container.querySelector('[data-actor]') as HTMLElement).className).toContain('mr-1');
      expect((container.querySelector('[data-detail-gap]') as HTMLElement).className).toContain(
        'ml-1',
      );
      expect(container.querySelector('[data-line="detail"]')?.textContent).toMatch(
        /^Jane Smith commented /,
      );
    });

    it('keeps the unread dot inside the card padding', () => {
      const { container } = setup();
      const dot = container.querySelector('[data-unread]') as HTMLElement;
      expect(dot.className).toMatch(/(^|\s)left-1\.5(\s|$)/);
      const card = container.querySelector('[data-card]') as HTMLElement;
      expect(card.className).toContain('pl-4');
    });

    it('read vs unread only toggles tint, border, title style and dot visibility', () => {
      const strip = (el: Element | null) =>
        (el?.className ?? '')
          .split(/\s+/)
          .filter(
            (c) =>
              !/^(bg-primary|dark:bg-primary|bg-card|border-border|font-|text-foreground|text-muted-foreground|opacity-0)/.test(
                c,
              ),
          )
          .join(' ');
      const unread = setup({ isUnread: true });
      const u = {
        card: strip(unread.container.querySelector('[data-card]')),
        detail: unread.container.querySelector('[data-line="detail"]')?.outerHTML,
        dot: strip(unread.container.querySelector('[data-unread]')),
      };
      unread.unmount();
      const read = setup({ isUnread: false });
      expect(strip(read.container.querySelector('[data-card]'))).toBe(u.card);
      expect(read.container.querySelector('[data-line="detail"]')?.outerHTML).toBe(u.detail);
      expect(strip(read.container.querySelector('[data-unread]'))).toBe(u.dot);
    });
  });
});
