/**
 * Onboarding route gate — the Done step must stay visible after it marks onboarding complete
 * (regression: the onboardingComplete flip on DoneStep mount redirected straight to /dashboard).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useOnboardingStore } from '@/stores/onboarding.store';
import { useSettingsStore } from '@/stores/settings.store';
import Onboarding from './index';

function renderAt() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Onboarding />} />
        <Route path="/dashboard" element={<div>DASHBOARD</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Onboarding route gate', () => {
  beforeEach(() => {
    useOnboardingStore.setState({ step: 4, rerunActive: false });
  });

  it('first run: Done step stays visible after it persists onboardingComplete', () => {
    useSettingsStore.setState({ onboardingComplete: false, onboardingVersion: 0 });
    renderAt();
    expect(useSettingsStore.getState().onboardingComplete).toBe(true);
    expect(screen.getByRole('heading', { name: /you're all set/i })).toBeInTheDocument();
    expect(screen.queryByText('DASHBOARD')).not.toBeInTheDocument();
  });

  it('re-run: Done step stays visible, Go to Dashboard leaves the wizard', () => {
    useSettingsStore.setState({ onboardingComplete: true, onboardingVersion: 1 });
    useOnboardingStore.setState({ rerunActive: true });
    renderAt();
    expect(screen.getByRole('heading', { name: /you're all set/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /go to dashboard/i }));
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument();
  });

  it('completed user without an open wizard is redirected to /dashboard', () => {
    useSettingsStore.setState({ onboardingComplete: true });
    useOnboardingStore.setState({ step: 0 });
    renderAt();
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument();
  });
});
