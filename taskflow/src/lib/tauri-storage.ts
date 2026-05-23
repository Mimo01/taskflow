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
 *
 * IMPORTANT: Zustand's createJSONStorage adapter stores the entire state as a
 * JSON-encoded *string* under the store key (it calls JSON.stringify before
 * storage.setItem). We must therefore read the raw string, JSON.parse it,
 * patch the nested state object, JSON.stringify it again, and write the string
 * back — not write a plain object. Writing a plain object would corrupt the
 * store because Zustand's getItem would then receive an object instead of a
 * string and JSON.parse would throw on the next launch.
 */
export async function persistChangelogBeforeRestart(markdown: string | null): Promise<void> {
  const STORE_KEY = 'settings-store';
  // The value stored by Zustand's createJSONStorage is a JSON-encoded string.
  const raw = await settingsLazyStore.get<string>(STORE_KEY);
  let parsed: { state: Record<string, unknown>; version: number } = { state: {}, version: 22 };
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw) as { state: Record<string, unknown>; version: number };
    } catch {
      // If the stored value is unparseable, start from a clean object.
      // The existing store version is unknown so preserve what we can.
    }
  }
  const patched = {
    ...parsed,
    state: {
      ...parsed.state,
      lastSeenChangelog: markdown,
    },
  };
  // Write back as a JSON string to match what createJSONStorage expects on read.
  await settingsLazyStore.set(STORE_KEY, JSON.stringify(patched));
  await settingsLazyStore.save();
}
