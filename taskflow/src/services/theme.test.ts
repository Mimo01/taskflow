import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-store', () => {
  const map = new Map<string, unknown>();
  function LazyStore(_name: string) {
    return {
      get: async (key: string) => map.get(key) ?? null,
      set: async (key: string, val: unknown) => {
        map.set(key, val);
      },
      save: async () => {},
    };
  }
  return { LazyStore };
});

describe('applyTheme', () => {
  beforeEach(async () => {
    document.documentElement.classList.remove('dark');
    vi.resetModules();
  });

  it('applyTheme("dark") adds "dark" class to document.documentElement', async () => {
    const { applyTheme } = await import('./theme');
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('applyTheme("light") removes "dark" class from document.documentElement', async () => {
    document.documentElement.classList.add('dark');
    const { applyTheme } = await import('./theme');
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('applyTheme("system") adds "dark" class when matchMedia prefers dark', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    const { applyTheme } = await import('./theme');
    applyTheme('system');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('applyTheme("system") removes "dark" class when matchMedia prefers light', async () => {
    document.documentElement.classList.add('dark');
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    const { applyTheme } = await import('./theme');
    applyTheme('system');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
