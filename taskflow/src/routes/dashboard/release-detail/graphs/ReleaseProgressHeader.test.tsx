import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReleaseProgressHeader, type TimelineSummary } from './ReleaseProgressHeader';

const base: TimelineSummary = {
  done: 1,
  total: 3,
  today: '2026-10-30',
  releaseDate: '2026-11-03',
  released: false,
};
const header = () => screen.getByTestId('release-progress-header');

describe('ReleaseProgressHeader', () => {
  it('shows days left with the target date and no done figure', () => {
    render(<ReleaseProgressHeader summary={base} />);
    expect(header()).toHaveTextContent('4 days left');
    expect(header()).toHaveTextContent('until');
    expect(header()).not.toHaveTextContent('issues done');
    expect(header()).not.toHaveTextContent('1 / 3');
  });

  it('singular day and due today wording', () => {
    const { rerender } = render(
      <ReleaseProgressHeader summary={{ ...base, releaseDate: '2026-10-31' }} />,
    );
    expect(header()).toHaveTextContent('1 day left');
    rerender(<ReleaseProgressHeader summary={{ ...base, releaseDate: '2026-10-30' }} />);
    expect(header()).toHaveTextContent('Due today');
  });

  it('released, overdue and undated wording and tones', () => {
    const { rerender } = render(
      <ReleaseProgressHeader summary={{ ...base, released: true, releaseDate: '2026-10-25' }} />,
    );
    expect(header()).toHaveTextContent('Released');
    expect(screen.getByText('Released')).toHaveClass('text-green-600');
    rerender(<ReleaseProgressHeader summary={{ ...base, releaseDate: '2026-10-27' }} />);
    expect(header()).toHaveTextContent('3 days overdue');
    expect(screen.getByText('3 days overdue')).toHaveClass('text-red-600');
    rerender(<ReleaseProgressHeader summary={{ ...base, releaseDate: null }} />);
    expect(header()).toHaveTextContent('No release date');
    expect(screen.getByText('No release date')).toHaveClass('text-amber-600');
  });
});
