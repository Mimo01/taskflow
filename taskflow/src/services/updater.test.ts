import { afterEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted ensures mockCheck is available when vi.mock factory runs
const { mockCheck } = vi.hoisted(() => ({
  mockCheck: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: mockCheck,
}));

import { updaterService } from './updater';

describe('updaterService', () => {
  afterEach(() => {
    mockCheck.mockReset();
  });

  it('returns null when no update available', async () => {
    mockCheck.mockResolvedValue(null);
    const result = await updaterService.check();
    expect(result).toBeNull();
  });

  it('returns UpdateInfo when update is available', async () => {
    mockCheck.mockResolvedValue({
      version: '1.6.0',
      body: '## Changes\n- Fix bug',
      date: '2026-03-24T12:00:00Z',
      downloadAndInstall: vi.fn(),
    });
    const result = await updaterService.check();
    expect(result).toEqual({
      version: '1.6.0',
      body: '## Changes\n- Fix bug',
      date: '2026-03-24T12:00:00Z',
    });
  });

  it('throws on network error', async () => {
    mockCheck.mockRejectedValue(new Error('Network error'));
    await expect(updaterService.check()).rejects.toThrow('Network error');
  });
});
