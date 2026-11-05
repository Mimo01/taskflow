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

  const seg = (c: HTMLElement, name: string) => c.querySelector(`[data-segment="${name}"]`);

  it('done issue under estimate: solid status-coloured logged part, no remaining', () => {
    const { container } = render(
      <StackedTimeBar spentSeconds={7200} totalSeconds={14400} isDone testId="bar" />,
    );
    expect(seg(container, 'done:logged')).toBeInTheDocument();
    expect(seg(container, 'done:remaining')).toBeNull();
    expect(container.querySelector('[data-testid="time-estimate-tick"]')).toBeInTheDocument();
  });

  it('not done under estimate: logged plus faint remaining up to the estimate', () => {
    const { container } = render(
      <StackedTimeBar
        spentSeconds={3600}
        totalSeconds={7200}
        statusCategoryKey="new"
        testId="bar"
      />,
    );
    expect(seg(container, 'new:logged')).toBeInTheDocument();
    expect(seg(container, 'new:remaining')).toHaveClass('opacity-35');
  });

  it('spent up to 125% of total is amber beyond the estimate', () => {
    const { container } = render(
      <StackedTimeBar spentSeconds={9000} totalSeconds={7200} testId="bar" />,
    );
    expect(seg(container, 'indeterminate:loggedOver')).toHaveClass('bg-amber-500');
  });

  it('spent > 125% of total is red beyond the estimate', () => {
    const { container } = render(
      <StackedTimeBar spentSeconds={10800} totalSeconds={7200} testId="bar" />,
    );
    expect(seg(container, 'indeterminate:loggedOver')).toHaveClass('bg-red-500');
  });
});
