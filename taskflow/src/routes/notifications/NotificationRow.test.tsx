import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NotificationItem } from '../../stores/notifications.store';
import NotificationRow, { StackCard, StackHeader } from './NotificationRow';

vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));

// Render-time person-avatar lookup needs a QueryClient + PAT; return the captured URL only.
vi.mock('./usePersonAvatar', () => ({
  usePersonAvatar: (_n: string, _s: string, _k: string | null, captured?: string) =>
    captured ?? null,
}));

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

/** textContent without the aria-hidden person-avatar initials (what a reader sees as words). */
function textOf(el: Element | null | undefined): string | undefined {
  if (!el) return undefined;
  const clone = el.cloneNode(true) as Element;
  for (const a of clone.querySelectorAll('[data-person] [aria-hidden="true"]')) a.remove();
  return clone.textContent ?? '';
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
    const key = screen.getByText('PROJ-123');
    expect(key.className).toContain('whitespace-nowrap');
    expect(key.className).toContain('flex-none');
    expect(key.className).not.toMatch(/(^|\s)w-\[/);
  });

  it('key sits inline with the title at the same size (no min-width column, no mono 11px)', () => {
    setup();
    const key = screen.getByText('PROJ-123');
    expect(key.className).toContain('text-xs');
    expect(key.className).not.toMatch(/min-w-\[/);
    expect(key.className).not.toContain('font-mono');
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

  it('marks unread via aria prefix and card flag; no dot element', () => {
    const { container, rerender, ...h } = setup();
    expect(screen.getByRole('button', { name: /^Unread\. .* on PROJ-123/ })).toBeInTheDocument();
    expect(container.querySelector('[data-unread-card="true"]')).not.toBeNull();
    expect(container.querySelector('[data-unread]')).toBeNull();
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
    expect(container.querySelector('[data-unread-card="false"]')).not.toBeNull();
    expect(container.querySelector('[data-unread]')).toBeNull();
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

  it('hover tray is a floating pill that slides in from the right (no gradient fade)', () => {
    const { container } = setup();
    const tray = container.querySelector('[data-tray]') as HTMLElement;
    for (const c of [
      'bg-card',
      'rounded-lg',
      'p-0.5',
      'translate-x-1.5',
      'group-hover/row:translate-x-0',
      'shadow-(--notif-hair)',
    ]) {
      expect(tray.className).toContain(c);
    }
    expect(tray.className).not.toContain('before:bg-linear-to-l');
    expect(tray.className).not.toContain('--card-hover');
  });

  it('initials avatar gets a lighter fill in dark mode', () => {
    const { container } = setup();
    const slot = container.querySelector('[data-event-kind] > div') as HTMLElement;
    expect(slot.className).toContain('dark:[&>div]:bg-foreground/20!');
  });

  it('the whole card shows a pointer cursor (it is all one click target)', () => {
    const { container } = setup();
    expect((container.querySelector('[data-card]') as HTMLElement).className).toContain(
      'cursor-pointer',
    );
  });

  it('overlay click calls onOpen once; the key is plain text, not its own link', () => {
    const { onOpen } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^Unread\./ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'PROJ-123' })).toBeNull();
    const key = screen.getByText('PROJ-123');
    expect(key.className).toContain('pointer-events-none');
    expect(key.className).not.toContain('hover:underline');
  });

  it('tray buttons call only their handler', () => {
    const { onOpen, onToggleRead, onDone, onOpenInBrowser } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
    expect(onToggleRead).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Open in browser' }));
    expect(onOpenInBrowser).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Clear notification' }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('Done is the corner X, not part of the hover tray; both only show on hover/focus of THIS card', () => {
    const { container } = setup();
    const x = screen.getByRole('button', { name: 'Clear notification' });
    expect(container.querySelector('[data-tray]')?.contains(x)).toBe(false);
    expect(container.querySelector('[data-tray]')?.textContent).toBe('');
    for (const el of [x, container.querySelector('[data-tray]') as HTMLElement]) {
      expect(el.className).toContain('opacity-0');
      expect(el.className).toContain('group-hover/row:opacity-100');
      expect(el.className).toContain('group-focus-within/row:opacity-100');
    }
    // sibling of the overlay button, round, fixed size so WebKit never collapses it
    expect(x.closest('[data-entry-primary]')).toBeNull();
    expect(x.className).toContain('rounded-full');
    expect(x.className).toContain('size-[22px]');
    expect(x.className).toContain('flex-none');
    // springs in from scale .6
    expect(x.className).toContain('scale-[.6]');
    expect(x.className).toContain('group-hover/row:scale-100');
    expect(x.className).toContain('ease-(--spring)');
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
    expect(root.className).toContain('hover:-translate-y-px');
    expect(root.className).toContain('active:scale-[.99]');
    expect(badge.className).not.toMatch(/(^|\s)group-hover:/);
    // badge stays inside the row box: small overhang only, no -1.5 spill into neighbours
    expect(badge.className).not.toContain('-bottom-1.5');
  });

  it('read cards are translucent (solid on hover), floating with --sh-rest, density-aware padding', () => {
    const { container } = setup({ isUnread: false });
    const r = container.firstElementChild as HTMLElement;
    expect(r.className).toContain('rounded-[14px]');
    expect(r.className).toContain('shadow-(--notif-sh-rest)');
    expect(r.className).toContain('hover:shadow-(--notif-sh-hover)');
    expect(r.className).toContain('bg-[color-mix(in_oklch,var(--color-card)_82%,transparent)]');
    expect(r.className).toContain('hover:bg-card');
    expect(r.className).not.toContain('bg-transparent');
    expect(r.className).not.toContain('ring-foreground');
    expect(r.className).not.toMatch(/(^|\s)border(\s|$)/);
    expect(r.className).toContain('density-compact:py-2');
    expect(r.className).toContain('density-comfortable:py-3.5');
    expect(r.className).toContain('px-3.5');
    expect(r.className).toContain('density-compact:px-3');
    expect(r.className).toContain('density-comfortable:px-4');
    expect(r.className).not.toContain('--card-hover');
  });

  it('Ledger: unread = solid card + bold title; read = translucent card + regular title, never dimmed', () => {
    const unread = setup({ isUnread: true });
    const u = unread.container.firstElementChild as HTMLElement;
    expect(u.className).toMatch(/(^|\s)bg-card(\s|$)/);
    expect(u.className).not.toContain('color-mix');
    expect(u.className).toContain('shadow-(--notif-sh-rest)');
    expect(screen.getByText('Fix login bug').className).toContain('font-semibold');
    // no halo anywhere: the badge is the only avatar decoration
    expect(unread.container.querySelector('[data-unread-halo]')).toBeNull();
    expect(unread.container.querySelector('time')?.className).toContain('text-muted-foreground');
    unread.unmount();
    const read = setup({ isUnread: false });
    const r = read.container.firstElementChild as HTMLElement;
    expect(r.className).toContain('color-mix');
    expect(r.className).not.toMatch(/(^|\s)opacity-|dark:opacity-/);
    expect(screen.getByText('Fix login bug').className).toContain('font-normal');
    expect(screen.getByText('Fix login bug').className).toContain('text-foreground');
    expect(screen.getByText('Fix login bug').className).not.toContain('muted');
    expect(read.container.querySelector('[data-event-kind]')?.className).not.toContain('opacity-');
    expect(read.container.querySelector('time')?.className).toContain('text-muted-foreground');
    expect(read.container.querySelector('[data-line="detail"]')?.className).not.toContain(
      'opacity',
    );
  });

  it('Ledger colour carrier: only actionable events colour the action phrase; plain updates are neutral', () => {
    const phrase = (item: NotificationItem, text: string) => {
      const { unmount } = setup({ item });
      const cls = screen.getByText(text).className;
      unmount();
      return cls;
    };
    // comment = plain, neutral
    expect(phrase(makeItem('jira'), 'commented')).not.toMatch(/text-(blue|violet|teal|red|amber)/);
    expect(phrase(makeItem('jira'), 'commented')).toContain('text-foreground');
    // mention / assignment / failure / due keep their colour
    expect(
      phrase(makeItem('jira', { notificationType: 'comment-mention' }), 'mentioned you'),
    ).toContain('text-violet-600');
    expect(
      phrase(
        makeItem('jira', { notificationType: 'issue-assignment', bodyPreview: '' }),
        'assigned you',
      ),
    ).toContain('text-teal-600');
    // status change = plain update: neutral
    const status = phrase(
      makeItem('jira', {
        notificationType: 'issue-update',
        bodyPreview: 'Status: To Do \u2192 In Review',
      }),
      'changed status',
    );
    expect(status).not.toMatch(/text-amber/);
  });

  it('Ledger avatar: neutral small badge, no event colour fill', () => {
    const { container } = setup({
      item: makeItem('jira', { notificationType: 'comment-mention' }),
    });
    const badge = container.querySelector('[data-event-badge]') as HTMLElement;
    expect(badge.className).toContain('bg-muted');
    expect(badge.className).toContain('text-muted-foreground');
    expect(badge.className).not.toMatch(/bg-(violet|blue)|text-white/);
  });

  it('quick action pill: sibling of the overlay, calls only its handler; absent without one', () => {
    const onClick = vi.fn();
    const { onOpen, container } = setup({ quick: { label: 'Reply', onClick } });
    const pill = screen.getByRole('button', { name: 'Reply' });
    expect(pill.className).toContain('rounded-full');
    expect(pill.className).toContain('relative');
    expect(pill.className).toContain('z-10');
    expect(container.querySelector('[data-entry-primary]')?.contains(pill)).toBe(false);
    fireEvent.click(pill);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('a card without a quick action adds no trailing row (height hugs content)', () => {
    const { container } = setup();
    expect(container.querySelector('[data-quick-action]')).toBeNull();
    const body = container.querySelector('[data-card] > div.flex.min-w-0') as HTMLElement;
    expect(body.lastElementChild?.getAttribute('data-line')).toBe('detail');
  });

  it('stack card: "+N", expand semantics on the overlay, two peek edges behind the card', () => {
    const { container, onOpen } = setup({ stackMore: 2 });
    expect(container.querySelector('[data-stack-more]')?.textContent).toBe('+2');
    const overlay = container.querySelector('[data-entry-primary]') as HTMLElement;
    expect(overlay.getAttribute('aria-expanded')).toBe('false');
    expect(overlay.getAttribute('aria-label')).toContain('2 more notifications');
    fireEvent.click(overlay);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('StackCard draws peek edges with surface + rest shadow that spread on hover, no extra height beyond pb-3', () => {
    const { container } = render(
      <StackCard>
        <div data-testid="top">card</div>
      </StackCard>,
    );
    const wrap = container.querySelector('[data-stack]') as HTMLElement;
    expect(wrap.className).toContain('relative');
    expect(wrap.className).toContain('pb-3');
    const edges = container.querySelectorAll('[data-stack-edge]');
    expect(edges).toHaveLength(2);
    for (const e of edges) {
      expect(e.className).toContain('bg-card');
      expect(e.className).toContain('shadow-(--notif-sh-rest)');
      expect(e.getAttribute('aria-hidden')).toBe('true');
      expect(e.className).toContain('pointer-events-none');
    }
    expect(wrap.className).toContain('group/stack');
    expect(container.querySelector('[data-stack-edge="1"]')?.className).toContain(
      'group-hover/stack:translate-y-[3px]',
    );
    expect(container.querySelector('[data-stack-edge="2"]')?.className).toContain(
      'group-hover/stack:translate-y-1.5',
    );
    expect(wrap.querySelector('[data-testid="top"]')).not.toBeNull();
  });

  it('StackHeader: ref + title, "Show less" and "Clear" call their handlers', () => {
    const onCollapse = vi.fn();
    const onClear = vi.fn();
    render(
      <StackHeader
        entityRef="PROJ-11"
        title="Fix login bug"
        onCollapse={onCollapse}
        onClear={onClear}
      />,
    );
    expect(screen.getByText('PROJ-11')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onCollapse).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
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
      ['Review requested: ana, ben', 'review', 'requested review from ana, ben'],
      ['Labels added: x, y', 'labels', 'added labels x y'],
      ['Target branch: a \u2192 b', 'branch', 'changed target branch a \u2192 b'],
      ['Labels added: x\nMilestone: v1', 'multi', 'updated 2 fields'],
    ];
    for (const [body, kind, line] of cases) {
      const { container, unmount } = setup({ item: sys(body) });
      expect(container.querySelector(`[data-event-badge="${kind}"]`), body).not.toBeNull();
      expect(textOf(container.querySelector('[data-line="detail"]')), body).toBe(
        `Jane Smith ${line}`,
      );
      expect(container.textContent).not.toContain('commented');
      unmount();
    }
  });

  it('CR-02: a multi-word GitLab label renders as one chip', () => {
    const { container } = setup({
      item: makeItem('gitlab', {
        id: 'gitlab-system-1',
        notificationType: 'mr-note',
        bodyPreview: 'Labels added: needs review, bug',
        entityTitle: 'Add export',
      }),
    });
    const chips = [...container.querySelectorAll('[data-chip="label"]')].map((c) =>
      c.textContent?.replace(/\u00A0/g, ' '),
    );
    expect(chips).toEqual(['needs review', 'bug']);
    expect(container.querySelector('[data-line="detail"]')?.textContent).toContain('added labels');
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

    it('shows "updated N fields", the generic badge and every change (6 <= 10) in order', () => {
      const { container } = setup({ item: six });
      expect(container.querySelector('[data-event-badge="multi"]')).not.toBeNull();
      expect(container.querySelector('[data-line="detail"]')?.textContent).toBe(
        'Jane Smith updated 6 fields',
      );
      const rows = [...container.querySelectorAll('[data-change-row]')];
      expect(rows).toHaveLength(6);
      expect(rows.slice(0, 3).map((r) => textOf(r))).toEqual([
        'statusTo Do\u2192In Progress',
        'assigneeBen\u2192Cara',
        'priorityMinor\u2192Major',
      ]);
      expect(container.querySelector('[data-change-more]')).toBeNull();
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

    it('shows up to 10 comments; 12 -> 9 + "+3 more comments"', () => {
      const many = (n: number) =>
        Array.from({ length: n }, (_, i) => mk(`c${i}`, `Comment ${i}`, 'jira-comment'));
      const ten = setup({ item: many(10)[0], items: many(10) });
      expect(ten.container.querySelectorAll('[data-comment-row]')).toHaveLength(10);
      expect(ten.container.querySelector('[data-comment-more]')).toBeNull();
      ten.unmount();
      const twelve = many(12);
      const { container } = setup({ item: twelve[0], items: twelve });
      expect(container.querySelectorAll('[data-comment-row]')).toHaveLength(9);
      expect(container.querySelector('[data-comment-more]')?.textContent).toBe('+3 more comments');
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

  /** n distinct "Field: 1 -> 2" change lines. */
  const changeLines = (n: number) =>
    Array.from({ length: n }, (_, i) => `Field${i}: 1 \u2192 2`).join('\n');

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

    it('one-sided single change says "added"/"removed" instead of none -> value', () => {
      const add = setup({ item: issue('Fix Version: \u2192 1.14.0') });
      expect(add.container.querySelector('[data-line="detail"]')?.textContent).toBe(
        'Jane Smith added fix version 1.14.0',
      );
      expect(add.container.querySelector('[data-value-none]')).toBeNull();
      add.unmount();
      const rm = setup({ item: issue('Component: Backend \u2192 (none)') });
      expect(rm.container.querySelector('[data-line="detail"]')?.textContent).toBe(
        'Jane Smith removed component Backend',
      );
      expect(rm.container.querySelector('[data-value-removed]')).not.toBeNull();
      rm.unmount();
      const who = setup({ item: issue('Assignee: (none) \u2192 Ben Carter') });
      expect(textOf(who.container.querySelector('[data-line="detail"]'))).toBe(
        'Jane Smith assigned Ben Carter',
      );
    });

    it('two-sided single change keeps "changed field old -> new"', () => {
      const { container } = setup({ item: issue('Priority: Minor \u2192 Major') });
      expect(container.querySelector('[data-line="detail"]')?.textContent).toBe(
        'Jane Smith changed priority Minor \u2192 Major',
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

    it('status pills share a min width with centred text; label chips and none size to content', () => {
      const a = setup({ item: issue('Status: To Do \u2192 In Review') });
      const inline = [...a.container.querySelectorAll('[data-chip="status"]')];
      expect(inline).toHaveLength(2);
      a.unmount();
      const b = setup({
        item: issue(
          'Status: To Do \u2192 Done\nLabels: a \u2192 a perf\nFix Version: \u2192 1.14.0',
        ),
      });
      const listed = [...b.container.querySelectorAll('[data-change-list] [data-chip="status"]')];
      expect(listed).toHaveLength(2);
      for (const pill of [...inline, ...listed]) {
        expect(pill.className).toContain('min-w-[5rem]');
        expect(pill.className).toContain('justify-center');
      }
      const labels = [...b.container.querySelectorAll('[data-chip="label"]')];
      expect(labels.length).toBeGreaterThan(0);
      for (const chip of labels) expect(chip.className).not.toContain('min-w-');
      expect(b.container.querySelector('[data-value-none]')?.className).not.toContain('min-w-');
    });

    it('change rows and comment rows share the list-row geometry and the more-row indent', () => {
      const ch = setup({ item: issue(changeLines(12)) });
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
      const comments = Array.from({ length: 12 }, (_, i) => mk(`c${i}`, `comment ${i}`));
      const cm = setup({ item: comments[0], items: comments });
      const crow = cm.container.querySelector('[data-comment-row]') as HTMLElement;
      expect(crow.className).toContain('h-5');
      expect(crow.className).toContain('text-[11px]');
      expect(cm.container.querySelector('[data-comment-more]')?.className).toContain(
        'pl-[1.125rem]',
      );
    });

    it('shows up to 10 rows: 10 items in full, 11 -> 9 + "+2 more" (never "+1 more")', () => {
      const ten = setup({ item: issue(changeLines(10)) });
      expect(ten.container.querySelectorAll('[data-change-row]')).toHaveLength(10);
      expect(ten.container.querySelector('[data-change-more]')).toBeNull();
      ten.unmount();
      const eleven = setup({ item: issue(changeLines(11)) });
      expect(eleven.container.querySelectorAll('[data-change-row]')).toHaveLength(9);
      expect(eleven.container.querySelector('[data-change-more]')?.textContent).toBe(
        '+2 more changes',
      );
    });

    it('has no hover tooltip on the card (all info is on the card itself)', () => {
      const src = readFileSync(resolve(__dirname, 'NotificationRow.tsx'), 'utf8');
      expect(src).not.toContain('data-notification-tooltip');
      expect(src).not.toContain('TooltipBody');
    });

    it('renders an empty value as a dashed "none" chip, distinct from real values', () => {
      // multi-change lists keep "none -> value" so the arrow column stays aligned
      const { container } = setup({
        item: issue('Fix Version: \u2192 1.14.0\nPriority: Minor \u2192 Major'),
      });
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

    it('has no unread dot and symmetric padding', () => {
      const { container } = setup();
      expect(container.querySelector('[data-unread]')).toBeNull();
      const card = container.querySelector('[data-card]') as HTMLElement;
      expect(card.className).toContain('px-3');
      expect(card.className).not.toMatch(/(^|\s)(pl-|pr-)/);
    });

    it('badge cut-out ring follows the card surface', () => {
      const { container } = setup();
      const badge = container.querySelector('[data-event-badge]') as HTMLElement;
      expect(badge.className).toContain('ring-card');
    });

    it('the avatar springs to 1.06 on card hover', () => {
      const { container } = setup();
      const lead = container.querySelector('[data-event-kind]') as HTMLElement;
      expect(lead.className).toContain('group-hover/row:scale-[1.06]');
      expect(lead.className).toContain('ease-(--spring)');
    });

    it('read vs unread only toggles surface tint, ring and title style', () => {
      const strip = (el: Element | null) =>
        (el?.className ?? '')
          .split(/\s+/)
          .filter(
            (c) =>
              !/^(bg-primary|dark:bg-primary|bg-card|bg-\[color-mix|hover:bg-card|focus-within:bg-card|dark:bg-card|bg-transparent|border-border|shadow-|ring-|dark:ring-|font-|text-foreground|text-muted-foreground|opacity-0)/.test(
                c,
              ),
          )
          .join(' ');
      const unread = setup({ isUnread: true });
      const u = {
        card: strip(unread.container.querySelector('[data-card]')),
        detail: unread.container.querySelector('[data-line="detail"]')?.outerHTML,
      };
      unread.unmount();
      const read = setup({ isUnread: false });
      expect(strip(read.container.querySelector('[data-card]'))).toBe(u.card);
      expect(read.container.querySelector('[data-line="detail"]')?.outerHTML).toBe(u.detail);
    });
  });
  describe('person avatars (261111-e1w)', () => {
    const issue = (body: string, extra?: Partial<NotificationItem>) =>
      makeItem('jira', { notificationType: 'issue-update', bodyPreview: body, ...extra });
    const sys = (body: string, extra?: Partial<NotificationItem>) =>
      makeItem('gitlab', {
        id: 'gitlab-system-1',
        notificationType: 'mr-note',
        bodyPreview: body,
        ...extra,
      });
    const people = (el: Element | null | undefined) =>
      [...(el?.querySelectorAll('[data-person]') ?? [])].map((p) => textOf(p));

    it('Jira assignee change: avatar before each name, image when captured, initials otherwise', () => {
      const { container } = setup({
        item: issue('Assignee: Ann Lee → Bo Chen', {
          personAvatars: { 'Bo Chen': 'https://x/bo.png' },
        }),
      });
      const line = container.querySelector('[data-line="detail"]');
      const ps = [...(line?.querySelectorAll('[data-person]') ?? [])];
      expect(ps.map((p) => textOf(p))).toEqual(['Ann Lee', 'Bo Chen']);
      // avatar comes first, then the name
      for (const p of ps) {
        expect(p.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
        expect(p.lastChild?.textContent).toBe(textOf(p));
      }
      expect(ps[0].querySelector('[role="img"]')?.textContent).toBe('AL');
      expect(ps[0].querySelector('img')).toBeNull();
      expect(textOf(line)).toBe('Jane Smith changed assignee Ann Lee → Bo Chen');
    });

    it('unassigned: from side has an avatar, the none chip does not', () => {
      const { container } = setup({ item: issue('Assignee: Ann Lee → (none)') });
      const line = container.querySelector('[data-line="detail"]');
      expect(people(line)).toEqual(['Ann Lee']);
      const none = container.querySelectorAll('[data-value-none]');
      for (const n of none) expect(n.querySelector('[data-person]')).toBeNull();
    });

    it('GitLab review request: one avatar per username, separated by ", "', () => {
      const { container } = setup({ item: sys('Review requested: alice, bob') });
      const line = container.querySelector('[data-line="detail"]');
      expect(people(line)).toEqual(['alice', 'bob']);
      expect(textOf(line)).toBe('Jane Smith requested review from alice, bob');
    });

    it('GitLab unassigned: sign then a person avatar', () => {
      const { container } = setup({
        item: sys('Unassigned: alice\nLabels added: x'),
      });
      const row = [...container.querySelectorAll('[data-change-row]')].find((r) =>
        r.textContent?.includes('alice'),
      );
      const value = row?.querySelector('[data-list-value]');
      expect(people(value)).toEqual(['alice']);
      expect(textOf(value)).toBe('−alice');
    });

    it('Jira names with a comma are one person (never split)', () => {
      const { container } = setup({ item: issue('Assignee: (none) → Smith, John') });
      expect(people(container.querySelector('[data-line="detail"]'))).toEqual(['Smith, John']);
    });

    it('non-person fields render no person avatar', () => {
      const { container } = setup({
        item: issue('Priority: Minor → Major\nSprint: S1 → S2\nStatus: To Do → Done'),
      });
      expect(container.querySelector('[data-person]')).toBeNull();
    });

    it('reporter row in a change list carries avatars in its from/to cells and keeps h-5', () => {
      const { container } = setup({
        item: issue('Reporter: Ann Lee → Bo Chen\nPriority: Minor → Major'),
      });
      const row = [...container.querySelectorAll('[data-change-row]')].find(
        (r) => r.querySelector('[data-list-field]')?.textContent === 'reporter',
      );
      const from = row?.querySelector('[data-list-from]');
      const to = row?.querySelector('[data-list-value]');
      expect(people(from)).toEqual(['Ann Lee']);
      expect(people(to)).toEqual(['Bo Chen']);
      expect(from?.className).toContain('h-5');
      expect(to?.className).toContain('h-5');
    });

    it('merged cards look avatars up across every item', () => {
      const newer = issue('Priority: Minor → Major', { id: 'a', personAvatars: undefined });
      const older = issue('Assignee: (none) → Bo Chen', {
        id: 'b',
        personAvatars: { 'Bo Chen': 'https://x/bo.png' },
      });
      const { container } = setup({ item: newer, items: [newer, older] });
      expect(people(container)).toContain('Bo Chen');
    });
  });
});
