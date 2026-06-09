/**
 * DoneStep tests
 *
 * WIZARD-SAVE-ON-STEP: onboardingComplete is set on mount, not only on button click.
 */

import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DoneStep from './DoneStep';

// ── Settings store mock ──────────────────────────────────────────────────────
const mockStore: {
  setOnboardingComplete: ReturnType<typeof vi.fn>;
} = {
  setOnboardingComplete: vi.fn(),
};

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: (selector?: (s: typeof mockStore) => unknown) =>
    selector ? selector(mockStore) : mockStore,
}));

// ── Router mock ──────────────────────────────────────────────────────────────
const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// ── Test suite ───────────────────────────────────────────────────────────────

describe('DoneStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the success heading and subtitle', () => {
    render(<DoneStep />);
    expect(screen.getByRole('heading', { name: /you're all set/i })).toBeInTheDocument();
    expect(screen.getByText(/credentials and preferences have been saved/i)).toBeInTheDocument();
  });

  it('renders the "Go to Dashboard" button', () => {
    render(<DoneStep />);
    expect(screen.getByRole('button', { name: /go to dashboard/i })).toBeInTheDocument();
  });

  // WIZARD-SAVE-ON-STEP: core behavior — persist immediately on mount
  it('calls setOnboardingComplete(true) on mount before any button click', () => {
    render(<DoneStep />);
    expect(mockStore.setOnboardingComplete).toHaveBeenCalledTimes(1);
    expect(mockStore.setOnboardingComplete).toHaveBeenCalledWith(true);
  });

  it('does NOT call setOnboardingComplete from the "Go to Dashboard" handler', () => {
    render(<DoneStep />);
    // Clear the mount call to isolate the button handler
    mockStore.setOnboardingComplete.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /go to dashboard/i }));

    expect(mockStore.setOnboardingComplete).not.toHaveBeenCalled();
  });

  it('"Go to Dashboard" navigates to /dashboard', () => {
    render(<DoneStep />);
    fireEvent.click(screen.getByRole('button', { name: /go to dashboard/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});
