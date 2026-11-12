/**
 * DebugModeSection — "Reset onboarding wizard" seeding (261112-lyx).
 * Uses the real zustand stores so the test exercises the real `set`.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotificationsStore } from '../../stores/notifications.store';
import { useAuthStore } from '../../stores/auth.store';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { useSettingsStore } from '../../stores/settings.store';
import DebugModeSection from './DebugModeSection';

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('fake-token'),
  removeSecret: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/services/avatarCache', () => ({ clearAvatarCache: vi.fn() }));

function renderSection() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DebugModeSection />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function runWizardReset() {
  renderSection();
  const triggers = screen.getAllByRole('button', { name: 'Reset' });
  fireEvent.click(triggers[0]);
  fireEvent.click(await screen.findByRole('button', { name: 'Open Wizard' }));
  await waitFor(() => expect(useOnboardingStore.getState().jiraToken).toBe('fake-token'));
}

describe('DebugModeSection reset wizard', () => {
  beforeEach(() => {
    useOnboardingStore.setState({
      jiraBoardId: null,
      jiraBoards: [{ id: 1, name: 'Stale', type: 'scrum' }],
    } as never);
  });

  it('seeds the saved board for the active project and clears stale boards', async () => {
    useAuthStore.setState({
      activeJiraProject: 'PROJ',
      jiraBoardIds: { PROJ: 42, OTHER: 7 },
    } as never);
    const before = useSettingsStore.getState().onboardingComplete;
    await runWizardReset();
    const s = useOnboardingStore.getState();
    expect(s.jiraBoardId).toBe(42);
    expect(s.jiraBoards).toEqual([]);
    expect(s.jiraProject).toBe('PROJ');
    expect(s.rerunActive).toBe(true);
    expect(s.step).toBe(0);
    expect(useSettingsStore.getState().onboardingComplete).toBe(before);
  });

  it('seeds null when no board is saved for the project', async () => {
    useAuthStore.setState({ activeJiraProject: 'PROJ', jiraBoardIds: {} } as never);
    await runWizardReset();
    expect(useOnboardingStore.getState().jiraBoardId).toBeNull();
  });

  it('seeds null when there is no active project', async () => {
    useAuthStore.setState({ activeJiraProject: null, jiraBoardIds: { PROJ: 42 } } as never);
    await runWizardReset();
    expect(useOnboardingStore.getState().jiraBoardId).toBeNull();
  });
});

describe('DebugModeSection clear notification cache', () => {
  const seed = (items: unknown[]) =>
    useNotificationsStore.setState({
      items,
      lastSeenCursor: '2026-11-12T10:00:00.000Z',
      lastSeenJiraCursor: '2026-11-12T10:00:00.000Z',
      lastSeenGitlabCursor: '2026-11-12T10:00:00.000Z',
    } as never);

  it('is enabled at 0 items and resets all cursors', async () => {
    seed([]);
    renderSection();
    const btn = screen.getAllByRole('button', { name: 'Clear' })[0];
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(btn);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('polling cursor');
    expect(dialog.textContent).not.toContain('0 cached notification');
    fireEvent.click(await screen.findByRole('button', { name: 'Clear all' }));
    await waitFor(() => {
      const s = useNotificationsStore.getState();
      expect(s.lastSeenCursor).toBeNull();
      expect(s.lastSeenJiraCursor).toBeNull();
      expect(s.lastSeenGitlabCursor).toBeNull();
    });
  });

  it('states the count when notifications are cached', async () => {
    seed([{ id: 'a' }, { id: 'b' }]);
    renderSection();
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear' })[0]);
    expect((await screen.findByRole('dialog')).textContent).toContain('2 cached notifications');
  });
});
