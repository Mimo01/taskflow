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
});
