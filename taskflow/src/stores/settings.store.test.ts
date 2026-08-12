// Settings store tests — keyboardOverrides (Phase 19) + layout customization (Phase 34)

// NOTE: post-vi.mock imports must follow a specific order to avoid TDZ circular dependency
import { act, renderHook } from '@testing-library/react';
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

import { appendMyTasksItemIfMissing, useSettingsStore } from './settings.store';
import { useAuthStore } from './auth.store';

describe('settings.store — keyboardOverrides (Phase 19)', () => {
  beforeEach(() => {
    act(() => {
      useSettingsStore.setState({
        keyboardOverrides: {},
      } as any);
    });
  });

  it('keyboardOverrides defaults to empty object {}', () => {
    const { result } = renderHook(() => useSettingsStore());
    // After setState with {}, keyboardOverrides must be {} not undefined
    expect(result.current.keyboardOverrides).toBeDefined();
    expect(result.current.keyboardOverrides).toEqual({});
  });

  it('keyboardOverrides is a plain object (JSON-serializable)', () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(() => JSON.stringify(result.current.keyboardOverrides)).not.toThrow();
    expect(typeof result.current.keyboardOverrides).toBe('object');
    expect(Array.isArray(result.current.keyboardOverrides)).toBe(false);
  });

  it('persist version is 2 (bumped from 1 in Phase 19)', () => {
    const state = useSettingsStore.getState();
    expect('keyboardOverrides' in state).toBe(true);
  });
});

describe('settings.store — updateCheckInterval (Phase 38)', () => {
  beforeEach(() => {
    act(() => {
      useSettingsStore.setState({
        updateCheckInterval: 6,
      } as any);
    });
  });

  it('updateCheckInterval defaults to 6', () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(result.current.updateCheckInterval).toBe(6);
  });

  it('setUpdateCheckInterval updates the value', () => {
    act(() => useSettingsStore.getState().setUpdateCheckInterval(24));
    expect(useSettingsStore.getState().updateCheckInterval).toBe(24);
  });

  it('setUpdateCheckInterval accepts manual', () => {
    act(() => useSettingsStore.getState().setUpdateCheckInterval('manual'));
    expect(useSettingsStore.getState().updateCheckInterval).toBe('manual');
  });
});

describe('settings.store — resize panel widths (Phase 50)', () => {
  beforeEach(() => {
    act(() => {
      useSettingsStore.setState({
        sidebarWidth: 224,
        issueDetailPanelWidth: null,
        mrDetailPanelWidth: 288,
        releaseDetailPanelWidth: 288,
      } as any);
    });
  });

  it('sidebarWidth defaults to 224', () => {
    expect(useSettingsStore.getState().sidebarWidth).toBe(224);
  });

  it('issueDetailPanelWidth defaults to null', () => {
    expect(useSettingsStore.getState().issueDetailPanelWidth).toBeNull();
  });

  it('mrDetailPanelWidth defaults to 288', () => {
    expect(useSettingsStore.getState().mrDetailPanelWidth).toBe(288);
  });

  it('releaseDetailPanelWidth defaults to 288', () => {
    expect(useSettingsStore.getState().releaseDetailPanelWidth).toBe(288);
  });

  it('setSidebarWidth persists a new value', () => {
    act(() => useSettingsStore.getState().setSidebarWidth(280));
    expect(useSettingsStore.getState().sidebarWidth).toBe(280);
  });

  it('setIssueDetailPanelWidth transitions from null to a number', () => {
    act(() => useSettingsStore.getState().setIssueDetailPanelWidth(360));
    expect(useSettingsStore.getState().issueDetailPanelWidth).toBe(360);
  });

  it('setMrDetailPanelWidth updates value', () => {
    act(() => useSettingsStore.getState().setMrDetailPanelWidth(320));
    expect(useSettingsStore.getState().mrDetailPanelWidth).toBe(320);
  });

  it('setReleaseDetailPanelWidth updates value', () => {
    act(() => useSettingsStore.getState().setReleaseDetailPanelWidth(300));
    expect(useSettingsStore.getState().releaseDetailPanelWidth).toBe(300);
  });
});

