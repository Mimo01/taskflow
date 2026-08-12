import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EpicPointsCell, type EpicProgressCounts, EpicProgressCell } from './EpicProgressCells';

const readyCounts: EpicProgressCounts = {
  total: 10,
  done: 5,
  inProgress: 3,
  todo: 2,
  points: 20,
  donePoints: 8,
};

const zeroCounts: EpicProgressCounts = {
  total: 0,
  done: 0,
  inProgress: 0,
  todo: 0,
  points: 0,
  donePoints: 0,
};

describe('EpicProgressCells (Phase 91.2)', () => {
  it('EPIC-03: progress cell renders skeleton shimmer while enrichment is pending', () => {
    render(<EpicProgressCell state={{ kind: 'pending' }} onRetry={vi.fn()} />);
    expect(screen.getByTestId('epic-progress-pending')).toBeInTheDocument();
    expect(screen.queryByTestId('epic-progress-bar')).not.toBeInTheDocument();
    expect(screen.queryByText('No stories')).not.toBeInTheDocument();
  });

  it('EPIC-05: progress cell renders three segments sized by category share', () => {
    render(<EpicProgressCell state={{ kind: 'ready', counts: readyCounts }} onRetry={vi.fn()} />);
    expect(screen.getByTestId('epic-segment-done')).toHaveStyle({ width: '50%' });
    expect(screen.getByTestId('epic-segment-inprogress')).toHaveStyle({ width: '30%' });
    expect(screen.getByTestId('epic-segment-todo')).toHaveStyle({ width: '20%' });
  });

  it('EPIC-05: breakdown title carries per-status counts on hover', () => {
    render(<EpicProgressCell state={{ kind: 'ready', counts: readyCounts }} onRetry={vi.fn()} />);
    expect(screen.getByTestId('epic-progress-bar')).toHaveAttribute(
      'title',
      '5 Done · 3 In Progress · 2 To Do',
    );
  });

  it('EPIC-03: progress cell shows done/total beside the bar', () => {
    render(<EpicProgressCell state={{ kind: 'ready', counts: readyCounts }} onRetry={vi.fn()} />);
    expect(screen.getByText('5/10')).toBeInTheDocument();
  });

  it('EPIC-03: progress cell shows "no stories" for a successful-but-empty enrichment', () => {
    render(<EpicProgressCell state={{ kind: 'ready', counts: zeroCounts }} onRetry={vi.fn()} />);
    expect(screen.getByText('No stories')).toBeInTheDocument();
    expect(screen.queryByTestId('epic-progress-bar')).not.toBeInTheDocument();
  });

  it('EPIC-03: progress cell shows a retry affordance on enrichment failure', () => {
    const onRetry = vi.fn();
    render(<EpicProgressCell state={{ kind: 'error' }} onRetry={onRetry} />);
    const retryButton = screen.getByTestId('epic-progress-retry');
    expect(retryButton).toHaveAttribute('title', 'Failed to load — click to retry');
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('EPIC-07: retry click does not bubble to the row click handler', () => {
    const onRetry = vi.fn();
    const rowSpy = vi.fn();
    render(
      // biome-ignore lint/a11y/useKeyWithClickEvents: test-only row click spy
      // biome-ignore lint/a11y/noStaticElementInteractions: test-only row click spy
      <div onClick={rowSpy}>
        <EpicProgressCell state={{ kind: 'error' }} onRetry={onRetry} />
      </div>,
    );
    fireEvent.click(screen.getByTestId('epic-progress-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(rowSpy).not.toHaveBeenCalled();
  });

  it('EPIC-06: points cell renders done/total SP', () => {
    render(<EpicPointsCell state={{ kind: 'ready', counts: readyCounts }} onRetry={vi.fn()} />);
    expect(screen.getByText('8/20 SP')).toBeInTheDocument();
  });

  it('EPIC-06: points cell renders skeleton shimmer while pending', () => {
    render(<EpicPointsCell state={{ kind: 'pending' }} onRetry={vi.fn()} />);
    expect(screen.getByTestId('epic-points-pending')).toBeInTheDocument();
  });

  it('EPIC-06: points cell renders an em dash for zero stories', () => {
    render(<EpicPointsCell state={{ kind: 'ready', counts: zeroCounts }} onRetry={vi.fn()} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('EPIC-06: points cell shows a retry affordance on enrichment failure', () => {
    const onRetry = vi.fn();
    render(<EpicPointsCell state={{ kind: 'error' }} onRetry={onRetry} />);
    const retryButton = screen.getByTestId('epic-points-retry');
    expect(retryButton).toHaveAttribute('title', 'Failed to load — click to retry');
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('EPIC-05: no blocked or flagged marker is rendered in any state', () => {
    const states: Array<
      { kind: 'pending' } | { kind: 'error' } | { kind: 'ready'; counts: EpicProgressCounts }
    > = [
      { kind: 'pending' },
      { kind: 'error' },
      { kind: 'ready', counts: readyCounts },
      { kind: 'ready', counts: zeroCounts },
    ];
    for (const state of states) {
      const { unmount } = render(<EpicProgressCell state={state} onRetry={vi.fn()} />);
      expect(screen.queryByText(/flag|blocked/i)).not.toBeInTheDocument();
      unmount();
      const points = render(<EpicPointsCell state={state} onRetry={vi.fn()} />);
      expect(points.queryByText(/flag|blocked/i)).not.toBeInTheDocument();
      points.unmount();
    }
  });
});
