import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SubtaskCreateControl } from './SubtaskCreateControl';

describe('SubtaskCreateControl', () => {
  it('Add subtask calls onAdd only', () => {
    const onAdd = vi.fn();
    const onBulk = vi.fn();
    render(<SubtaskCreateControl onAdd={onAdd} onBulk={onBulk} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add subtask' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onBulk).not.toHaveBeenCalled();
  });

  it('chevron opens a menu with the bulk item', async () => {
    render(<SubtaskCreateControl onAdd={vi.fn()} onBulk={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'More subtask actions' }));
    const items = await screen.findAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toContain('Bulk create subtasks…');
  });

  it('choosing the bulk item calls onBulk only', async () => {
    const onAdd = vi.fn();
    const onBulk = vi.fn();
    render(<SubtaskCreateControl onAdd={onAdd} onBulk={onBulk} />);
    fireEvent.click(screen.getByRole('button', { name: 'More subtask actions' }));
    const items = await screen.findAllByRole('menuitem');
    fireEvent.click(items[0]);
    expect(onBulk).toHaveBeenCalledTimes(1);
    expect(onAdd).not.toHaveBeenCalled();
  });
});
