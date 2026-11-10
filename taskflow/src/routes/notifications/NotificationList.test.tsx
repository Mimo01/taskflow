import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { NotificationItem } from '../../stores/notifications.store';
import NotificationList from './NotificationList';
import { buildEntries, type NotificationEntry } from './notification-view';

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

// group PROJ-1 (a, b; newest b is the group row, a is the earlier child), single PROJ-2 (c).
// Expanded order: header, group, a, c
const items = [
  item('a', 'PROJ-1', at(9)),
  item('b', 'PROJ-1', at(11)),
  item('c', 'PROJ-2', at(10)),
];

function entriesFor(list: NotificationItem[], expandOverrides: Record<string, boolean> = {}) {
  return buildEntries({
    items: list,
    readSet: new Set(),
    source: 'all',
    unreadOnly: false,
    expandOverrides,
    now: NOW,
  });
}

const stubRender = (entry: NotificationEntry) =>
  entry.kind === 'header' ? (
    <div>{entry.label}</div>
  ) : (
    <div>
      <button type="button" data-entry-primary>
        {entry.id}
      </button>
      <input aria-label={`field-${entry.id}`} />
    </div>
  );

function setup(list = items, expandOverrides: Record<string, boolean> = { 'jira:PROJ-1': true }) {
  const handlers = {
    onToggleRead: vi.fn(),
    onDone: vi.fn(),
    onSetExpanded: vi.fn(),
  };
  const renderEntry = vi.fn(stubRender);
  const entries = entriesFor(list, expandOverrides);
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

  it('calls renderEntry once per entry', () => {
    const { renderEntry, entries } = setup();
    expect(renderEntry).toHaveBeenCalledTimes(entries.length);
  });

  it('scroller has the expected classes', () => {
    const { container } = setup();
    const scroller = container.firstElementChild as HTMLElement;
    for (const c of ['relative', 'overflow-y-auto', 'max-h-[520px]', '@container']) {
      expect(scroller.classList.contains(c)).toBe(true);
    }
  });
});

describe('NotificationList keyboard', () => {
  it('ArrowDown with nothing focused focuses the first focusable entry, skipping headers', async () => {
    const { container } = setup();
    fireEvent.keyDown(container.firstElementChild as HTMLElement, { key: 'ArrowDown' });
    await waitFor(() => expect(btn('group:jira:PROJ-1')).toHaveFocus());
  });

  it('ArrowDown / j advance and ArrowUp / k go back; stays at the ends', async () => {
    const user = userEvent.setup();
    setup();
    btn('group:jira:PROJ-1').focus();
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(btn('event:a')).toHaveFocus());
    await user.keyboard('j');
    await waitFor(() => expect(btn('event:c')).toHaveFocus());
    await user.keyboard('k');
    await waitFor(() => expect(btn('event:a')).toHaveFocus());
    await user.keyboard('{ArrowUp}');
    await waitFor(() => expect(btn('group:jira:PROJ-1')).toHaveFocus());
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(btn('event:a')).toHaveFocus());
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(btn('event:c')).toHaveFocus());
    await user.keyboard('{ArrowDown}');
    await new Promise((r) => setTimeout(r, 50));
    expect(btn('event:c')).toHaveFocus();
  });

  it('u toggles read on an event and on a group', async () => {
    const user = userEvent.setup();
    const { handlers, entries } = setup();
    btn('event:c').focus();
    await user.keyboard('u');
    expect(handlers.onToggleRead).toHaveBeenCalledWith(entries.find((e) => e.id === 'event:c'));
    btn('group:jira:PROJ-1').focus();
    await user.keyboard('u');
    expect(handlers.onToggleRead).toHaveBeenLastCalledWith(
      entries.find((e) => e.id === 'group:jira:PROJ-1'),
    );
  });

  it('e and Delete call onDone; focus lands on the entry now at that position', async () => {
    const user = userEvent.setup();
    const { handlers, rerender, entries } = setup();
    btn('event:a').focus();
    await user.keyboard('e');
    expect(handlers.onDone).toHaveBeenCalledWith(entries.find((e) => e.id === 'event:a'));
    // remove a: group of one collapses to a plain event
    const next = entriesFor(items.filter((i) => i.id !== 'a'));
    rerender(<NotificationList entries={next} renderEntry={stubRender} {...handlers} />);
    // index 2 is now whatever follows the header and event:a/c
    const idx = next.findIndex((e) => e.kind !== 'header');
    expect(idx).toBeGreaterThanOrEqual(0);
    const expected = next[Math.min(2, next.length - 1)];
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

  it('ArrowRight expands a collapsed group; moves to first child when expanded', async () => {
    const user = userEvent.setup();
    const collapsed = setup(items, { 'jira:PROJ-1': false });
    btn('group:jira:PROJ-1').focus();
    await user.keyboard('{ArrowRight}');
    expect(collapsed.handlers.onSetExpanded).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'group:jira:PROJ-1' }),
      true,
    );
    collapsed.unmount();

    const expanded = setup();
    btn('group:jira:PROJ-1').focus();
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(btn('event:a')).toHaveFocus());
    expect(expanded.handlers.onSetExpanded).not.toHaveBeenCalled();
  });

  it('ArrowLeft collapses an expanded group and moves from a child to its header', async () => {
    const user = userEvent.setup();
    const { handlers } = setup();
    btn('group:jira:PROJ-1').focus();
    await user.keyboard('{ArrowLeft}');
    expect(handlers.onSetExpanded).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'group:jira:PROJ-1' }),
      false,
    );
    btn('event:a').focus();
    await user.keyboard('{ArrowLeft}');
    await waitFor(() => expect(btn('group:jira:PROJ-1')).toHaveFocus());
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

  it('does not handle Enter, Space or Escape (default not prevented)', async () => {
    const user = userEvent.setup();
    const { handlers, container } = setup();
    btn('event:c').focus();
    const prevented: boolean[] = [];
    container.addEventListener('keydown', (e) => prevented.push(e.defaultPrevented));
    await user.keyboard('{Enter}{Escape}');
    expect(prevented.every((p) => !p)).toBe(true);
    expect(handlers.onDone).not.toHaveBeenCalled();
    expect(handlers.onToggleRead).not.toHaveBeenCalled();
  });
});
