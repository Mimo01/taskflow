import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NotificationItem } from '../../stores/notifications.store';
import NotificationList, { type NotificationListMotion } from './NotificationList';
import { NOTIF_EXIT_MS, NOTIF_SLIDE_MS } from './notification-motion';
import { buildEntries, type NotificationEntry, stackEntries } from './notification-view';

const NOW = new Date(2026, 10, 10, 15, 0).getTime();
const at = (h: number, min = 0) => new Date(2026, 10, 10, h, min).toISOString();

function item(id: string, key: string, createdAt: string): NotificationItem {
  return {
    id,
    source: 'jira',
    entityTitle: `${key}: Example`,
    author: 'Example Author',
    bodyPreview: 'Example body',
    fullBody: 'Example body',
    createdAt,
  };
}

// Flat list, newest first. Order: header, b (11:00), c (10:00), a (09:00)
const items = [
  item('a', 'PROJ-1', at(9)),
  item('b', 'PROJ-1', at(11)),
  item('c', 'PROJ-2', at(10)),
];

function entriesFor(list: NotificationItem[]) {
  return buildEntries({
    items: list,
    readSet: new Set(),
    source: 'all',
    unreadOnly: false,
    now: NOW,
  });
}

const stubRender = (entry: NotificationEntry) =>
  entry.kind === 'header' || entry.kind === 'stack-header' ? (
    <div>{entry.kind === 'header' ? entry.label : entry.id}</div>
  ) : (
    <div>
      <button type="button" data-entry-primary>
        {entry.id}
      </button>
      <input aria-label={`field-${entry.id}`} />
    </div>
  );

function setup(list = items) {
  const handlers = {
    onToggleRead: vi.fn(),
    onDone: vi.fn(),
    onToggleStack: vi.fn(),
  };
  const renderEntry = vi.fn(stubRender);
  const entries = entriesFor(list);
  const utils = render(
    <NotificationList entries={entries} renderEntry={renderEntry} {...handlers} />,
  );
  return { ...utils, handlers, renderEntry, entries };
}

const btn = (id: string) => screen.getByRole('button', { name: id });

describe('NotificationList rendering', () => {
  it('renders every entry in order with index and id attributes', () => {
    const { container, entries } = setup();
    const wrappers = container.querySelectorAll('[data-entry-index]');
    expect(wrappers).toHaveLength(entries.length);
    wrappers.forEach((w, i) => {
      expect(w.getAttribute('data-entry-index')).toBe(String(i));
      expect(w.getAttribute('data-entry-id')).toBe(entries[i].id);
    });
  });

  it('renders every entry (virtualized from the first frame; re-renders after measuring are fine)', () => {
    const { renderEntry, entries } = setup();
    const rendered = new Set(
      renderEntry.mock.calls.map((c: unknown[]) => (c[0] as { id: string }).id),
    );
    expect(rendered).toEqual(new Set(entries.map((e) => e.id)));
  });

  it('scroller has the expected classes', () => {
    const { container } = setup();
    const scroller = container.firstElementChild as HTMLElement;
    // Really scrolls: a min-h-0 flex-1 overflow-y-auto child of a max-height-capped flex column.
    for (const c of [
      'relative',
      'overflow-y-auto',
      'min-h-0',
      'flex-1',
      'select-none',
      '@container',
    ]) {
      expect(scroller.classList.contains(c)).toBe(true);
    }
    expect(scroller.className).not.toContain('max-h-[520px]');
    expect(scroller.className).not.toContain('bg-muted');
  });
});

