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
  /** Jira user display name from GET /rest/api/2/myself .displayName — for notification filtering. */
  jiraUserDisplayName: string | null;
  /** Jira username from GET /rest/api/2/myself .name — for @mention matching in comments. */
  jiraUsername: string | null;
  /** GitLab user ID from validation response .id — for self-exclusion in MR notes. */
  gitlabUserId: number | null;
  setJiraConnected: (connected: boolean, baseUrl?: string) => void;
  setGitlabConnected: (connected: boolean, baseUrl?: string) => void;
  setActiveJiraProject: (project: string | null) => void;
  setActiveGitlabGroup: (group: string | null) => void;
  /** Set Jira user identity for notification filtering. */
  setJiraUser: (displayName: string, username: string) => void;
  /** Set GitLab user ID for self-exclusion in MR notes. */
  setGitlabUserId: (id: number) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  jiraConnected: false,
  gitlabConnected: false,
  jiraBaseUrl: null,
  gitlabBaseUrl: null,
  activeJiraProject: null,
  activeGitlabGroup: null,
  jiraUserDisplayName: null,
  jiraUsername: null,
  gitlabUserId: null,
  setJiraConnected: (connected, baseUrl) =>
    set({ jiraConnected: connected, jiraBaseUrl: baseUrl ?? null }),
  setGitlabConnected: (connected, baseUrl) =>
    set({ gitlabConnected: connected, gitlabBaseUrl: baseUrl ?? null }),
  setActiveJiraProject: (project) => set({ activeJiraProject: project }),
  setActiveGitlabGroup: (group) => set({ activeGitlabGroup: group }),
  setJiraUser: (displayName, username) =>
    set({ jiraUserDisplayName: displayName, jiraUsername: username }),
  setGitlabUserId: (id) => set({ gitlabUserId: id }),
}));
