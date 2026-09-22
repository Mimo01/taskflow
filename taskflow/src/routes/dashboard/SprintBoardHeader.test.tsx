import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SprintBoardHeader } from './SprintBoardHeader';

describe('SprintBoardHeader', () => {
  it('renders the sprint name when name is provided', () => {
    render(<SprintBoardHeader name="Sprint 42" />);
    expect(screen.getByText('Sprint 42')).toBeInTheDocument();
  });

  it('renders the goal text alongside the name when goal is a non-empty string', () => {
    render(<SprintBoardHeader name="Sprint 42" goal="Ship the thing" />);
    expect(screen.getByText('Sprint 42')).toBeInTheDocument();
    expect(screen.getByText('Ship the thing')).toBeInTheDocument();
  });

  it('renders the sprint name with no goal element when goal is null', () => {
    render(<SprintBoardHeader name="Sprint 42" goal={null} />);
    expect(screen.getByText('Sprint 42')).toBeInTheDocument();
    expect(screen.queryByText(/Goal/)).toBeNull();
  });

  it('renders the sprint name with no goal element when goal is an empty string', () => {
    render(<SprintBoardHeader name="Sprint 42" goal="" />);
    expect(screen.getByText('Sprint 42')).toBeInTheDocument();
    expect(screen.queryByTitle('')).toBeNull();
  });

  it('renders the sprint name with no goal element when goal is whitespace only', () => {
    const { container } = render(<SprintBoardHeader name="Sprint 42" goal="   " />);
    expect(screen.getByText('Sprint 42')).toBeInTheDocument();
    // No middle-dot separator and no goal <span> should be rendered.
    expect(container.querySelector('[title]')).toBeNull();
  });

  it('returns null when name is absent and goal is absent', () => {
    const { container } = render(<SprintBoardHeader />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null when name is whitespace-only and goal is absent', () => {
    const { container } = render(<SprintBoardHeader name="   " />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders with role="banner" and an accessible label mentioning the sprint', () => {
    render(<SprintBoardHeader name="Sprint 42" goal="Ship the thing" />);
    const banner = screen.getByRole('banner');
    expect(banner).toHaveAccessibleName(/sprint/i);
  });

  it('renders a state badge only when state is truthy', () => {
    const { rerender } = render(<SprintBoardHeader name="Sprint 42" state="active" />);
    expect(screen.getByText('active')).toBeInTheDocument();

    rerender(<SprintBoardHeader name="Sprint 42" />);
    expect(screen.queryByText('active')).toBeNull();
  });
});
