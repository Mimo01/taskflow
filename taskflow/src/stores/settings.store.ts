/**
 * Settings store — role and theme, persisted via Tauri Store plugin.
 *
 * Uses Zustand persist middleware with a custom storage adapter that
 * reads/writes via LazyStore from @tauri-apps/plugin-store.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { LazyStore } from '@tauri-apps/plugin-store';
import type { Theme } from '../services/theme';

const tauriStore = new LazyStore('settings.json');

/**
 * Custom storage adapter for Zustand persist middleware,
 * backed by Tauri Store plugin for cross-platform persistence.
 */
const tauriStorage = createJSONStorage(() => ({
  getItem: async (name: string): Promise<string | null> => {
    const value = await tauriStore.get<string>(name);
    return value ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await tauriStore.set(name, value);
    await tauriStore.save();
  },
  removeItem: async (name: string): Promise<void> => {
    await tauriStore.delete(name);
    await tauriStore.save();
  },
}));

interface SettingsState {
  role: 'developer' | 'pm' | 'tech-lead' | null;
  theme: Theme;
  onboardingComplete: boolean;
  /** Number of days without update before an MR is considered stale. Default: 3. */
  staleMrThresholdDays: number;
  /** Notification polling interval in seconds. Default: 60. Clamped to [30, 300]. */
  notificationPollIntervalSecs: number;
  /** Enable OS desktop notifications for Jira comment mentions. Default: true. */
  osNotifJiraEnabled: boolean;
  /** Enable OS desktop notifications for GitLab MR notes. Default: true. */
  osNotifGitlabEnabled: boolean;
  /** Discovered story points custom field key. Defaults to customfield_10016. */
  storyPointsFieldKey: string;
  /** Enable API call logging for debug inspection. Default: false. */
  debugMode: boolean;
  setDebugMode: (v: boolean) => void;
  setRole: (role: 'developer' | 'pm' | 'tech-lead') => void;
  setTheme: (theme: Theme) => void;
  setOnboardingComplete: (complete: boolean) => void;
  setStaleMrThresholdDays: (days: number) => void;
  /** Clamps input to [30, 300] before storing. */
  setNotificationPollIntervalSecs: (secs: number) => void;
  setOsNotifJiraEnabled: (v: boolean) => void;
  setOsNotifGitlabEnabled: (v: boolean) => void;
  setStoryPointsFieldKey: (key: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      role: null,
      theme: 'system',
      onboardingComplete: false,
      staleMrThresholdDays: 3,
      notificationPollIntervalSecs: 60,
      osNotifJiraEnabled: true,
      osNotifGitlabEnabled: true,
      storyPointsFieldKey: 'customfield_10016',
      debugMode: false,
      setDebugMode: (v) => set({ debugMode: v }),
      setRole: (role) => set({ role }),
      setTheme: (theme) => set({ theme }),
      setOnboardingComplete: (complete) => set({ onboardingComplete: complete }),
      setStaleMrThresholdDays: (days) => set({ staleMrThresholdDays: days }),
      setNotificationPollIntervalSecs: (secs) =>
        set({ notificationPollIntervalSecs: Math.max(30, Math.min(300, secs)) }),
      setOsNotifJiraEnabled: (v) => set({ osNotifJiraEnabled: v }),
      setOsNotifGitlabEnabled: (v) => set({ osNotifGitlabEnabled: v }),
      setStoryPointsFieldKey: (key) => set({ storyPointsFieldKey: key }),
    }),
    {
      name: 'settings-store',
      storage: tauriStorage,
    },
  ),
);
