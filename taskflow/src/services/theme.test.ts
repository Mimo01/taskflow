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

describe('applyDensity', () => {
  beforeEach(async () => {
    document.documentElement.removeAttribute('data-density');
    vi.resetModules();
  });

  it('applyDensity("compact") sets data-density="compact" on document.documentElement', async () => {
    const { applyDensity } = await import('./theme');
    applyDensity('compact');
    expect(document.documentElement.getAttribute('data-density')).toBe('compact');
  });

  it('applyDensity("default") removes data-density from document.documentElement', async () => {
    document.documentElement.setAttribute('data-density', 'compact');
    const { applyDensity } = await import('./theme');
    applyDensity('default');
    expect(document.documentElement.hasAttribute('data-density')).toBe(false);
  });
});

describe('applyFontScale', () => {
  beforeEach(async () => {
    document.documentElement.removeAttribute('data-font-scale');
    vi.resetModules();
  });

  it('applyFontScale("xl") sets data-font-scale="xl" on document.documentElement', async () => {
    const { applyFontScale } = await import('./theme');
    applyFontScale('xl');
    expect(document.documentElement.getAttribute('data-font-scale')).toBe('xl');
  });

  it('applyFontScale("sm") sets data-font-scale="sm" on document.documentElement', async () => {
    const { applyFontScale } = await import('./theme');
    applyFontScale('sm');
    expect(document.documentElement.getAttribute('data-font-scale')).toBe('sm');
  });

  it('applyFontScale("md") removes data-font-scale from document.documentElement', async () => {
    document.documentElement.setAttribute('data-font-scale', 'lg');
    const { applyFontScale } = await import('./theme');
    applyFontScale('md');
    expect(document.documentElement.hasAttribute('data-font-scale')).toBe(false);
  });
});

describe('loadAppearance', () => {
  beforeEach(async () => {
    document.documentElement.removeAttribute('data-density');
    document.documentElement.removeAttribute('data-font-scale');
    vi.resetModules();
  });

  it('applies baseline (no attributes) when no persisted blob exists', async () => {
    const { loadAppearance } = await import('./theme');
    await loadAppearance();
    expect(document.documentElement.hasAttribute('data-density')).toBe(false);
    expect(document.documentElement.hasAttribute('data-font-scale')).toBe(false);
  });

  it('applies both persisted density and font scale from the settings-store blob', async () => {
    const { LazyStore } = await import('@tauri-apps/plugin-store');
    const store = new LazyStore('settings.json');
    await store.set(
      'settings-store',
      JSON.stringify({ state: { density: 'compact', fontScale: 'lg' } }),
    );
    const { loadAppearance } = await import('./theme');
    await loadAppearance();
    expect(document.documentElement.getAttribute('data-density')).toBe('compact');
    expect(document.documentElement.getAttribute('data-font-scale')).toBe('lg');
  });
});
