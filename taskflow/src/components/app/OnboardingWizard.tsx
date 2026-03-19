/**
 * OnboardingWizard — 5-step wizard shell rendering the current step component by index.
 *
 * Steps:
 *   0 — WelcomeStep
 *   1 — JiraStep
 *   2 — GitLabStep
 *   3 — RoleStep (placeholder — implemented in Plan 03)
 *   4 — DoneStep (placeholder — implemented in Plan 03)
 *
 * StepIndicator sits above the current step and reflects completed/current/future state.
 * Completed steps are derived from the Zustand onboarding store (jiraValidated, gitlabValidated).
 */

import DoneStep from '@/routes/onboarding/DoneStep';
import GitLabStep from '@/routes/onboarding/GitLabStep';
import JiraStep from '@/routes/onboarding/JiraStep';
import RoleStep from '@/routes/onboarding/RoleStep';
import WelcomeStep from '@/routes/onboarding/WelcomeStep';
import { useOnboardingStore } from '@/stores/onboarding.store';
import StepIndicator from './StepIndicator';

const STEP_LABELS = ['Welcome', 'Jira', 'GitLab', 'Role', 'Done'];

const STEP_COMPONENTS = [WelcomeStep, JiraStep, GitLabStep, RoleStep, DoneStep];

export default function OnboardingWizard() {
  const { step, jiraValidated, gitlabValidated, role } = useOnboardingStore();

  const completedSteps: number[] = [];
  if (jiraValidated) completedSteps.push(1);
  if (gitlabValidated) completedSteps.push(2);
  if (role) completedSteps.push(3);

  const CurrentStep = STEP_COMPONENTS[step] ?? DoneStep;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Step progress indicator */}
      <div className="py-6 px-4 border-b border-border">
        <StepIndicator steps={STEP_LABELS} currentStep={step} completedSteps={completedSteps} />
      </div>

      {/* Current step content */}
      <div className="flex-1 px-4 overflow-auto">
        <CurrentStep />
      </div>
    </div>
  );
}
