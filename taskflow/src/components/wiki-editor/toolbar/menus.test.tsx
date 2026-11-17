import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { INSERT_ITEMS } from '../insert-items';
import { InsertMenu } from './InsertMenu';
import { TableGridPicker } from './TableGridPicker';
import { TextStyleMenu } from './TextStyleMenu';

describe('InsertMenu', () => {
  it('lists items in order, portals to body, and calls onInsert', async () => {
    const onInsert = vi.fn();
    const { container } = render(<InsertMenu items={INSERT_ITEMS} onInsert={onInsert} />);
    await userEvent.click(screen.getByRole('button', { name: 'Insert' }));
    const items = await screen.findAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual(INSERT_ITEMS.map((i) => i.label));
    expect(container.contains(items[0] as HTMLElement)).toBe(false);
    expect(document.body.contains(items[0] as HTMLElement)).toBe(true);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Code block' }));
    expect(onInsert).toHaveBeenCalledWith(INSERT_ITEMS[1]);
  });
});

describe('TableGridPicker', () => {
  it('renders 6x6, labels hover and picks on click', () => {
    const onPick = vi.fn();
    render(<TableGridPicker onPick={onPick} />);
    expect(screen.getAllByRole('button')).toHaveLength(36);
    const cell = screen.getByRole('button', { name: '3 by 4' });
    fireEvent.mouseEnter(cell);
    expect(screen.getByText('3 × 4')).toBeTruthy();
    fireEvent.click(cell);
    expect(onPick).toHaveBeenCalledWith(3, 4);
  });

  it('is keyboard reachable', () => {
    const onPick = vi.fn();
    render(<TableGridPicker onPick={onPick} />);
    const grid = screen.getByRole('grid', { name: 'Table size' });
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    fireEvent.keyDown(grid, { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith(3, 2);
  });
});

describe('TextStyleMenu', () => {
  it('shows the current style and selects', async () => {
    const onSelect = vi.fn();
    render(<TextStyleMenu current="h2" onSelect={onSelect} />);
    const trigger = screen.getByRole('button', { name: 'Text style' });
    expect(trigger.textContent).toBe('Heading 2');
    await userEvent.click(trigger);
    expect(await screen.findAllByRole('menuitemradio')).toHaveLength(8);
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Quote' }));
    expect(onSelect).toHaveBeenCalledWith('quote');
  });
});
