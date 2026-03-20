import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Tauri plugin-store so LazyStore doesn't attempt IPC calls in jsdom
vi.mock('@tauri-apps/plugin-store', () => {
  class LazyStore {
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue(undefined);
    save = vi.fn().mockResolvedValue(undefined);
    delete = vi.fn().mockResolvedValue(undefined);
  }
  return { LazyStore };
});

import { useAuthStore } from './auth.store';

describe('auth.store', () => {
  beforeEach(() => {
    act(() => {
      useAuthStore.setState({
        jiraConnected: false,
        gitlabConnected: false,
        jiraBaseUrl: null,
        gitlabBaseUrl: null,
        activeJiraProject: null,
        activeGitlabProject: null,
        activeGitlabProjectPath: null,
        jiraUserDisplayName: null,
        jiraUsername: null,
        gitlabUserId: null,
        gitlabUsername: null,
        _hasHydrated: false,
      });
    });
  });

  it('setJiraConnected(true, url) sets jiraConnected and jiraBaseUrl', () => {
    act(() => {
      useAuthStore.getState().setJiraConnected(true, 'https://jira.example.com');
    });
    const state = useAuthStore.getState();
    expect(state.jiraConnected).toBe(true);
    expect(state.jiraBaseUrl).toBe('https://jira.example.com');
  });

  it('setJiraConnected(false) sets jiraConnected false but leaves jiraBaseUrl unchanged', () => {
    act(() => {
      useAuthStore.getState().setJiraConnected(true, 'https://jira.example.com');
    });
    act(() => {
      useAuthStore.getState().setJiraConnected(false);
    });
    const state = useAuthStore.getState();
    expect(state.jiraConnected).toBe(false);
    expect(state.jiraBaseUrl).toBe('https://jira.example.com');
  });

  it('setGitlabConnected(true, url) sets gitlabConnected and gitlabBaseUrl', () => {
    act(() => {
      useAuthStore.getState().setGitlabConnected(true, 'https://gitlab.example.com');
    });
    const state = useAuthStore.getState();
    expect(state.gitlabConnected).toBe(true);
    expect(state.gitlabBaseUrl).toBe('https://gitlab.example.com');
  });

  it('setActiveJiraProject sets activeJiraProject', () => {
    act(() => {
      useAuthStore.getState().setActiveJiraProject('PROJ');
    });
    expect(useAuthStore.getState().activeJiraProject).toBe('PROJ');
  });

  it('setActiveGitlabProject sets id and path', () => {
    act(() => {
      useAuthStore.getState().setActiveGitlabProject(42, 'group/repo');
    });
    const state = useAuthStore.getState();
    expect(state.activeGitlabProject).toBe(42);
    expect(state.activeGitlabProjectPath).toBe('group/repo');
  });

  it('setJiraUser sets displayName and username', () => {
    act(() => {
      useAuthStore.getState().setJiraUser('Alice', 'alice');
    });
    const state = useAuthStore.getState();
    expect(state.jiraUserDisplayName).toBe('Alice');
    expect(state.jiraUsername).toBe('alice');
  });

  it('setGitlabUserId sets gitlabUserId', () => {
    act(() => {
      useAuthStore.getState().setGitlabUserId(99);
    });
    expect(useAuthStore.getState().gitlabUserId).toBe(99);
  });

  it('setGitlabUsername sets gitlabUsername', () => {
    act(() => {
      useAuthStore.getState().setGitlabUsername('bob');
    });
    expect(useAuthStore.getState().gitlabUsername).toBe('bob');
  });
});
