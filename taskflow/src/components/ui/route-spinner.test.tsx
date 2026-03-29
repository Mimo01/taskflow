import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RouteSpinner } from './route-spinner';

describe('RouteSpinner', () => {
  it('renders a div with role="status"', () => {
    render(<RouteSpinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has aria-label "Loading page"', () => {
    render(<RouteSpinner />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading page');
  });

  it('contains an SVG element (the Loader2 icon)', () => {
    const { container } = render(<RouteSpinner />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
