import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock is hoisted before imports, so the factory must not reference
// outer-scope variables. vi.fn() inside class fields is safe here because
// Vitest hoists the entire vi.mock call (including the factory body).
vi.mock('@tauri-apps/plugin-store', () => {
  class LazyStore {
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue(undefined);
    save = vi.fn().mockResolvedValue(undefined);
    delete = vi.fn().mockResolvedValue(undefined);
  }
  return { LazyStore };
});

// Import after mock registration. settingsLazyStore is the singleton LazyStore
// instance created at module load time — we can spy on it directly.
import { persistChangelogBeforeRestart, settingsLazyStore } from './tauri-storage';

// Cast to access the vi.fn() methods that the mock class installed.
const store = settingsLazyStore as unknown as {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
};

describe('persistChangelogBeforeRestart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore safe defaults after clearAllMocks resets implementations.
    store.set.mockResolvedValue(undefined);
    store.save.mockResolvedValue(undefined);
  });

  it('reads the store key, patches lastSeenChangelog, and writes back a JSON string', async () => {
    const existing = {
      state: { theme: 'system', lastSeenChangelog: null, lastSeenVersion: null },
      version: 21,
    };
    store.get.mockResolvedValue(JSON.stringify(existing));

    await persistChangelogBeforeRestart('## v2.0\n- New stuff');

    expect(store.set).toHaveBeenCalledOnce();
    const [key, value] = store.set.mock.calls[0] as [string, string];
    expect(key).toBe('settings-store');
    // Must be a string — createJSONStorage expects to JSON.parse the stored value on read.
    expect(typeof value).toBe('string');
    const parsed = JSON.parse(value) as { state: Record<string, unknown>; version: number };
    expect(parsed.state.lastSeenChangelog).toBe('## v2.0\n- New stuff');
    // All other state fields must survive the patch.
    expect(parsed.state.theme).toBe('system');
    // Schema version must be preserved, not reset to a hardcoded value.
    expect(parsed.version).toBe(21);
    expect(store.save).toHaveBeenCalledOnce();
  });

  it('sets lastSeenChangelog to null when markdown is null', async () => {
    const existing = {
      state: { lastSeenChangelog: '## old', lastSeenVersion: '1.8.0' },
      version: 20,
    };
    store.get.mockResolvedValue(JSON.stringify(existing));

    await persistChangelogBeforeRestart(null);

    const [, value] = store.set.mock.calls[0] as [string, string];
    const parsed = JSON.parse(value) as { state: Record<string, unknown>; version: number };
    expect(parsed.state.lastSeenChangelog).toBeNull();
    expect(parsed.state.lastSeenVersion).toBe('1.8.0');
  });

  it('handles a completely empty store (get returns null)', async () => {
    store.get.mockResolvedValue(null);

    await persistChangelogBeforeRestart('## v1.0\n- Init');

    const [key, value] = store.set.mock.calls[0] as [string, string];
    expect(key).toBe('settings-store');
    expect(typeof value).toBe('string');
    const parsed = JSON.parse(value) as { state: Record<string, unknown>; version: number };
    expect(parsed.state.lastSeenChangelog).toBe('## v1.0\n- Init');
  });

  it('recovers gracefully from a previously corrupted store (non-JSON string)', async () => {
    // '[object Object]' is what gets stored when the original broken code wrote a
    // plain object and the LazyStore later coerced it on read.
    store.get.mockResolvedValue('[object Object]');

    await expect(persistChangelogBeforeRestart('## recovery')).resolves.toBeUndefined();

    const [, value] = store.set.mock.calls[0] as [string, string];
    expect(typeof value).toBe('string');
    const parsed = JSON.parse(value) as { state: Record<string, unknown>; version: number };
    expect(parsed.state.lastSeenChangelog).toBe('## recovery');
  });

  it('writes a JSON string not a plain object — regression guard for original bug', async () => {
    const existing = { state: { lastSeenChangelog: null }, version: 21 };
    store.get.mockResolvedValue(JSON.stringify(existing));

    await persistChangelogBeforeRestart('## v2.0');

    const [, writtenValue] = store.set.mock.calls[0] as [string, unknown];
    // The original bug wrote a plain object. Zustand's createJSONStorage calls
    // JSON.parse on whatever storage.getItem returns — a non-string object gets
    // coerced to "[object Object]" and throws SyntaxError, wiping all settings.
    expect(typeof writtenValue).toBe('string');
    expect(() => JSON.parse(writtenValue as string)).not.toThrow();
  });
});