describe('NotificationList keyboard', () => {
  it('ArrowDown with nothing focused focuses the first focusable entry, skipping headers', async () => {
    const { container } = setup();
    fireEvent.keyDown(container.firstElementChild as HTMLElement, { key: 'ArrowDown' });
    await waitFor(() => expect(btn('event:b')).toHaveFocus());
  });

  it('ArrowDown / j advance and ArrowUp / k go back; stays at the ends', async () => {
    const user = userEvent.setup();
    setup();
    btn('event:b').focus();
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(btn('event:c')).toHaveFocus());
    await user.keyboard('j');
    await waitFor(() => expect(btn('event:a')).toHaveFocus());
    await user.keyboard('k');
    await waitFor(() => expect(btn('event:c')).toHaveFocus());
    await user.keyboard('{ArrowUp}');
    await waitFor(() => expect(btn('event:b')).toHaveFocus());
    await user.keyboard('{ArrowUp}');
    await new Promise((r) => setTimeout(r, 50));
    expect(btn('event:b')).toHaveFocus();
    btn('event:a').focus();
    await user.keyboard('{ArrowDown}');
    await new Promise((r) => setTimeout(r, 50));
    expect(btn('event:a')).toHaveFocus();
  });

  it('u toggles read on an event', async () => {
    const user = userEvent.setup();
    const { handlers, entries } = setup();
    btn('event:c').focus();
    await user.keyboard('u');
    expect(handlers.onToggleRead).toHaveBeenCalledWith(entries.find((e) => e.id === 'event:c'));
  });

  it('WR-03: u in the Unread view (card disappears) keeps focus in the list', async () => {
    const user = userEvent.setup();
    const { handlers, rerender, entries } = setup();
    btn('event:c').focus();
    await user.keyboard('u');
    expect(handlers.onToggleRead).toHaveBeenCalledWith(entries.find((e) => e.id === 'event:c'));
    // Unread filter: the now-read card drops out of the list.
    const next = entriesFor(items.filter((i) => i.id !== 'c'));
    rerender(<NotificationList entries={next} renderEntry={stubRender} {...handlers} />);
    await waitFor(() => expect(btn(next[2].id)).toHaveFocus());
    // ...so triage keys keep working.
    await user.keyboard('k');
    await waitFor(() => expect(btn('event:b')).toHaveFocus());
  });

  it('u in the All view leaves focus on the same card', async () => {
    const user = userEvent.setup();
    const { handlers, rerender } = setup();
    btn('event:c').focus();
    await user.keyboard('u');
    rerender(
      <NotificationList entries={entriesFor(items)} renderEntry={stubRender} {...handlers} />,
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(btn('event:c')).toHaveFocus();
  });

  it('e and Delete call onDone; focus lands on the entry now at that position', async () => {
    const user = userEvent.setup();
    const { handlers, rerender, entries } = setup();
    btn('event:c').focus();
    await user.keyboard('e');
    expect(handlers.onDone).toHaveBeenCalledWith(entries.find((e) => e.id === 'event:c'));
    const next = entriesFor(items.filter((i) => i.id !== 'c'));
    rerender(<NotificationList entries={next} renderEntry={stubRender} {...handlers} />);
    // index 2 (where c was) now holds the entry that followed it
    const idx = next.findIndex((e) => e.kind !== 'header');
    expect(idx).toBeGreaterThanOrEqual(0);
    const expected = next[2];
    await waitFor(() => expect(btn(expected.id)).toHaveFocus());

    // Delete on the last entry focuses the previous one
    const user2 = userEvent.setup();
    const last = next[next.length - 1];
    btn(last.id).focus();
    await user2.keyboard('{Delete}');
    expect(handlers.onDone).toHaveBeenLastCalledWith(last);
    const shorter = next.slice(0, -1);
    rerender(<NotificationList entries={shorter} renderEntry={stubRender} {...handlers} />);
    await waitFor(() => expect(btn(shorter[shorter.length - 1].id)).toHaveFocus());
  });

  it('ArrowRight / ArrowLeft on a plain card do nothing (no stack to expand or collapse)', async () => {
    const user = userEvent.setup();
    const { container } = setup();
    btn('event:c').focus();
    const prevented: boolean[] = [];
    container.addEventListener('keydown', (e) => prevented.push(e.defaultPrevented));
    await user.keyboard('{ArrowRight}{ArrowLeft}');
    expect(prevented.every((p) => !p)).toBe(true);
    expect(btn('event:c')).toHaveFocus();
  });

  it('ignores keys typed in an input', async () => {
    const user = userEvent.setup();
    const { handlers } = setup();
    await user.click(screen.getByLabelText('field-event:c'));
    await user.keyboard('euj{Delete}{ArrowUp}');
    expect(handlers.onDone).not.toHaveBeenCalled();
    expect(handlers.onToggleRead).not.toHaveBeenCalled();
    expect(screen.getByLabelText('field-event:c')).toHaveFocus();
  });

  it('ignores keys with meta / ctrl / alt held', async () => {
    const user = userEvent.setup();
    const { handlers } = setup();
    btn('event:c').focus();
    await user.keyboard('{Meta>}{ArrowUp}{/Meta}');
    await user.keyboard('{Control>}u{/Control}');
    await user.keyboard('{Alt>}e{/Alt}');
    await new Promise((r) => setTimeout(r, 50));
    expect(btn('event:c')).toHaveFocus();
    expect(handlers.onToggleRead).not.toHaveBeenCalled();
    expect(handlers.onDone).not.toHaveBeenCalled();
  });

  it('does not handle Enter, Space or Escape on a plain card (default not prevented)', async () => {
    const user = userEvent.setup();
    const { handlers, container } = setup();
    btn('event:c').focus();
    const prevented: boolean[] = [];
    container.addEventListener('keydown', (e) => prevented.push(e.defaultPrevented));
    await user.keyboard('{Enter}{Escape}');
    expect(prevented.every((p) => !p)).toBe(true);
    expect(handlers.onDone).not.toHaveBeenCalled();
    expect(handlers.onToggleRead).not.toHaveBeenCalled();
    expect(handlers.onToggleStack).not.toHaveBeenCalled();
  });
});

