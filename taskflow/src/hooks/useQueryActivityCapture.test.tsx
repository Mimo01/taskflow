import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useQueryActivityStore } from '../stores/query-activity.store';
import { useSettingsStore } from '../stores/settings.store';
import { useQueryActivityCapture } from './useQueryActivityCapture';

function setup() {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  renderHook(() => useQueryActivityCapture(), { wrapper });
  return client;
}

describe('useQueryActivityCapture', () => {
  beforeEach(() => {
    useQueryActivityStore.getState().clear();
  });

  it('records fetch then success with keyLabel and queryHash when capture is on', async () => {
    useSettingsStore.setState({ devToolsEnabled: true, requestLogging: true });
    const client = setup();
    await client.fetchQuery({ queryKey: ['issue', 'ABC-1'], queryFn: async () => 'ok' });
    // newest first
    const events = [...useQueryActivityStore.getState().events].reverse();
    expect(events.map((e) => e.kind)).toEqual(['fetch', 'success']);
    expect(events[0].keyLabel).toContain('issue');
    expect(events[0].queryHash).toBe(JSON.stringify(['issue', 'ABC-1']));
  });

  it.each([
    { devToolsEnabled: false, requestLogging: true },
    { devToolsEnabled: true, requestLogging: false },
  ])('records nothing when capture is off (%o)', async (settings) => {
    useSettingsStore.setState(settings);
    const client = setup();
    await client.fetchQuery({ queryKey: ['x'], queryFn: async () => 1 });
    expect(useQueryActivityStore.getState().events).toHaveLength(0);
  });
});
