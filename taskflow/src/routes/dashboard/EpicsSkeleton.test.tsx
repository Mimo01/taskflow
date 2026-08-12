import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EpicsSkeleton } from './EpicsSkeleton';

describe('EpicsSkeleton (Phase 91.2)', () => {
  it('renders 5 skeleton rows with 7 columns each', () => {
    const { container } = render(<EpicsSkeleton />);
    const rows = container.querySelectorAll(':scope > div > div');
    expect(rows).toHaveLength(5);
    for (const row of Array.from(rows)) {
      const skeletons = row.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons).toHaveLength(7);
    }
  });
});