describe('NotificationList stacks', () => {
  const ENTITY = 'jira:PROJ-1';
  const stacked = (expanded: string[] = []) => stackEntries(entriesFor(items), new Set(expanded));

  function setupStack(expanded: string[] = []) {
    const handlers = { onToggleRead: vi.fn(), onDone: vi.fn(), onToggleStack: vi.fn() };
    const entries = stacked(expanded);
    const utils = render(
      <NotificationList entries={entries} renderEntry={stubRender} {...handlers} />,
    );
    return { ...utils, handlers, entries };
  }

  it('lays out header, stack, event when collapsed', () => {
    const { entries } = setupStack();
    expect(entries.map((e) => e.id)).toEqual(['header:today', `stack:${ENTITY}`, 'event:c']);
  });

  it('Enter on a collapsed stack expands it and focus lands on the first member', async () => {
    const user = userEvent.setup();
    const { handlers, rerender } = setupStack();
    btn(`stack:${ENTITY}`).focus();
    await user.keyboard('{Enter}');
    expect(handlers.onToggleStack).toHaveBeenCalledWith(ENTITY);
    rerender(
      <NotificationList entries={stacked([ENTITY])} renderEntry={stubRender} {...handlers} />,
    );
    await waitFor(() => expect(btn('event:b')).toHaveFocus());
  });

  it('Space and ArrowRight also expand a collapsed stack', async () => {
    const user = userEvent.setup();
    const { handlers } = setupStack();
    btn(`stack:${ENTITY}`).focus();
    await user.keyboard(' ');
    await user.keyboard('{ArrowRight}');
    expect(handlers.onToggleStack).toHaveBeenCalledTimes(2);
    expect(handlers.onToggleStack).toHaveBeenCalledWith(ENTITY);
  });

  it('Escape / ArrowLeft inside an expanded stack collapse it and focus the stack', async () => {
    const user = userEvent.setup();
    const { handlers, rerender } = setupStack([ENTITY]);
    btn('event:a').focus();
    await user.keyboard('{Escape}');
    expect(handlers.onToggleStack).toHaveBeenCalledWith(ENTITY);
    rerender(<NotificationList entries={stacked()} renderEntry={stubRender} {...handlers} />);
    await waitFor(() => expect(btn(`stack:${ENTITY}`)).toHaveFocus());

    handlers.onToggleStack.mockClear();
    rerender(
      <NotificationList entries={stacked([ENTITY])} renderEntry={stubRender} {...handlers} />,
    );
    await waitFor(() => expect(btn('event:b')).toBeInTheDocument());
    btn('event:b').focus();
    await user.keyboard('{ArrowLeft}');
    expect(handlers.onToggleStack).toHaveBeenCalledWith(ENTITY);
  });

  it('Escape on a card outside any expanded stack is left alone', async () => {
    const user = userEvent.setup();
    const { handlers } = setupStack([ENTITY]);
    btn('event:c').focus();
    await user.keyboard('{Escape}');
    expect(handlers.onToggleStack).not.toHaveBeenCalled();
  });

  it('e, Delete and Backspace on a collapsed stack Done the whole stack entry', async () => {
    const user = userEvent.setup();
    const { handlers, entries } = setupStack();
    const stack = entries.find((e) => e.kind === 'stack');
    btn(`stack:${ENTITY}`).focus();
    await user.keyboard('e');
    await user.keyboard('{Delete}');
    await user.keyboard('{Backspace}');
    expect(handlers.onDone).toHaveBeenCalledTimes(3);
    expect(handlers.onDone).toHaveBeenCalledWith(stack);
  });

  it('Backspace Dones a plain card too (alias of e / Delete)', async () => {
    const user = userEvent.setup();
    const { handlers, entries } = setupStack();
    btn('event:c').focus();
    await user.keyboard('{Backspace}');
    expect(handlers.onDone).toHaveBeenCalledWith(entries.find((e) => e.id === 'event:c'));
  });

  it('u toggles read on the stack entry; the stack-header is not focusable', async () => {
    const user = userEvent.setup();
    const { handlers, entries } = setupStack();
    btn(`stack:${ENTITY}`).focus();
    await user.keyboard('u');
    expect(handlers.onToggleRead).toHaveBeenCalledWith(entries.find((e) => e.kind === 'stack'));
    const { container } = render(
      <NotificationList entries={stacked([ENTITY])} renderEntry={stubRender} {...handlers} />,
    );
    fireEvent.keyDown(container.firstElementChild as HTMLElement, { key: 'ArrowDown' });
    await waitFor(() =>
      expect(container.querySelector('[data-entry-primary]:focus')).not.toBeNull(),
    );
    expect(
      container.querySelector('[data-entry-id^="stack-header"] [data-entry-primary]'),
    ).toBeNull();
  });
});

