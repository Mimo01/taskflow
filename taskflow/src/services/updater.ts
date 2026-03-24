/**
 * Update service — wraps @tauri-apps/plugin-updater so components/stores
 * never import the plugin directly. Matches the tauriService pattern.
 */
import { check } from '@tauri-apps/plugin-updater';

export interface UpdateInfo {
  version: string;
  body: string | null;
  date: string | null;
}

export const updaterService = {
  /**
   * Check for an available update.
   * Returns UpdateInfo if update available, null if already up to date.
   * Throws on network/endpoint errors.
   */
  check: async (): Promise<UpdateInfo | null> => {
    const update = await check();
    if (!update) return null;
    return {
      version: update.version,
      body: update.body ?? null,
      date: update.date ?? null,
    };
  },

  /**
   * Download and install update. Calls onProgress with download events.
   * Caller must call relaunch() after this resolves.
   */
  downloadAndInstall: async (
    onProgress?: (event: { event: string; data?: unknown }) => void
  ): Promise<void> => {
    const update = await check();
    if (!update) throw new Error('No update available');
    await update.downloadAndInstall(onProgress);
  },
};
