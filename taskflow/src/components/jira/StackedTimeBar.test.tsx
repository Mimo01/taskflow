import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StackedTimeBar } from './StackedTimeBar';

describe('StackedTimeBar', () => {
  it('renders a blank spacer when there is no time data (My Tasks default)', () => {
    render(<StackedTimeBar spentSeconds={0} totalSeconds={undefined} testId="bar" />);
    const bar = screen.getByTestId('bar');
    expect(bar).toBeEmptyDOMElement();
  });

  it('renders an empty track with a 0m caption when alwaysShowTrack is set', () => {
    render(
      <StackedTimeBar spentSeconds={0} totalSeconds={undefined} testId="bar" alwaysShowTrack />,
    );
    const bar = screen.getByTestId('bar');
    expect(bar).not.toBeEmptyDOMElement();
    expect(bar).toHaveTextContent('0m');
  });

  it('shows spent / estimate when an estimate exists', () => {
    render(<StackedTimeBar spentSeconds={3600} totalSeconds={7200} testId="bar" />);
    expect(screen.getByTestId('bar')).toHaveTextContent('1h / 2h');
  });

  const indicator = (c: HTMLElement) => c.querySelector('[data-slot="progress-indicator"]');

  it('done issue under estimate is a partial green bar', () => {
    const { container } = render(
      <StackedTimeBar spentSeconds={7200} totalSeconds={14400} isDone testId="bar" />,
    );
    expect(indicator(container)).toHaveClass('bg-green-500');
    expect(container.querySelector('[role="progressbar"]')).toHaveAttribute('aria-valuenow', '50');
  });

  it('not done with spent == total is amber, not red', () => {
    const { container } = render(
      <StackedTimeBar spentSeconds={7200} totalSeconds={7200} testId="bar" />,
    );
    expect(indicator(container)).toHaveClass('bg-amber-500');
  });

  it('spent > total is red', () => {
    const { container } = render(
      <StackedTimeBar spentSeconds={9000} totalSeconds={7200} testId="bar" />,
    );
    expect(indicator(container)).toHaveClass('bg-red-500');
  });
});
