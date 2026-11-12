import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-error';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import { CardErrorState, ErrorState } from './error-state';

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

describe('CardErrorState', () => {
  it('generic error: title, subtitle, Retry calls onRetry, no raw message', () => {
    const onRetry = vi.fn();
    render(
      <CardErrorState
        error={new Error('network down')}
        onRetry={onRetry}
        viewName="Upcoming Releases"
      />,
    );
    expect(screen.getByText("Couldn't load Upcoming Releases")).toBeTruthy();
    expect(screen.getByText('Check your connection and try again.')).toBeTruthy();
    expect(screen.queryByText(/network down/)).toBeNull();
    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('generic error without onRetry renders no button', () => {
    render(<CardErrorState error={new Error('x')} viewName="X" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('401 jira: token rejected + Open Settings navigates, no Retry', () => {
    render(
      <CardErrorState error={new ApiError('x', 401, 'jira')} onRetry={vi.fn()} viewName="X" />,
    );
    expect(screen.getByText('Jira token rejected')).toBeTruthy();
    expect(screen.getByText('Update your Jira token in Settings.')).toBeTruthy();
    expect(screen.queryByText('Retry')).toBeNull();
    fireEvent.click(screen.getByText('Open Settings'));
    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });

  it('403 gitlab names GitLab', () => {
    render(<CardErrorState error={new ApiError('x', 403, 'gitlab')} viewName="X" />);
    expect(screen.getByText('GitLab token rejected')).toBeTruthy();
    expect(screen.getByText('Update your GitLab token in Settings.')).toBeTruthy();
  });

  it('plain Error containing 401 is auth, falls back to Jira', () => {
    render(<CardErrorState error={new Error('HTTP 401')} viewName="X" />);
    expect(screen.getByText('Jira token rejected')).toBeTruthy();
  });

  it('root has role=alert', () => {
    render(<CardErrorState error={new Error('x')} viewName="X" />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('button click and keydown do not reach a clickable parent', () => {
    const onClick = vi.fn();
    const onKeyDown = vi.fn();
    const onRetry = vi.fn();
    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: test parent
      <div onClick={onClick} onKeyDown={onKeyDown}>
        <CardErrorState error={new Error('x')} onRetry={onRetry} viewName="X" />
      </div>,
    );
    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByText('Retry'), { key: 'Enter' });
    expect(onKeyDown).not.toHaveBeenCalled();
  });

  it('logs console.error once with the tag', () => {
    const err = new Error('x');
    render(<CardErrorState error={err} viewName="V" />);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith('[CardErrorState] V:', err);
  });
});
