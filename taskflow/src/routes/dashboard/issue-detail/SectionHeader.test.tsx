import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SectionHeader } from './SectionHeader';

describe('SectionHeader', () => {
  it('renders title as an h3 with a muted count', () => {
    render(<SectionHeader title="Subtasks" count={2} />);
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('Subtasks 2');
  });

  it('omits the count when undefined', () => {
    render(<SectionHeader title="Subtasks" />);
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('Subtasks');
  });

  it('collapsible: toggle button reflects expanded and calls onToggle', () => {
    const onToggle = vi.fn();
    render(<SectionHeader title="Attachments" count={0} expanded={false} onToggle={onToggle} />);
    const btn = screen.getByRole('button', { name: 'Attachments 0' });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders actions on the right', () => {
    render(
      <SectionHeader title="Attachments" actions={<button type="button">Attach file</button>} />,
    );
    expect(screen.getByRole('button', { name: 'Attach file' })).toBeTruthy();
  });

  it('is sticky by default and opts out with sticky={false}', () => {
    const { container, rerender } = render(<SectionHeader title="Description" />);
    const cls = (container.firstElementChild as HTMLElement).className;
    expect(cls).toContain('sticky top-0 z-20');
    expect(cls).toContain('bg-(--detail-surface,var(--background))');
    expect(cls).toContain('mx-[calc(var(--detail-px,0px)*-1)]');
    rerender(<SectionHeader title="Description" sticky={false} />);
    const off = (container.firstElementChild as HTMLElement).className;
    expect(off).not.toContain('sticky');
    expect(off).not.toContain('z-20');
  });
});
