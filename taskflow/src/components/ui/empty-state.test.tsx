import { render, screen } from '@testing-library/react';
import { Inbox } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('renders an svg icon element', () => {
    const { container } = render(<EmptyState icon={Inbox} title="No items" />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders title text', () => {
    render(<EmptyState icon={Inbox} title="No items here" />);
    expect(screen.getByText('No items here')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    render(<EmptyState icon={Inbox} title="T" subtitle="Some subtitle" />);
    expect(screen.getByText('Some subtitle')).toBeTruthy();
  });

  it('does not render subtitle when omitted', () => {
    render(<EmptyState icon={Inbox} title="T" />);
    expect(screen.queryByText('Some subtitle')).toBeNull();
  });

  it('renders action ReactNode when provided', () => {
    render(<EmptyState icon={Inbox} title="T" action={<button type="button">Click me</button>} />);
    expect(screen.getByText('Click me')).toBeTruthy();
  });

  it('does not render action wrapper when omitted', () => {
    const { container } = render(<EmptyState icon={Inbox} title="T" />);
    // The action wrapper div with mt-4 should not exist
    const wrappers = container.querySelectorAll('.mt-4');
    expect(wrappers.length).toBe(0);
  });

  it('fill adds h-full, flex-1 and min-h-fit while keeping centring and py-8', () => {
    const { container } = render(<EmptyState icon={Inbox} title="T" fill />);
    const cls = (container.firstElementChild as HTMLElement).className.split(' ');
    for (const c of ['h-full', 'flex-1', 'min-h-fit', 'justify-center', 'items-center', 'py-8']) {
      expect(cls).toContain(c);
    }
  });

  it('default root has no fill classes', () => {
    const { container } = render(<EmptyState icon={Inbox} title="T" />);
    const cls = (container.firstElementChild as HTMLElement).className.split(' ');
    expect(cls).not.toContain('h-full');
    expect(cls).not.toContain('flex-1');
    expect(cls).not.toContain('min-h-fit');
  });
});
