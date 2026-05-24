import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useOnboardingStore } from './onboarding.store';

describe('onboarding.store', () => {
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

  it('goNext increments step', () => {
    act(() => {
      useOnboardingStore.getState().goNext();
    });
    expect(useOnboardingStore.getState().step).toBe(1);
    act(() => {
      useOnboardingStore.getState().goNext();
    });
    expect(useOnboardingStore.getState().step).toBe(2);
  });

  it('goBack decrements step', () => {
    act(() => {
      useOnboardingStore.getState().goNext();
      useOnboardingStore.getState().goNext();
    });
    act(() => {
      useOnboardingStore.getState().goBack();
    });
    expect(useOnboardingStore.getState().step).toBe(1);
  });

  it('goBack clamps at 0', () => {
    act(() => {
      useOnboardingStore.getState().goBack();
    });
    expect(useOnboardingStore.getState().step).toBe(0);
  });

  it('set updates partial state', () => {
    act(() => {
      useOnboardingStore.getState().set({
        jiraUrl: 'https://jira.example.com',
      });
    });
    const state = useOnboardingStore.getState();
    expect(state.jiraUrl).toBe('https://jira.example.com');
  });

  it('goNext clamps at step 4', () => {
    act(() => {
      useOnboardingStore.getState().goNext(); // 0→1
      useOnboardingStore.getState().goNext(); // 1→2
      useOnboardingStore.getState().goNext(); // 2→3
      useOnboardingStore.getState().goNext(); // 3→4
      useOnboardingStore.getState().goNext(); // clamped at 4
    });
    expect(useOnboardingStore.getState().step).toBe(4);
  });

  it('set updates integrationsVisited', () => {
    act(() => {
      useOnboardingStore.getState().set({ integrationsVisited: true });
    });
    expect(useOnboardingStore.getState().integrationsVisited).toBe(true);
  });
});
