/**
 * Onboarding wizard state — persisted in Zustand for back-navigation.
 *
 * All field values survive step changes (no clearing on back).
 * Components read from and write to this store; they never own field values.
 * (Anti-pattern to avoid: useState for wizard fields — see RESEARCH.md Pitfall 4)
 */
import { create } from 'zustand';
import type { GitLabProject } from '@/services/gitlab';
import type { JiraProject } from '@/services/jira';
import type { JiraBoard } from '@/services/jira/sprints';

interface OnboardingState {
  step: number;
  jiraUrl: string;
  jiraToken: string;
  jiraProject: string | null;
  jiraProjects: JiraProject[];
  jiraBoards: JiraBoard[];
  jiraBoardId: number | null;
  gitlabUrl: string;
  gitlabToken: string;
  gitlabProject: number | null;
  gitlabProjects: GitLabProject[];
  jiraValidated: boolean;
  gitlabValidated: boolean;
  integrationsVisited: boolean;
  set: (partial: Partial<Omit<OnboardingState, 'set' | 'goNext' | 'goBack'>>) => void;
  goNext: () => void;
  goBack: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  step: 0,
  jiraUrl: '',
  jiraToken: '',
  jiraProject: null,
  jiraProjects: [],
  jiraBoards: [],
  jiraBoardId: null,
  gitlabUrl: '',
  gitlabToken: '',
  gitlabProject: null,
  gitlabProjects: [],
  jiraValidated: false,
  gitlabValidated: false,
  integrationsVisited: false,
  set: (partial) => set(partial),
  goNext: () => set({ step: Math.min(4, get().step + 1) }),
  goBack: () => set({ step: Math.max(0, get().step - 1) }),
}));
