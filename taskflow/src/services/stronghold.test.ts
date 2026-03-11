import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks';

// We mock the @tauri-apps/plugin-stronghold module so tests don't need
// the Tauri runtime. The service uses lazy singletons — reset between tests.
vi.mock('@tauri-apps/plugin-stronghold', () => {
  const store = new Map<string, number[]>();

  const mockStore = {
    insert: vi.fn(async (key: string, data: number[]) => {
      store.set(key, data);
    }),
    get: vi.fn(async (key: string) => {
      const val = store.get(key);
      if (!val) throw new Error(`Key not found: ${key}`);
      return val;
    }),
    remove: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  };

  const mockClient = {
    getStore: vi.fn(() => mockStore),
  };

  const mockStronghold = {
    loadClient: vi.fn(async () => mockClient),
    createClient: vi.fn(async () => mockClient),
    save: vi.fn(async () => {}),
  };

  return {
    Stronghold: {
      load: vi.fn(async () => mockStronghold),
    },
    Client: vi.fn(),
    _mockStore: mockStore,
    _mockStronghold: mockStronghold,
  };
});

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => '/mock/app/data'),
}));

vi.mock('@tauri-apps/plugin-store', () => {
  const map = new Map<string, unknown>();
  return {
    LazyStore: vi.fn().mockImplementation(() => ({
      get: vi.fn(async (key: string) => map.get(key) ?? null),
      set: vi.fn(async (key: string, val: unknown) => map.set(key, val)),
      save: vi.fn(async () => {}),
    })),
  };
});

describe('stronghold service', () => {
  beforeEach(async () => {
    // Reset module so singletons (_stronghold, _store) are cleared between tests
    vi.resetModules();
  });

  afterEach(() => {
    clearMocks();
  });

  it('storeSecret + readSecret round-trip returns the stored value', async () => {
    const { storeSecret, readSecret } = await import('./stronghold');
    await storeSecret('jira-pat', 'my-token-abc');
    const result = await readSecret('jira-pat');
    expect(result).toBe('my-token-abc');
  });

  it('readSecret returns correct value for multiple keys', async () => {
    const { storeSecret, readSecret } = await import('./stronghold');
    await storeSecret('jira-pat', 'jira-secret');
    await storeSecret('gitlab-pat', 'gitlab-secret');
    expect(await readSecret('jira-pat')).toBe('jira-secret');
    expect(await readSecret('gitlab-pat')).toBe('gitlab-secret');
  });

  it('removeSecret causes readSecret to throw or return empty', async () => {
    const { storeSecret, readSecret, removeSecret } = await import('./stronghold');
    await storeSecret('jira-pat', 'temp-token');
    await removeSecret('jira-pat');
    await expect(readSecret('jira-pat')).rejects.toThrow();
  });
});
