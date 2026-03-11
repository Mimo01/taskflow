import { describe, it, expect, beforeEach, vi } from 'vitest';

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

describe('applyTheme', () => {
  beforeEach(() => {
    // Reset html class list before each test
    document.documentElement.classList.remove('dark');
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
        matches: query !== '(prefers-color-scheme: dark)',
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
