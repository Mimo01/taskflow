import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './empty-state';
import { Inbox } from 'lucide-react';

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
    render(<EmptyState icon={Inbox} title="T" action={<button>Click me</button>} />);
    expect(screen.getByText('Click me')).toBeTruthy();
  });

  it('does not render action wrapper when omitted', () => {
    const { container } = render(<EmptyState icon={Inbox} title="T" />);
    // The action wrapper div with mt-4 should not exist
    const wrappers = container.querySelectorAll('.mt-4');
    expect(wrappers.length).toBe(0);
  });
});
