import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  SuggestionPopover,
  type SuggestionPopoverHandle,
  type SuggestionRow,
} from './SuggestionPopover';

const rows = (n: number, group?: SuggestionRow['group']): SuggestionRow[] =>
  Array.from({ length: n }, (_, i) => ({ key: `k${i}`, label: `Row ${i}`, group, data: i }));

function setup(props: Partial<React.ComponentProps<typeof SuggestionPopover>> = {}) {
  const ref = createRef<SuggestionPopoverHandle>();
  const onSelect = vi.fn();
  const utils = render(
    <SuggestionPopover
      ref={ref}
      rows={rows(3)}
      loading={false}
      onSelect={onSelect}
      maxRows={8}
      listboxId="lb"
      {...props}
    />,
  );
  const key = (k: string) => {
    let res = false;
    act(() => {
      res = ref.current?.onKeyDown(new KeyboardEvent('keydown', { key: k })) ?? false;
    });
    return res;
  };
  return { ...utils, key, onSelect };
}

const selected = () => screen.getAllByRole('option').findIndex((o) => o.ariaSelected === 'true');

describe('SuggestionPopover', () => {
  it('renders a listbox with options, first selected', () => {
    setup();
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(selected()).toBe(0);
    expect(document.querySelector('[data-suggestion]')).not.toBeNull();
  });

  it('arrow keys move and wrap', () => {
    const { key } = setup();
    expect(key('ArrowUp')).toBe(true);
    expect(selected()).toBe(2);
    expect(key('ArrowDown')).toBe(true);
    expect(selected()).toBe(0);
    key('ArrowDown');
    expect(selected()).toBe(1);
  });

  it('Enter and Tab select the highlighted row', () => {
    const { key, onSelect } = setup();
    key('ArrowDown');
    expect(key('Enter')).toBe(true);
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'k1' }));
    expect(key('Tab')).toBe(true);
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('returns false for keys with zero rows', () => {
    const { key } = setup({ rows: [], emptyText: 'Nothing' });
    expect(key('Enter')).toBe(false);
    expect(key('Tab')).toBe(false);
    expect(screen.getByText('Nothing')).toBeTruthy();
  });

  it('shows 3 skeleton rows on first load', () => {
    setup({ rows: [], loading: true });
    expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3);
  });

  it('keeps previous rows while a later query loads', () => {
    const { rerender } = setup();
    rerender(
      <SuggestionPopover rows={[]} loading onSelect={() => {}} maxRows={8} listboxId="lb" />,
    );
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(0);
  });

  it('renders nothing when empty without emptyText', () => {
    setup({ rows: [] });
    expect(document.querySelector('[data-suggestion]')).toBeNull();
  });

  it('renders group headings as non-options', () => {
    setup({ rows: rows(2, 'Blocks') });
    expect(screen.getByText('Blocks')).toBeTruthy();
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('mousedown is prevented and click selects', () => {
    const { onSelect } = setup();
    const opt = screen.getAllByRole('option')[1];
    expect(fireEvent.mouseDown(opt)).toBe(false);
    fireEvent.click(opt);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ key: 'k1' }));
  });

  it('caps height by maxRows', () => {
    setup({ maxRows: 6 });
    expect((document.querySelector('[data-suggestion]') as HTMLElement).style.maxHeight).toBe(
      '200px',
    );
  });
});
