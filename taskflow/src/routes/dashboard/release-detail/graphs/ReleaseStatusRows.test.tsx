import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReleaseStatusRow } from '../releaseBuckets';
import { ReleaseStatusRows } from './ReleaseStatusRows';

const rows: ReleaseStatusRow[] = [
  { name: 'Done', cat: 'done', count: 4 },
  { name: 'In Review', cat: 'indeterminate', count: 2 },
  { name: 'To Do', cat: 'new', count: 1 },
];

describe('ReleaseStatusRows', () => {
  it('renders one row per status with its count', () => {
    render(<ReleaseStatusRows rows={rows} state="ready" />);
    expect(screen.getByText('By status')).toBeInTheDocument();
    expect(screen.getByTestId('status-row-Done')).toHaveTextContent('4');
    expect(screen.getByTestId('status-row-In Review')).toHaveTextContent('2');
  });

  it('caps at 6 rows and says how many more', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      name: `S${i}`,
      cat: 'new' as const,
      count: 1,
    }));
    render(<ReleaseStatusRows rows={many} state="ready" />);
    expect(screen.getByText('+2 more statuses')).toBeInTheDocument();
  });

  it('compact caps at 5 rows', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      name: `S${i}`,
      cat: 'new' as const,
      count: 1,
    }));
    render(<ReleaseStatusRows rows={many} state="ready" compact />);
    expect(screen.getByText('+3 more statuses')).toBeInTheDocument();
  });
});
