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
});