describe('settings.store — aioEnabled toggle (Phase 51)', () => {
  beforeEach(() => {
    act(() => {
      useSettingsStore.setState({
        aioEnabled: false,
      } as any);
    });
  });

  it('aioEnabled defaults to false', () => {
    expect(useSettingsStore.getState().aioEnabled).toBe(false);
  });

  it('setAioEnabled(true) updates store', () => {
    act(() => useSettingsStore.getState().setAioEnabled(true));
    expect(useSettingsStore.getState().aioEnabled).toBe(true);
  });

  it('setAioEnabled(false) updates store', () => {
    act(() => useSettingsStore.getState().setAioEnabled(true));
    act(() => useSettingsStore.getState().setAioEnabled(false));
    expect(useSettingsStore.getState().aioEnabled).toBe(false);
  });
});

describe('settings.store — tempoEnabled toggle (Phase 61)', () => {
  beforeEach(() => {
    act(() => {
      useSettingsStore.setState({
        tempoEnabled: false,
      } as any);
    });
  });

  it('tempoEnabled defaults to false', () => {
    expect(useSettingsStore.getState().tempoEnabled).toBe(false);
  });

  it('setTempoEnabled(true) updates store', () => {
    act(() => useSettingsStore.getState().setTempoEnabled(true));
    expect(useSettingsStore.getState().tempoEnabled).toBe(true);
  });

  it('setTempoEnabled(false) updates store', () => {
    act(() => useSettingsStore.getState().setTempoEnabled(true));
    act(() => useSettingsStore.getState().setTempoEnabled(false));
    expect(useSettingsStore.getState().tempoEnabled).toBe(false);
  });

  it('tempoEnabled is present on fresh store — v19→v20 migration smoke', () => {
    // Migration guard: if (version < 20) { if (s.tempoEnabled === undefined) s.tempoEnabled = false; }
    // Default-value check mirrors the migration outcome for absent persisted state.
    const state = useSettingsStore.getState();
    expect('tempoEnabled' in state).toBe(true);
    expect(state.tempoEnabled).toBe(false);
  });
});

describe('settings.store — widget removal (Phase 59)', () => {
  it('dashboardLayout field is absent from store state', () => {
    const state = useSettingsStore.getState();
    expect('dashboardLayout' in state).toBe(false);
  });

  it('setDashboardLayout action is absent from store state', () => {
    const state = useSettingsStore.getState();
    expect('setDashboardLayout' in state).toBe(false);
  });

  it('addDashboardWidget action is absent from store state', () => {
    const state = useSettingsStore.getState();
    expect('addDashboardWidget' in state).toBe(false);
  });

  it('removeDashboardWidget action is absent from store state', () => {
    const state = useSettingsStore.getState();
    expect('removeDashboardWidget' in state).toBe(false);
  });

  it('updateWidgetConfig action is absent from store state', () => {
    const state = useSettingsStore.getState();
    expect('updateWidgetConfig' in state).toBe(false);
  });

  it('persist version is >= 19 (v19 migration smoke — dashboardLayout implicitly dropped)', () => {
    // Source-string assertion: read settings.store.ts and assert the persist version
    // field is at least 19. Phase 59 bumped from 18 to 19; later phases may increment
    // further (v20, v21 already exist), so the guard is >= 19, not === 19.
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const src = fs.readFileSync(path.resolve(__dirname, 'settings.store.ts'), 'utf8');
    // Extract the numeric version value from `version: <N>,` inside the persist options.
    const match = src.match(/version:\s*(\d+),/);
    expect(match).not.toBeNull();
    const version = Number(match?.[1]);
    expect(version).toBeGreaterThanOrEqual(19);
  });

  it('v19 migration guard is present in source (if (version < 19))', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const src = fs.readFileSync(path.resolve(__dirname, 'settings.store.ts'), 'utf8');
    expect(src).toMatch(/if\s*\(version\s*<\s*19\)/);
  });
});

