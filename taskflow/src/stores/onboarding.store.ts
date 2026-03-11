/**
 * Onboarding wizard state — persisted in Zustand for back-navigation.
 *
 * All field values survive step changes (no clearing on back).
 * Components read from and write to this store; they never own field values.
 * (Anti-pattern to avoid: useState for wizard fields — see RESEARCH.md Pitfall 4)
 */
import { create } from 'zustand';
import type { JiraProject } from '@/services/jira';
import type { GitLabGroup } from '@/services/gitlab';

interface OnboardingState {
  step: number;
  jiraUrl: string;
  jiraToken: string;
  jiraProject: string | null;
  jiraProjects: JiraProject[];
  gitlabUrl: string;
  gitlabToken: string;
  gitlabGroup: string | null;
  gitlabGroups: GitLabGroup[];
  role: 'developer' | 'pm' | null;
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
  gitlabGroup: null,
  gitlabGroups: [],
  role: null,
  jiraValidated: false,
  gitlabValidated: false,
  set: (partial) => set(partial),
  goNext: () => set({ step: get().step + 1 }),
  goBack: () => set({ step: Math.max(0, get().step - 1) }),
}));