describe('NotificationList motion (261111-m0g)', () => {
  const motion = (over: Partial<NotificationListMotion> = {}): NotificationListMotion => ({
    entering: new Set(),
    leaving: new Map(),
    flashing: new Set(),
    justExpanded: null,
    ...over,
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('turns motion state into attributes on the entry wrapper only', () => {
    const entries = entriesFor(items);
    const { container } = render(
      <NotificationList
        entries={entries}
        renderEntry={stubRender}
        onToggleRead={vi.fn()}
        onDone={vi.fn()}
        onToggleStack={vi.fn()}
        motion={motion({
          leaving: new Map([['event:c', 100]]),
          flashing: new Set(['event:b']),
          entering: new Set(['b']),
        })}
      />,
    );
    const w = (id: string) => container.querySelector(`[data-entry-id="${id}"]`) as HTMLElement;
    expect(w('event:c').getAttribute('data-leaving')).toBe('true');
    expect(w('event:c').style.getPropertyValue('--leave-delay')).toBe('100ms');
    expect(w('event:b').getAttribute('data-flash')).toBe('true');
    expect(w('event:b').getAttribute('data-entering')).toBe('true');
    expect(w('event:a').hasAttribute('data-leaving')).toBe(false);
  });

  it('collapses a leaving row height after the slide-out, keeping the node', () => {
    vi.useFakeTimers();
    const entries = entriesFor(items);
    const { container } = render(
      <NotificationList
        entries={entries}
        renderEntry={stubRender}
        onToggleRead={vi.fn()}
        onDone={vi.fn()}
        onToggleStack={vi.fn()}
        motion={motion({ leaving: new Map([['event:c', 0]]) })}
      />,
    );
    const row = container.querySelector('[data-entry-id="event:c"]') as HTMLElement;
    expect(row.style.height).toBe('');
    act(() => {
      vi.advanceTimersByTime(NOTIF_SLIDE_MS + 10);
    });
    expect(row.style.height).toBe('0px');
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(row.style.height).toBe('0px');
    expect(row.style.overflow).toBe('hidden');
    expect(row.isConnected).toBe(true);
  });

  it('a pending focus target expires if the entries never change (WR-06)', async () => {
    vi.useFakeTimers();
    const handlers = { onToggleRead: vi.fn(), onDone: vi.fn(), onToggleStack: vi.fn() };
    const entries = entriesFor(items);
    const { rerender } = render(
      <NotificationList entries={entries} renderEntry={stubRender} {...handlers} />,
    );
    btn('event:c').focus();
    fireEvent.keyDown(btn('event:c'), { key: 'e' });
    expect(handlers.onDone).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(NOTIF_EXIT_MS + 400);
    });
    // A much later, unrelated change must not steal focus to a stale index.
    (document.activeElement as HTMLElement).blur();
    rerender(
      <NotificationList entries={entries.slice(0, -1)} renderEntry={stubRender} {...handlers} />,
    );
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(document.body).toHaveFocus();
  });
});