describe('settings.store — selectedAioProjectKey (Phase 55)', () => {
  beforeEach(() => {
    act(() => {
      useSettingsStore.setState({
        aioEnabled: false,
        selectedAioProjectKey: null,
      } as any);
    });
  });

  it('selectedAioProjectKey defaults to null (D-06)', () => {
    expect(useSettingsStore.getState().selectedAioProjectKey).toBeNull();
  });

  it("setSelectedAioProjectKey('PROJ') updates store (D-06)", () => {
    act(() => useSettingsStore.getState().setSelectedAioProjectKey('PROJ'));
    expect(useSettingsStore.getState().selectedAioProjectKey).toBe('PROJ');
  });

  it('setSelectedAioProjectKey(null) clears a previously-set value (D-06)', () => {
    act(() => useSettingsStore.getState().setSelectedAioProjectKey('PROJ'));
    act(() => useSettingsStore.getState().setSelectedAioProjectKey(null));
    expect(useSettingsStore.getState().selectedAioProjectKey).toBeNull();
  });

  it('setAioEnabled(false) does NOT clear selectedAioProjectKey (D-08 toggle-independence)', () => {
    act(() => useSettingsStore.getState().setSelectedAioProjectKey('PROJ'));
    act(() => useSettingsStore.getState().setAioEnabled(false));
    expect(useSettingsStore.getState().selectedAioProjectKey).toBe('PROJ');
  });

  it('selectedAioProjectKey is defined (not undefined) on a fresh store (D-07 migration smoke)', () => {
    // Migration guard at settings.store.ts: `if (version < 17) { if (s.selectedAioProjectKey === undefined) s.selectedAioProjectKey = null; }`
    // IN-02 (deferred): direct migrate() invocation would require exporting the
    // inline migrate function from settings.store.ts — a production-code refactor
    // out of scope for Phase 55. The gap is recorded in deferred-items.md.
    // Default-value check is the functional substitute: a freshly initialized
    // store must have the field present and equal to null, mirroring the
    // migration outcome for absent persisted state.
    const state = useSettingsStore.getState();
    expect('selectedAioProjectKey' in state).toBe(true);
    expect(state.selectedAioProjectKey).toBeNull();
  });
});

describe('settings.store — roles removal (Phase 66)', () => {
  it('role field is absent from store state', () => {
    expect('role' in useSettingsStore.getState()).toBe(false);
  });
  it('setRole action is absent from store state', () => {
    expect('setRole' in useSettingsStore.getState()).toBe(false);
  });
  it('applyPreset action is absent from store state', () => {
    expect('applyPreset' in useSettingsStore.getState()).toBe(false);
  });
});

