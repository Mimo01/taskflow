/**
 * Auth store — tracks connection status and selected project/group.
 *
 * IMPORTANT: Never stores token strings. Only boolean auth status and
 * selected project/group identifiers. PATs live in Stronghold only.
 * (Anti-pattern to avoid: Zustand with token strings — see RESEARCH.md)
 */
import { create } from 'zustand';

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

export const useAuthStore = create<AuthState>((set) => ({
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
}));
