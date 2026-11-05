import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { type TimedSource, timeBarIssues } from '@/lib/time-bar';
import { StackedTimeBar } from './StackedTimeBar';

const H = 3600;
function issues(
  cat: 'new' | 'indeterminate' | 'done',
  t: { spent?: number; est?: number; rem?: number },
) {
  const s: TimedSource = {
    fields: {
      status: { statusCategory: { key: cat } },
      timetracking: {
        timeSpentSeconds: t.spent === undefined ? undefined : t.spent * H,
        originalEstimateSeconds: t.est === undefined ? undefined : t.est * H,
        remainingEstimateSeconds: t.rem === undefined ? undefined : t.rem * H,
      },
    },
  };
  return timeBarIssues(s);
}

const seg = (c: HTMLElement, name: string) => c.querySelector(`[data-segment="${name}"]`);
const tick = (c: HTMLElement) => c.querySelector('[data-testid="time-estimate-tick"]');

describe('StackedTimeBar', () => {
  it('renders a blank spacer when there is no time data (My Tasks default)', () => {
    render(<StackedTimeBar issues={issues('new', {})} testId="bar" />);
    expect(screen.getByTestId('bar')).toBeEmptyDOMElement();
  });

  it('alwaysShowTrack: dashed track + "No estimate" instead of a spacer', () => {
    const { container } = render(
      <StackedTimeBar issues={issues('new', {})} testId="bar" alwaysShowTrack />,
    );
    expect(container.querySelector('[data-no-estimate="true"]')).toBeInTheDocument();
    expect(screen.getByTestId('bar')).toHaveTextContent('No estimate');
  });

  it('logged with no estimate is a dashed track, never a full bar', () => {
    const { container } = render(
      <StackedTimeBar issues={issues('indeterminate', { spent: 2 })} testId="bar" />,
    );
    expect(container.querySelector('[data-no-estimate="true"]')).toBeInTheDocument();
    expect(container.querySelector('[data-segment]')).toBeNull();
    expect(screen.getByTestId('bar')).toHaveTextContent('2h · no estimate');
  });

  it('caption is logged / estimate', () => {
    render(<StackedTimeBar issues={issues('indeterminate', { spent: 1, est: 2 })} testId="bar" />);
    expect(screen.getByTestId('time-bar-caption')).toHaveTextContent('1h / 2h');
  });

  it('To Do logged time uses the darker slate, not the gray-400 status dot', () => {
    const { container } = render(
      <StackedTimeBar issues={issues('new', { spent: 1, est: 4, rem: 3 })} testId="bar" />,
    );
    expect(seg(container, 'new:logged')).toHaveClass('bg-slate-500');
    expect(seg(container, 'new:remaining')).toHaveClass('opacity-40');
  });

  it('under estimate: no tick (the track ends at the estimate)', () => {
    const { container } = render(
      <StackedTimeBar
        issues={issues('indeterminate', { spent: 1, est: 4, rem: 3 })}
        testId="bar"
      />,
    );
    expect(tick(container)).toBeNull();
  });

  it('forecast overrun: striped red past a tick, caption not coloured yet', () => {
    const { container } = render(
      <StackedTimeBar
        issues={issues('indeterminate', { spent: 3, est: 4, rem: 3 })}
        testId="bar"
      />,
    );
    expect(seg(container, 'indeterminate:remainingOver')).toHaveClass('bg-red-500');
    expect(tick(container)).toBeInTheDocument();
    expect(screen.getByTestId('bar')).toHaveAttribute('data-overrun', 'true');
    expect(screen.getByTestId('time-bar-caption').querySelector('[data-overrun]')).toBeNull();
  });

  it('logged over within 125%: amber segment and amber logged caption', () => {
    const { container } = render(
      <StackedTimeBar
        issues={issues('indeterminate', { spent: 4.5, est: 4, rem: 0 })}
        testId="bar"
      />,
    );
    expect(seg(container, 'indeterminate:loggedOver')).toHaveClass('bg-amber-500');
    expect(container.querySelector('[data-overrun="amber"]')).toHaveTextContent('4h 30m');
  });

  it('logged over 125%: red segment and red caption', () => {
    const { container } = render(
      <StackedTimeBar
        issues={issues('indeterminate', { spent: 6, est: 4, rem: 0 })}
        testId="bar"
      />,
    );
    expect(seg(container, 'indeterminate:loggedOver')).toHaveClass('bg-red-500');
    expect(container.querySelector('[data-overrun="red"]')).toBeInTheDocument();
  });

  it('done under estimate: solid done-coloured logged, no remaining', () => {
    const { container } = render(
      <StackedTimeBar issues={issues('done', { spent: 2, est: 4, rem: 0 })} testId="bar" />,
    );
    expect(seg(container, 'done:logged')).toBeInTheDocument();
    expect(container.querySelector('[data-segment$=":remaining"]')).toBeNull();
  });

  it('labels the bar for screen readers', () => {
    render(
      <StackedTimeBar
        issues={issues('indeterminate', { spent: 1, est: 4, rem: 3 })}
        testId="bar"
      />,
    );
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      'Logged 1h of 4h estimate, 3h remaining',
    );
  });

  it('caption="none" hides the caption; caption="right" keeps it', () => {
    const { rerender } = render(
      <StackedTimeBar
        issues={issues('indeterminate', { spent: 1, est: 2 })}
        caption="none"
        testId="bar"
      />,
    );
    expect(screen.queryByTestId('time-bar-caption')).toBeNull();
    rerender(
      <StackedTimeBar
        issues={issues('indeterminate', { spent: 1, est: 2 })}
        caption="right"
        testId="bar"
      />,
    );
    expect(screen.getByTestId('time-bar-caption')).toHaveTextContent('1h / 2h');
  });
});
