/**
 * StatTile.test.tsx — Phase 83 DASH-02
 *
 * Render tests for StatTile — static, non-interactive display tile.
 * Guards: role="region", aria-label, no role="button", no cursor-pointer/onClick.
 */
import { render, screen } from '@testing-library/react';
import { Activity } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import StatTile from './StatTile';

describe('StatTile — label and value render', () => {
  it('renders the label text', () => {
    render(<StatTile label="Open" value={4} icon={Activity} />);
    expect(screen.getByText('Open')).toBeTruthy();
  });

  it('renders the numeric value', () => {
    render(<StatTile label="Open" value={4} icon={Activity} />);
    expect(screen.getByText('4')).toBeTruthy();
  });
});

describe('StatTile — accessibility semantics', () => {
  it('root element has role="region"', () => {
    render(<StatTile label="Open" value={4} icon={Activity} />);
    const region = screen.getByRole('region');
    expect(region).toBeTruthy();
  });

  it('root region has aria-label matching the label', () => {
    render(<StatTile label="Open" value={4} icon={Activity} />);
    const region = screen.getByRole('region', { name: 'Open' });
    expect(region).toBeTruthy();
  });

  it('value element has aria-label "{value} {label}" for screen readers', () => {
    render(<StatTile label="Open" value={4} icon={Activity} />);
    // The <p> aria-label should read "4 Open" so screen readers speak the full phrase
    const valueEl = document.querySelector('[aria-label="4 Open"]');
    expect(valueEl).toBeTruthy();
  });

  it('value aria-label updates correctly for different props', () => {
    render(<StatTile label="Overdue" value={2} icon={Activity} />);
    const valueEl = document.querySelector('[aria-label="2 Overdue"]');
    expect(valueEl).toBeTruthy();
  });
});

describe('StatTile — D-06 static guard (no interactive affordances)', () => {
  it('has no role="button" element', () => {
    render(<StatTile label="Open" value={4} icon={Activity} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('rendered HTML contains no cursor-pointer class', () => {
    const { container } = render(<StatTile label="Open" value={4} icon={Activity} />);
    expect(container.innerHTML).not.toContain('cursor-pointer');
  });

  it('rendered HTML contains no onClick handler', () => {
    const { container } = render(<StatTile label="Open" value={4} icon={Activity} />);
    // No onClick in the DOM — interactive elements would have bound event listeners
    // We verify no clickable affordance exists by checking for role=button absence (above)
    // and that the component is purely presentational
    expect(container.querySelector('[onclick]')).toBeNull();
  });
});

describe('StatTile — optional prop: iconClass and valueClass', () => {
  it('applies iconClass to the icon element', () => {
    const { container } = render(
      <StatTile label="Overdue" value={0} icon={Activity} iconClass="text-destructive" />,
    );
    // The icon is an SVG — use getAttribute('class') since SVG className is an SVGAnimatedString
    const icon = container.querySelector('[aria-hidden="true"]');
    expect(icon?.getAttribute('class')).toContain('text-destructive');
  });

  it('applies valueClass to the value element', () => {
    const { container } = render(
      <StatTile label="Overdue" value={3} icon={Activity} valueClass="text-destructive" />,
    );
    const valueEl = container.querySelector('[aria-label="3 Overdue"]');
    expect(valueEl?.className).toContain('text-destructive');
  });
});
