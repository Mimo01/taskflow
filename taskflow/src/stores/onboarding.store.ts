/**
 * Onboarding wizard state — persisted in Zustand for back-navigation.
 *
 * All field values survive step changes (no clearing on back).
 * Components read from and write to this store; they never own field values.
 * (Anti-pattern to avoid: useState for wizard fields — see RESEARCH.md Pitfall 4)
 */
import { create } from 'zustand';
import type { JiraProject } from '@/services/jira';
import type { GitLabProject } from '@/services/gitlab';

interface OnboardingState {
  step: number;
  jiraUrl: string;
  jiraToken: string;
  jiraProject: string | null;
  jiraProjects: JiraProject[];
  gitlabUrl: string;
  gitlabToken: string;
  gitlabProject: number | null;
  gitlabProjects: GitLabProject[];
  role: 'developer' | 'pm' | 'tech-lead' | null;
  jiraValidated: boolean;
  gitlabValidated: boolean;
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
  gitlabUrl: '',
  gitlabToken: '',
  gitlabProject: null,
  gitlabProjects: [],
  role: null,
  jiraValidated: false,
  gitlabValidated: false,
  set: (partial) => set(partial),
  goNext: () => set({ step: get().step + 1 }),
  goBack: () => set({ step: Math.max(0, get().step - 1) }),
}));
