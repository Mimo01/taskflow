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

  it('renders both buttons as ghost xs with muted text and size-3 icons', () => {
    render(<SubtaskCreateControl onAdd={vi.fn()} onBulk={vi.fn()} />);
    for (const b of screen.getAllByRole('button')) {
      expect(b.className).toContain('h-6');
      expect(b.className).toContain('text-muted-foreground');
      expect(b.className).toContain('hover:text-foreground');
      expect(b.className).not.toContain('border-border');
      expect(b.querySelector('svg')?.getAttribute('class')).toContain('size-3');
    }
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
