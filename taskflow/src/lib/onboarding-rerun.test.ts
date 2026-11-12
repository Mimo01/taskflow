import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn(async (k: string) => (k === 'jira-pat' ? 'jt' : 'gt')),
}));

import { useAuthStore } from '@/stores/auth.store';
import { useOnboardingStore } from '@/stores/onboarding.store';
import {
  buildRerunSeed,
  landingStepFor,
  needsWizardRerun,
  startWizardRerun,
  WIZARD_STEPS,
  WIZARD_VERSION,
} from './onboarding-rerun';

const auth = {
  jiraBaseUrl: 'https://j',
  gitlabBaseUrl: 'https://g',
  activeJiraProject: 'P',
  jiraBoardIds: { P: 42 },
  activeGitlabProject: 7,
};

describe('onboarding-rerun', () => {
  beforeEach(() => vi.clearAllMocks());

  it('has the expected steps and version invariant', () => {
    expect(WIZARD_STEPS.map((s) => s.label)).toEqual([
      'Welcome',
      'Jira',
      'GitLab',
      'Integrations',
      'Done',
    ]);
    expect(WIZARD_STEPS[3].since).toBe(2);
    expect(WIZARD_VERSION).toBe(Math.max(...WIZARD_STEPS.map((s) => s.since)));
  });

  it('landingStepFor', () => {
    expect(landingStepFor(1)).toBe(3);
    expect(landingStepFor(0)).toBe(0);
    expect(landingStepFor(WIZARD_VERSION)).toBe(0);
  });

  it('needsWizardRerun', () => {
    expect(needsWizardRerun({ onboardingComplete: true, onboardingVersion: 1 })).toBe(true);
    expect(needsWizardRerun({ onboardingComplete: false, onboardingVersion: 0 })).toBe(false);
    expect(needsWizardRerun({ onboardingComplete: true, onboardingVersion: WIZARD_VERSION })).toBe(
      false,
    );
  });

  it('buildRerunSeed', () => {
    const seed = buildRerunSeed({ auth, jiraToken: 'a', gitlabToken: 'b', step: 3 });
    expect(seed).toMatchObject({
      step: 3,
      rerunActive: true,
      jiraUrl: 'https://j',
      jiraToken: 'a',
      jiraProject: 'P',
      jiraProjects: [],
      jiraBoards: [],
      jiraBoardId: 42,
      gitlabUrl: 'https://g',
      gitlabToken: 'b',
      gitlabProject: 7,
      gitlabProjects: [],
      integrationsVisited: false,
      jiraValidated: true,
      gitlabValidated: true,
    });
    const s0 = buildRerunSeed({
      auth: { ...auth, activeJiraProject: null },
      jiraToken: '',
      gitlabToken: '',
      step: 0,
    });
    expect(s0.jiraBoardId).toBeNull();
    expect(s0.jiraValidated).toBe(false);
    expect(s0.gitlabValidated).toBe(false);
  });

  it('startWizardRerun writes the seed into the onboarding store', async () => {
    useAuthStore.setState({ jiraBaseUrl: 'https://j2' });
    await startWizardRerun(3);
    const s = useOnboardingStore.getState();
    expect(s.step).toBe(3);
    expect(s.rerunActive).toBe(true);
    expect(s.jiraUrl).toBe('https://j2');
    expect(s.jiraToken).toBe('jt');
    expect(s.gitlabToken).toBe('gt');
  });
});
