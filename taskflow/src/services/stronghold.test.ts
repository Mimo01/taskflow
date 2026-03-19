import { clearMocks } from '@tauri-apps/api/mocks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory store shared across mock instances
const MockVault = new Map<string, number[]>();
const MockMeta = new Map<string, unknown>();

vi.mock('@tauri-apps/plugin-stronghold', () => {
  const mockStore = {
    insert: vi.fn(async (key: string, data: number[]) => {
      MockVault.set(key, [...data]);
    }),
    get: vi.fn(async (key: string) => {
      const val = MockVault.get(key);
      if (!val) throw new Error(`Key not found: ${key}`);
      return [...val];
    }),
    remove: vi.fn(async (key: string) => {
      MockVault.delete(key);
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
    Client: class MockClient {},
  };
});

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => '/mock/app/data'),
}));

vi.mock('@tauri-apps/plugin-store', () => {
  function LazyStore(_name: string) {
    return {
      get: async (key: string) => MockMeta.get(key) ?? null,
      set: async (key: string, val: unknown) => {
        MockMeta.set(key, val);
      },
      save: async () => {},
      delete: async (key: string) => {
        MockMeta.delete(key);
      },
    };
  }
  return { LazyStore };
});

describe('stronghold service', () => {
  beforeEach(() => {
    MockVault.clear();
    MockMeta.clear();
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

  it('removeSecret causes readSecret to throw', async () => {
    const { storeSecret, readSecret, removeSecret } = await import('./stronghold');
    await storeSecret('jira-pat', 'temp-token');
    await removeSecret('jira-pat');
    await expect(readSecret('jira-pat')).rejects.toThrow();
  });
});
