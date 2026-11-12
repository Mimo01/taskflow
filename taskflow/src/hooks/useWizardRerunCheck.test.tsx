import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WIZARD_VERSION } from '@/lib/onboarding-rerun';
import { useAuthStore } from '@/stores/auth.store';
import { useOnboardingStore } from '@/stores/onboarding.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useWizardRerunCheck } from './useWizardRerunCheck';

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('tok'),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
}));

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

function setup(opts: { complete: boolean; version: number; authHydrated?: boolean }) {
  useSettingsStore.setState({ onboardingComplete: opts.complete, onboardingVersion: opts.version });
  useAuthStore.setState({
    _hasHydrated: opts.authHydrated ?? true,
    jiraBaseUrl: 'https://jira.example',
  } as never);
  useOnboardingStore.setState({ rerunActive: false, step: 0, jiraUrl: '', jiraToken: '' });
}

describe('useWizardRerunCheck', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.spyOn(useSettingsStore.persist, 'hasHydrated').mockReturnValue(true);
  });

  it('starts a pre-filled re-run at the changed step for a stale version', async () => {
    setup({ complete: true, version: 1 });
    renderHook(() => useWizardRerunCheck(), { wrapper });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'));
    const s = useOnboardingStore.getState();
    expect(s.rerunActive).toBe(true);
    expect(s.step).toBe(3);
    expect(s.jiraUrl).toBe('https://jira.example');
    expect(s.jiraToken).toBe('tok');
  });

  it('does nothing when up to date', async () => {
    setup({ complete: true, version: WIZARD_VERSION });
    renderHook(() => useWizardRerunCheck(), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(useOnboardingStore.getState().rerunActive).toBe(false);
  });

  it('does nothing for a fresh user', async () => {
    setup({ complete: false, version: 0 });
    renderHook(() => useWizardRerunCheck(), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('waits for auth hydration and fires only once', async () => {
    setup({ complete: true, version: 1, authHydrated: false });
    const { rerender } = renderHook(() => useWizardRerunCheck(), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(mockNavigate).not.toHaveBeenCalled();
    useAuthStore.setState({ _hasHydrated: true } as never);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    useOnboardingStore.setState({ rerunActive: false });
    rerender();
    await new Promise((r) => setTimeout(r, 20));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });
});