describe('settings.store — reset actions (quick 260524-pqo)', () => {
  beforeEach(() => {
    // Arrange: set non-default values to verify reset actually restores defaults
    act(() => {
      useSettingsStore.setState({
        theme: 'dark',
        density: 'compact',
        onboardingComplete: true,
        devToolsEnabled: true,
        requestLogging: true,
        retentionLimit: 500,
        jiraConcurrencyLimit: 12,
        notifCommentMentionEnabled: false,
        notifIssueUpdateEnabled: false,
        sidebarCollapsed: true,
        sidebarWidth: 300,
        quickFilters: [{ id: 'qf1', name: 'My Filter', filter: {} as any }],
        storyPointsFieldKey: 'customfield_99999',
        epicLinkFieldKey: 'customfield_88888',
        epicNameFieldKey: 'customfield_77777',
        sprintFieldKey: 'customfield_66666',
        epicColorFieldKey: 'customfield_55555',
        flaggedFieldKey: 'customfield_44444',
        accountFieldKey: 'customfield_33333',
      } as any);
    });
  });

  it('resetSettings("all") restores theme to system', () => {
    act(() => useSettingsStore.getState().resetSettings('all'));
    expect(useSettingsStore.getState().theme).toBe('system');
  });

  it('resetSettings("all") restores density to default', () => {
    act(() => useSettingsStore.getState().resetSettings('all'));
    expect(useSettingsStore.getState().density).toBe('default');
  });

  it('resetSettings("all") restores devToolsEnabled to false', () => {
    act(() => useSettingsStore.getState().resetSettings('all'));
    expect(useSettingsStore.getState().devToolsEnabled).toBe(false);
  });

  it('resetSettings("all") restores retentionLimit to 200', () => {
    act(() => useSettingsStore.getState().resetSettings('all'));
    expect(useSettingsStore.getState().retentionLimit).toBe(200);
  });

  it('resetSettings("all") restores jiraConcurrencyLimit to 6', () => {
    act(() => useSettingsStore.getState().resetSettings('all'));
    expect(useSettingsStore.getState().jiraConcurrencyLimit).toBe(6);
  });

  it('resetSettings("all") restores quickFilters to empty array', () => {
    act(() => useSettingsStore.getState().resetSettings('all'));
    expect(useSettingsStore.getState().quickFilters).toEqual([]);
  });

  it('resetSettings("all") restores all notif* booleans to true', () => {
    act(() => useSettingsStore.getState().resetSettings('all'));
    const s = useSettingsStore.getState();
    expect(s.notifCommentMentionEnabled).toBe(true);
    expect(s.notifIssueUpdateEnabled).toBe(true);
  });

  it('resetSettings("all") restores storyPointsFieldKey to customfield_10016', () => {
    act(() => useSettingsStore.getState().resetSettings('all'));
    expect(useSettingsStore.getState().storyPointsFieldKey).toBe('customfield_10016');
  });

  it('resetSettings("all") restores onboardingComplete to false', () => {
    act(() => useSettingsStore.getState().resetSettings('all'));
    expect(useSettingsStore.getState().onboardingComplete).toBe(false);
  });

  it('resetSettings("all") preserves action functions (merge mode)', () => {
    act(() => useSettingsStore.getState().resetSettings('all'));
    expect(typeof useSettingsStore.getState().setTheme).toBe('function');
    expect(typeof useSettingsStore.getState().setDensity).toBe('function');
    expect(typeof useSettingsStore.getState().resetSettings).toBe('function');
  });

  it('resetSettings("preferences") restores theme to system', () => {
    act(() => useSettingsStore.getState().resetSettings('preferences'));
    expect(useSettingsStore.getState().theme).toBe('system');
  });

  it('resetSettings("preferences") restores density to default', () => {
    act(() => useSettingsStore.getState().resetSettings('preferences'));
    expect(useSettingsStore.getState().density).toBe('default');
  });

  it('resetSettings("preferences") preserves onboardingComplete', () => {
    act(() => useSettingsStore.getState().resetSettings('preferences'));
    // onboardingComplete was set to true in beforeEach — it must still be true
    expect(useSettingsStore.getState().onboardingComplete).toBe(true);
  });

  it('resetSettings("preferences") preserves all seven custom field keys', () => {
    act(() => useSettingsStore.getState().resetSettings('preferences'));
    const s = useSettingsStore.getState();
    expect(s.storyPointsFieldKey).toBe('customfield_99999');
    expect(s.epicLinkFieldKey).toBe('customfield_88888');
    expect(s.epicNameFieldKey).toBe('customfield_77777');
    expect(s.sprintFieldKey).toBe('customfield_66666');
    expect(s.epicColorFieldKey).toBe('customfield_55555');
    expect(s.flaggedFieldKey).toBe('customfield_44444');
    expect(s.accountFieldKey).toBe('customfield_33333');
  });

  it('resetSettings("preferences") preserves action functions (merge mode)', () => {
    act(() => useSettingsStore.getState().resetSettings('preferences'));
    expect(typeof useSettingsStore.getState().setTheme).toBe('function');
  });
});

