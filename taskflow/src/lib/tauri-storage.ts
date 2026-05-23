import { LazyStore } from '@tauri-apps/plugin-store';
import { createJSONStorage } from 'zustand/middleware';

export function createTauriStorage(filename: string) {
  const store = new LazyStore(filename);
  return createJSONStorage(() => ({
    getItem: async (name: string): Promise<string | null> => {
      const value = await store.get<string>(name);
      return value ?? null;
    },
    setItem: async (name: string, value: string): Promise<void> => {
      await store.set(name, value);
      await store.save();
    },
    removeItem: async (name: string): Promise<void> => {
      await store.delete(name);
      await store.save();
    },
  }));
}

/**
 * Singleton LazyStore for settings.json — used by the settings store's persist
 * middleware. Exported so that code running just before an app restart (e.g.
 * UpdateDialog) can write directly to the store and await the save, bypassing
 * Zustand's fire-and-forget persist machinery.
 */
export const settingsLazyStore = new LazyStore('settings.json');

/**
 * Writes lastSeenChangelog into the persisted settings JSON synchronously
 * (i.e. fully awaited) before calling invoke('plugin:process|restart').
 *
 * Background: Zustand's persist middleware calls storage.setItem() but does
 * not await the returned Promise before the calling code continues. When
 * handleUpdateNow() calls setLastSeenChangelog() and then immediately
 * invoke('plugin:process|restart'), the Tauri process is killed before the
 * async store.save() issued by the persist middleware has a chance to run.
 * This function bypasses that race by reading the current persisted state
 * from the store, patching lastSeenChangelog, writing it back, and awaiting
 * store.save() — all before control returns to the caller.
 */
export async function persistChangelogBeforeRestart(markdown: string | null): Promise<void> {
  const STORE_KEY = 'settings-store';
  const existing = await settingsLazyStore.get<{ state: Record<string, unknown>; version: number }>(
    STORE_KEY,
  );
  const patched = {
    state: {
      ...(existing?.state ?? {}),
      lastSeenChangelog: markdown,
    },
    version: existing?.version ?? 18,
  };
  await settingsLazyStore.set(STORE_KEY, patched);
  await settingsLazyStore.save();
}
