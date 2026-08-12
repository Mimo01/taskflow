/**
 * Theme service — applies dark/light/system theme and persists preference.
 *
 * Uses Tailwind's 'class' dark mode strategy: toggling 'dark' on <html>.
 * Persists preference via Tauri Store plugin (settings.json).
 * Call loadTheme() before first render to avoid flash of wrong theme.
 *
 * Source: https://v2.tauri.app/plugin/store/
 */
import { LazyStore } from '@tauri-apps/plugin-store';
import type { Density, FontScale } from '../stores/settings.store';

const settingsStore = new LazyStore('settings.json');

export type Theme = 'dark' | 'light' | 'system';

/**
 * Apply a density tier by setting or removing the data-density attribute on
 * document.documentElement. 'default' removes the attribute entirely so no
 * density variant is active (CSS baseline). 'compact' and 'comfortable' set
 * the attribute so @variant density-compact / density-comfortable rules fire.
 * Does not persist — density is managed by the settings store.
 */
export function applyDensity(density: Density): void {
  if (density === 'default') {
    document.documentElement.removeAttribute('data-density');
  } else {
    document.documentElement.setAttribute('data-density', density);
  }
}

/**
 * Apply a font scale tier by setting or removing the data-font-scale attribute
 * on document.documentElement. 'md' removes the attribute entirely so no
 * scaling rule is active (CSS baseline, 16px root). Other tiers set the
 * attribute so the html[data-font-scale="..."] rules in index.css fire.
 * Does not persist — font scale is managed by the settings store.
 */
export function applyFontScale(scale: FontScale): void {
  if (scale === 'md') {
    document.documentElement.removeAttribute('data-font-scale');
  } else {
    document.documentElement.setAttribute('data-font-scale', scale);
  }
}

/**
 * Apply a theme by toggling the 'dark' class on document.documentElement.
 * Does not persist — call saveTheme() to persist.
 */
export function applyTheme(theme: Theme): void {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}

/**
 * Persist the theme preference to Tauri Store.
 */
export async function saveTheme(theme: Theme): Promise<void> {
  await settingsStore.set('theme', theme);
  await settingsStore.save();
}

/**
 * Load the persisted theme preference and apply it.
 * Falls back to 'system' if no preference is saved.
 */
export async function loadTheme(): Promise<void> {
  const theme = (await settingsStore.get<Theme>('theme')) ?? 'system';
  applyTheme(theme);
}

/**
 * Read the persisted Zustand settings blob and apply both density and font
 * scale before first paint. Falls back to the baseline values ('default' /
 * 'md') if no preference is saved or parsing fails.
 */
export async function loadAppearance(): Promise<void> {
  try {
    const raw = await settingsStore.get<string>('settings-store');
    const parsed =
      typeof raw === 'string'
        ? (JSON.parse(raw) as { state?: { density?: Density; fontScale?: FontScale } })
        : null;
    applyDensity(parsed?.state?.density ?? 'default');
    applyFontScale(parsed?.state?.fontScale ?? 'md');
  } catch {
    applyDensity('default');
    applyFontScale('md');
  }
}
