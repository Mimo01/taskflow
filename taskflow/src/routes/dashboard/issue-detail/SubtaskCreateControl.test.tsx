import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SubtaskCreateControl } from './SubtaskCreateControl';

describe('SubtaskCreateControl', () => {
  it('renders Bulk create before Add subtask as two separate buttons', () => {
    render(<SubtaskCreateControl onAdd={vi.fn()} onBulk={vi.fn()} />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Bulk create',
      'Add subtask',
    ]);
  });

  it('Add subtask calls onAdd only', () => {
    const onAdd = vi.fn();
    const onBulk = vi.fn();
    render(<SubtaskCreateControl onAdd={onAdd} onBulk={onBulk} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add subtask' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onBulk).not.toHaveBeenCalled();
  });

  it('Bulk create calls onBulk only', () => {
    const onAdd = vi.fn();
    const onBulk = vi.fn();
    render(<SubtaskCreateControl onAdd={onAdd} onBulk={onBulk} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bulk create' }));
    expect(onBulk).toHaveBeenCalledTimes(1);
    expect(onAdd).not.toHaveBeenCalled();
  });
});
