/**
 * Versioned onboarding wizard + pre-fill helper.
 *
 * RULE: when a release adds or changes a wizard step, bump WIZARD_VERSION and set that
 * step's `since` to the new value. Users who completed an older version are shown the
 * wizard again (pre-filled), starting at the first step that changed.
 *
 * Baseline: version 1 = the wizard before Release Management was added to Integrations
 * (261112-lrr); version 2 = with it.
 */
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useOnboardingStore } from '@/stores/onboarding.store';

export const WIZARD_STEPS: readonly { label: string; since: number }[] = [
  { label: 'Welcome', since: 1 },
  { label: 'Jira', since: 1 },
  { label: 'GitLab', since: 1 },
  { label: 'Integrations', since: 2 },
  { label: 'Done', since: 1 },
];

export const WIZARD_VERSION = 2;

/** First step (never Done) whose `since` is newer than the version the user completed. */
export function landingStepFor(completedVersion: number): number {
  const doneIdx = WIZARD_STEPS.length - 1;
  const idx = WIZARD_STEPS.findIndex((s, i) => i < doneIdx && s.since > completedVersion);
  return idx === -1 ? 0 : idx;
}

export function needsWizardRerun(s: {
  onboardingComplete: boolean;
  onboardingVersion: number;
}): boolean {
  return s.onboardingComplete && s.onboardingVersion < WIZARD_VERSION;
}

interface SeedAuth {
  jiraBaseUrl: string | null;
  gitlabBaseUrl: string | null;
  activeJiraProject: string | null;
  jiraBoardIds: Record<string, number>;
  activeGitlabProject: number | null;
}

export function buildRerunSeed(args: {
  auth: SeedAuth;
  jiraToken: string;
  gitlabToken: string;
  step: number;
}) {
  const { auth, jiraToken, gitlabToken, step } = args;
  return {
    step,
    rerunActive: true,
    jiraUrl: auth.jiraBaseUrl ?? '',
    jiraToken,
    jiraProject: auth.activeJiraProject,
    jiraProjects: [],
    // Seed the saved board so BoardPicker shows it pre-selected and a
    // multi-board project doesn't gate Continue (261112-lyx).
    jiraBoards: [],
    jiraBoardId: auth.activeJiraProject
      ? (auth.jiraBoardIds[auth.activeJiraProject] ?? null)
      : null,
    // Ticks in the StepIndicator for steps finished in an earlier run.
    jiraValidated: step > 1,
    gitlabUrl: auth.gitlabBaseUrl ?? '',
    gitlabToken,
    gitlabProject: auth.activeGitlabProject,
    gitlabProjects: [],
    gitlabValidated: step > 2,
    integrationsVisited: false,
  };
}

export async function startWizardRerun(step: number): Promise<void> {
  const [jiraToken, gitlabToken] = await Promise.all([
    readSecret('jira-pat').catch(() => ''),
    readSecret('gitlab-pat').catch(() => ''),
  ]);
  const auth = useAuthStore.getState();
  useOnboardingStore.getState().set(buildRerunSeed({ auth, jiraToken, gitlabToken, step }));
}
