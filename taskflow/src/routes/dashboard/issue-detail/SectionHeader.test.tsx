import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SectionHeader, SectionSegmented } from './SectionHeader';

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

describe('SectionSegmented', () => {
  const options = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta' },
  ] as const;

  it('renders a labelled group with aria-pressed on the active option', () => {
    render(<SectionSegmented label="Pick" options={options} value="b" onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'Pick' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Alpha' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(screen.getByRole('button', { name: 'Beta' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('has nothing pressed when value is null', () => {
    render(<SectionSegmented label="Pick" options={options} value={null} onChange={() => {}} />);
    for (const b of screen.getAllByRole('button')) {
      expect(b.getAttribute('aria-pressed')).toBe('false');
    }
  });

  it('calls onChange with the clicked value', () => {
    const onChange = vi.fn();
    render(<SectionSegmented label="Pick" options={options} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('puts data-testid and className on the track', () => {
    render(
      <SectionSegmented
        label="Pick"
        options={options}
        value="a"
        onChange={() => {}}
        className="extra"
        data-testid="seg"
      />,
    );
    const track = screen.getByTestId('seg');
    expect(track.getAttribute('role')).toBe('group');
    expect(track.className).toContain('extra');
  });
});
