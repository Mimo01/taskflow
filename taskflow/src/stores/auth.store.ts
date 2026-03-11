/**
 * Auth store — tracks connection status and selected project/group.
 *
 * IMPORTANT: Never stores token strings. Only boolean auth status and
 * selected project/group identifiers. PATs live in Stronghold only.
 * (Anti-pattern to avoid: Zustand with token strings — see RESEARCH.md)
 *
 * Persisted via Tauri Store plugin so URLs and connection state survive restarts.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { LazyStore } from '@tauri-apps/plugin-store';

const tauriStore = new LazyStore('auth.json');

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

interface AuthState {
  jiraConnected: boolean;
  gitlabConnected: boolean;
  jiraBaseUrl: string | null;
  gitlabBaseUrl: string | null;
  activeJiraProject: string | null;
  activeGitlabGroup: string | null;
  setJiraConnected: (connected: boolean, baseUrl?: string) => void;
  setGitlabConnected: (connected: boolean, baseUrl?: string) => void;
  setActiveJiraProject: (project: string | null) => void;
  setActiveGitlabGroup: (group: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      jiraConnected: false,
      gitlabConnected: false,
      jiraBaseUrl: null,
      gitlabBaseUrl: null,
      activeJiraProject: null,
      activeGitlabGroup: null,
      setJiraConnected: (connected, baseUrl) =>
        set({ jiraConnected: connected, jiraBaseUrl: baseUrl ?? null }),
      setGitlabConnected: (connected, baseUrl) =>
        set({ gitlabConnected: connected, gitlabBaseUrl: baseUrl ?? null }),
      setActiveJiraProject: (project) => set({ activeJiraProject: project }),
      setActiveGitlabGroup: (group) => set({ activeGitlabGroup: group }),
    }),
    {
      name: 'auth-store',
      storage: tauriStorage,
    },
  ),
);
