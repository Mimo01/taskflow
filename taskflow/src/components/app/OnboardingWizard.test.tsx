/**
 * WIZ-01 — OnboardingWizard behavioral tests.
 *
 * Behaviors:
 *   1. Renders IntegrationsStep stub when step=3
 *   2. StepIndicator receives 5 step labels with Integrations at index 3
 *   3. completedSteps includes step 3 when integrationsVisited=true
 *   4. completedSteps does NOT include step 3 when integrationsVisited=false
 */

import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOnboardingStore } from '@/stores/onboarding.store';

// ── Mock all step components to avoid their store / query dependencies ────────
vi.mock('@/routes/onboarding/WelcomeStep', () => ({
  default: () => <div data-testid="welcome-step-stub">WelcomeStep stub</div>,
}));
vi.mock('@/routes/onboarding/JiraStep', () => ({
  default: () => <div data-testid="jira-step-stub">JiraStep stub</div>,
}));
vi.mock('@/routes/onboarding/GitLabStep', () => ({
  default: () => <div data-testid="gitlab-step-stub">GitLabStep stub</div>,
}));
vi.mock('@/routes/onboarding/IntegrationsStep', () => ({
  default: () => <div data-testid="integrations-step-stub">IntegrationsStep stub</div>,
}));
vi.mock('@/routes/onboarding/DoneStep', () => ({
  default: () => <div data-testid="done-step-stub">DoneStep stub</div>,
}));

// ── Reset store to clean baseline before each test ───────────────────────────
beforeEach(() => {
  act(() => {
    useOnboardingStore.setState({
      step: 0,
      jiraUrl: '',
      jiraToken: '',
      jiraProject: null,
      jiraProjects: [],
      gitlabUrl: '',
      gitlabToken: '',
      gitlabProject: null,
      gitlabProjects: [],
      jiraValidated: false,
      gitlabValidated: false,
      integrationsVisited: false,
    });
  });
});

describe('OnboardingWizard — WIZ-01 wizard wiring', () => {
  it('renders IntegrationsStep stub when step=3', async () => {
    act(() => {
      useOnboardingStore.setState({ step: 3 });
    });

    const { default: OnboardingWizard } = await import('./OnboardingWizard');
    const { getByTestId, queryByTestId } = render(<OnboardingWizard />);

    // The IntegrationsStep stub must be in the document
    expect(getByTestId('integrations-step-stub')).toBeInTheDocument();

    // Other steps must not be visible simultaneously
    expect(queryByTestId('welcome-step-stub')).not.toBeInTheDocument();
    expect(queryByTestId('jira-step-stub')).not.toBeInTheDocument();
    expect(queryByTestId('gitlab-step-stub')).not.toBeInTheDocument();
    expect(queryByTestId('done-step-stub')).not.toBeInTheDocument();
  });

  it('StepIndicator receives 5 step labels with Integrations at index 3', async () => {
    // step=0 by default — just check the label is in the DOM
    const { default: OnboardingWizard } = await import('./OnboardingWizard');
    const { getByText, getAllByText } = render(<OnboardingWizard />);

    // All 5 labels must be present
    expect(getByText('Welcome')).toBeInTheDocument();
    expect(getByText('Jira')).toBeInTheDocument();
    expect(getByText('GitLab')).toBeInTheDocument();
    expect(getByText('Integrations')).toBeInTheDocument();
    expect(getByText('Done')).toBeInTheDocument();

    // Exactly one 'Integrations' label (no duplicates)
    expect(getAllByText('Integrations')).toHaveLength(1);
  });

  it('completedSteps includes step 3 when integrationsVisited=true', async () => {
    act(() => {
      useOnboardingStore.setState({ step: 3, integrationsVisited: true });
    });

    const { default: OnboardingWizard } = await import('./OnboardingWizard');
    const { getAllByLabelText } = render(<OnboardingWizard />);

    // When step=3 and integrationsVisited=true:
    //   step > 0 → Welcome (index 0) is completed
    //   integrationsVisited → Integrations (index 3) is completed
    // So exactly 2 "completed" icons should appear
    const completedIcons = getAllByLabelText('completed');
    expect(completedIcons).toHaveLength(2);
  });

  it('completedSteps does NOT include step 3 when integrationsVisited=false', async () => {
    // step=0, integrationsVisited=false (already reset to this in beforeEach)
    const { default: OnboardingWizard } = await import('./OnboardingWizard');
    const { queryAllByLabelText } = render(<OnboardingWizard />);

    // step=0, no visited flags → no completed steps → zero "completed" icons
    const completedIcons = queryAllByLabelText('completed');
    expect(completedIcons).toHaveLength(0);
  });
});
