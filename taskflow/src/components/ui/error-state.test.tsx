import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-error';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import { ErrorState } from './error-state';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ErrorState — generic error', () => {
  it('renders "Couldn\'t load {viewName}" title', () => {
    render(<ErrorState error={new Error('oops')} onRetry={vi.fn()} viewName="My Tasks" />);
    expect(screen.getByText("Couldn't load My Tasks")).toBeTruthy();
  });

  it('renders Retry button that calls onRetry on click', () => {
    const onRetry = vi.fn();
    render(<ErrorState error={new Error('oops')} onRetry={onRetry} viewName="My Tasks" />);
    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('uses AlertCircle icon (svg present)', () => {
    const { container } = render(
      <ErrorState error={new Error('oops')} onRetry={vi.fn()} viewName="My Tasks" />,
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });
});

describe('ErrorState — auth error', () => {
  it('renders "Session expired" title for 401', () => {
    render(
      <ErrorState error={new ApiError('x', 401, 'jira')} onRetry={vi.fn()} viewName="My Tasks" />,
    );
    expect(screen.getByText('Session expired')).toBeTruthy();
  });

  it('renders Reconnect button (not Retry)', () => {
    render(
      <ErrorState error={new ApiError('x', 401, 'jira')} onRetry={vi.fn()} viewName="My Tasks" />,
    );
    expect(screen.getByText('Reconnect')).toBeTruthy();
    expect(screen.queryByText('Retry')).toBeNull();
  });

  it('description contains "Jira" for jira source', () => {
    render(
      <ErrorState error={new ApiError('x', 401, 'jira')} onRetry={vi.fn()} viewName="My Tasks" />,
    );
    expect(screen.getByText(/Jira/)).toBeTruthy();
  });

  it('description contains "GitLab" for gitlab source', () => {
    render(
      <ErrorState error={new ApiError('x', 403, 'gitlab')} onRetry={vi.fn()} viewName="MRs" />,
    );
    expect(screen.getByText(/GitLab/)).toBeTruthy();
  });

  it('Reconnect button triggers navigation to /settings', () => {
    render(
      <ErrorState error={new ApiError('x', 401, 'jira')} onRetry={vi.fn()} viewName="My Tasks" />,
    );
    fireEvent.click(screen.getByText('Reconnect'));
    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });
});

describe('ErrorState — plain Error (non-auth)', () => {
  it('renders Retry, not Reconnect', () => {
    render(<ErrorState error={new Error('network failure')} onRetry={vi.fn()} viewName="Sprint" />);
    expect(screen.getByText('Retry')).toBeTruthy();
    expect(screen.queryByText('Reconnect')).toBeNull();
  });
});

describe('ErrorState — logging', () => {
  it('logs raw error via console.error', () => {
    const err = new Error('something bad');
    render(<ErrorState error={err} onRetry={vi.fn()} viewName="Sprint" />);
    expect(console.error).toHaveBeenCalledWith('[ErrorState] Sprint:', err);
  });
});
