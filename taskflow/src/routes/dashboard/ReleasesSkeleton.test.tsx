import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReleasesSkeleton } from './ReleasesSkeleton';

const GRID = 'grid-cols-[74px_24px_minmax(0,1fr)]';

describe('ReleasesSkeleton', () => {
  it('mirrors the loaded structure', () => {
    const { container } = render(<ReleasesSkeleton />);
    expect(screen.getAllByTestId('skeleton-today')).toHaveLength(1);
    expect(screen.getAllByTestId('skeleton-month')).toHaveLength(2);
    expect(screen.getAllByTestId('skeleton-next-card')).toHaveLength(1);
    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(5);
    expect(screen.getAllByTestId('agenda-dot')).toHaveLength(5);
    expect(screen.getAllByTestId('skeleton-released-row')).toHaveLength(3);
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    expect((container.firstChild as HTMLElement).getAttribute('aria-hidden')).toBe('true');
  });

  it('uses the shared row grid on every rail row', () => {
    render(<ReleasesSkeleton />);
    for (const el of [
      ...screen.getAllByTestId('skeleton-row'),
      ...screen.getAllByTestId('skeleton-month'),
      screen.getByTestId('skeleton-today'),
    ]) {
      expect(el.className).toContain(GRID);
    }
  });

  it('uses the real row paddings', () => {
    const { container } = render(<ReleasesSkeleton />);
    expect(container.querySelectorAll('.py-\\[9px\\]')).toHaveLength(1);
    expect(container.querySelectorAll('.rounded-lg.py-1\\.5')).toHaveLength(3);
  });
});
