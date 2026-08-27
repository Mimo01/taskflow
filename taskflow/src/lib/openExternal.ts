/**
 * openExternal — the single sanctioned boundary for opening external URLs.
 *
 * Every "open in browser" button and every clickable link inside rendered
 * descriptions/comments MUST route through this module rather than importing
 * `openUrl` from `@tauri-apps/plugin-opener` directly. This is what lets the
 * user-selected browser preference (Settings → Links) apply app-wide, and
 * keeps the fallback-to-default-browser behavior in exactly one place.
 *
 * Fallback chain (per locked decision: fail quietly, no toast, no error):
 *   1. If a browser is selected (`externalBrowser` !== null), try launching
 *      the URL with that browser.
 *   2. On failure (or when no browser is selected), try the OS default
 *      browser.
 *   3. If that also fails, resolve anyway — never throw out of this function.
 *      An optional `onFallbackFailed` callback lets a caller (SubtasksPanel)
 *      add one more rung (`window.open`) without leaking `openUrl` back out
 *      of this module.
 */
import { openUrl } from '@tauri-apps/plugin-opener';
import { useSettingsStore } from '@/stores/settings.store';

export interface BrowserInfo {
  id: string;
  label: string;
  path: string;
}

export async function openExternal(url: string, onFallbackFailed?: () => void): Promise<void> {
  const selected = useSettingsStore.getState().externalBrowser;

  if (selected) {
    try {
      await openUrl(url, selected);
      return;
    } catch {
      // Selected browser could not be launched — fall through to default.
    }
  }

  try {
    await openUrl(url);
  } catch {
    onFallbackFailed?.();
  }
}

/**
 * openExternalWith — per-link explicit-browser override for the right-click
 * "Open in {browser}" / "Open in System Default" context menu (quick task
 * 260827-f6e). Deliberately bypasses `useSettingsStore.getState().externalBrowser`
 * — the Settings default browser is a global preference, but this is a one-off
 * escape hatch for a single link the user right-clicked. Never reads or writes
 * the persisted setting.
 *
 * `browserPath` non-null → launch that specific browser. `browserPath` null →
 * System Default (calls `openUrl` with the URL only, same as the fallback rung
 * in `openExternal`). Fails quietly like `openExternal` — never throws.
 */
export async function openExternalWith(url: string, browserPath: string | null): Promise<void> {
  try {
    if (browserPath) {
      await openUrl(url, browserPath);
    } else {
      await openUrl(url);
    }
  } catch {
    // Fail quietly — no toast, matching this module's documented convention.
  }
}
