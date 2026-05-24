/**
 * Auth store — tracks connection status and selected project/group.
 *
 * IMPORTANT: Never stores token strings. Only boolean auth status and
 * selected project/group identifiers. PATs live in Stronghold only.
 * (Anti-pattern to avoid: Zustand with token strings — see RESEARCH.md)
 *
 * Persisted via Tauri Store plugin so connection state survives restarts.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createTauriStorage } from '../lib/tauri-storage';

/** Default values for all persisted auth data fields (excludes _hasHydrated and actions). */
const initialAuthState = {
  jiraConnected: false,
  gitlabConnected: false,
  jiraBaseUrl: null as string | null,
  gitlabBaseUrl: null as string | null,
  activeJiraProject: null as string | null,
  activeGitlabProject: null as number | null,
  activeGitlabProjectPath: null as string | null,
  jiraUserDisplayName: null as string | null,
  jiraUsername: null as string | null,
  jiraUserKey: null as string | null,
  gitlabUserId: null as number | null,
  gitlabUsername: null as string | null,
};

interface AuthState {
  jiraConnected: boolean;
  gitlabConnected: boolean;
  jiraBaseUrl: string | null;
  gitlabBaseUrl: string | null;
  activeJiraProject: string | null;
  activeGitlabProject: number | null;
  activeGitlabProjectPath: string | null;
  /** Jira user display name from GET /rest/api/2/myself .displayName — for notification filtering. */
  jiraUserDisplayName: string | null;
  /** Jira username from GET /rest/api/2/myself .name — for @mention matching in comments. */
  jiraUsername: string | null;
  /** Jira user key from GET /rest/api/2/myself .key — for Tempo schedule API userKeys param. */
  jiraUserKey: string | null;
  /** GitLab user ID from validation response .id — for self-exclusion in MR notes. */
  gitlabUserId: number | null;
  /** GitLab username from validation response .username — for @mention detection. */
  gitlabUsername: string | null;
  /**
   * True once the Tauri async storage rehydration has completed.
   * Transient — not persisted. Used by components to avoid collapsing
   * loading states prematurely before real store values are available.
   */
  _hasHydrated: boolean;
  setJiraConnected: (connected: boolean, baseUrl?: string) => void;
  setGitlabConnected: (connected: boolean, baseUrl?: string) => void;
  setActiveJiraProject: (project: string | null) => void;
  setActiveGitlabProject: (id: number | null, path: string | null) => void;
  /** Set Jira user identity for notification filtering and Tempo API. */
  setJiraUser: (displayName: string, username: string, key?: string | null) => void;
  /** Set GitLab user ID for self-exclusion in MR notes. */
  setGitlabUserId: (id: number) => void;
  /** Set GitLab username for @mention detection. */
  setGitlabUsername: (username: string | null) => void;
  /**
   * Reset all auth data fields to defaults (all null/false).
   * Preserves _hasHydrated and action functions (merge-mode set).
   */
  resetAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...initialAuthState,
      _hasHydrated: false,
      setJiraConnected: (connected, baseUrl) =>
        set((state) => ({
          jiraConnected: connected,
          jiraBaseUrl: baseUrl !== undefined ? baseUrl : state.jiraBaseUrl,
        })),
      setGitlabConnected: (connected, baseUrl) =>
        set((state) => ({
          gitlabConnected: connected,
          gitlabBaseUrl: baseUrl !== undefined ? baseUrl : state.gitlabBaseUrl,
        })),
      setActiveJiraProject: (project) => set({ activeJiraProject: project }),
      setActiveGitlabProject: (id, path) =>
        set({ activeGitlabProject: id, activeGitlabProjectPath: path }),
      setJiraUser: (displayName, username, key) =>
        set({ jiraUserDisplayName: displayName, jiraUsername: username, jiraUserKey: key ?? null }),
      setGitlabUserId: (id) => set({ gitlabUserId: id }),
      setGitlabUsername: (username) => set({ gitlabUsername: username }),
      resetAuth: () => set({ ...initialAuthState }),
    }),
    {
      name: 'auth-store',
      storage: createTauriStorage('auth.json'),
      // Exclude _hasHydrated from persistence — it is a transient runtime flag.
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _hasHydrated, ...persisted } = state as AuthState & Record<string, unknown>;
        return persisted;
      },
      onRehydrateStorage: () => (state) => {
        if (state?.activeJiraProject && /^\d+$/.test(state.activeJiraProject)) {
          useAuthStore.setState({ activeJiraProject: null });
        }
        // Mark hydration complete regardless of whether state was available.
        useAuthStore.setState({ _hasHydrated: true });
      },
    },
  ),
);