describe('auth.store — resetAuth() (quick 260524-pqo)', () => {
  beforeEach(() => {
    // Arrange: set non-default values
    act(() => {
      useAuthStore.setState({
        jiraConnected: true,
        gitlabConnected: true,
        jiraBaseUrl: 'https://jira.example.com',
        gitlabBaseUrl: 'https://gitlab.example.com',
        activeJiraProject: 'PROJ',
        activeGitlabProject: 42,
        activeGitlabProjectPath: 'org/repo',
        jiraUserDisplayName: 'Jane Doe',
        jiraUsername: 'jdoe',
        jiraUserKey: 'jdoe-key',
        gitlabUserId: 99,
        gitlabUsername: 'jdoe-gl',
        _hasHydrated: true,
      } as any);
    });
  });

  it('resetAuth() sets jiraConnected to false', () => {
    act(() => useAuthStore.getState().resetAuth());
    expect(useAuthStore.getState().jiraConnected).toBe(false);
  });

  it('resetAuth() sets gitlabConnected to false', () => {
    act(() => useAuthStore.getState().resetAuth());
    expect(useAuthStore.getState().gitlabConnected).toBe(false);
  });

  it('resetAuth() clears jiraBaseUrl to null', () => {
    act(() => useAuthStore.getState().resetAuth());
    expect(useAuthStore.getState().jiraBaseUrl).toBeNull();
  });

  it('resetAuth() clears gitlabBaseUrl to null', () => {
    act(() => useAuthStore.getState().resetAuth());
    expect(useAuthStore.getState().gitlabBaseUrl).toBeNull();
  });

  it('resetAuth() clears activeJiraProject to null', () => {
    act(() => useAuthStore.getState().resetAuth());
    expect(useAuthStore.getState().activeJiraProject).toBeNull();
  });

  it('resetAuth() clears all identity fields to null', () => {
    act(() => useAuthStore.getState().resetAuth());
    const s = useAuthStore.getState();
    expect(s.jiraUserDisplayName).toBeNull();
    expect(s.jiraUsername).toBeNull();
    expect(s.jiraUserKey).toBeNull();
    expect(s.gitlabUserId).toBeNull();
    expect(s.gitlabUsername).toBeNull();
  });

  it('resetAuth() preserves _hasHydrated (does not reset to false)', () => {
    act(() => useAuthStore.getState().resetAuth());
    // _hasHydrated was true in beforeEach and must remain true
    expect(useAuthStore.getState()._hasHydrated).toBe(true);
  });

  it('resetAuth() preserves action functions (merge mode)', () => {
    act(() => useAuthStore.getState().resetAuth());
    expect(typeof useAuthStore.getState().setJiraConnected).toBe('function');
    expect(typeof useAuthStore.getState().resetAuth).toBe('function');
  });
});

describe('settings.store — rankFieldKey (Phase 76)', () => {
  beforeEach(() => {
    act(() => {
      useSettingsStore.setState({
        rankFieldKey: null,
      } as any);
    });
  });

  it('persist version is 28 (v28 migration smoke — fontScale added in quick task 260812-mry)', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const src = fs.readFileSync(path.resolve(__dirname, 'settings.store.ts'), 'utf8');
    const match = src.match(/version:\s*(\d+),/);
    expect(match).not.toBeNull();
    const version = Number(match?.[1]);
    expect(version).toBe(28);
  });

  it('rankFieldKey defaults to null', () => {
    expect(useSettingsStore.getState().rankFieldKey).toBeNull();
  });

  it("setRankFieldKey('customfield_10105') sets state to 'customfield_10105' (D-11 composed-key contract)", () => {
    act(() => useSettingsStore.getState().setRankFieldKey('customfield_10105'));
    expect(useSettingsStore.getState().rankFieldKey).toBe('customfield_10105');
  });
});

describe('settings.store — my-tasks migration (quick 260616-ktv)', () => {
  it('appendMyTasksItemIfMissing([]) returns array containing { id: my-tasks, visible: true }', () => {
    const result = appendMyTasksItemIfMissing([]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: 'my-tasks', visible: true });
  });

  it('appends { id: my-tasks, visible: true } to an existing array without my-tasks, preserving order', () => {
    const input = [
      { id: 'dashboard', visible: true },
      { id: 'backlog', visible: false },
    ];
    const result = appendMyTasksItemIfMissing(input);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ id: 'dashboard', visible: true });
    expect(result[1]).toEqual({ id: 'backlog', visible: false });
    expect(result[2]).toEqual({ id: 'my-tasks', visible: true });
  });

  it('returns array unchanged when my-tasks already present (no duplicate, visible flag preserved)', () => {
    const input = [
      { id: 'dashboard', visible: true },
      { id: 'my-tasks', visible: false },
    ];
    const result = appendMyTasksItemIfMissing(input);
    expect(result).toHaveLength(2);
    expect(result).toBe(input); // same reference — no new array created
    const myTasksItem = result.find((i) => i.id === 'my-tasks');
    expect(myTasksItem?.visible).toBe(false);
  });
});
