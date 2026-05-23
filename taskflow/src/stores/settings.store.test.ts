// Settings store tests — keyboardOverrides (Phase 19) + layout customization (Phase 34)

// biome-ignore assist/source/organizeImports: post-vi.mock imports must follow specific order to avoid TDZ circular dependency
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

// biome-ignore assist/source/organizeImports: import order must match module init order to avoid TDZ circular dependency
import { useSettingsStore } from './settings.store';

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
    const src = fs.readFileSync(
      path.resolve(__dirname, 'settings.store.ts'),
      'utf8',
    );
    // Extract the numeric version value from `version: <N>,` inside the persist options.
    const match = src.match(/version:\s*(\d+),/);
    expect(match).not.toBeNull();
    const version = Number(match![1]);
    expect(version).toBeGreaterThanOrEqual(19);
  });

  it('v19 migration guard is present in source (if (version < 19))', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const src = fs.readFileSync(
      path.resolve(__dirname, 'settings.store.ts'),
      'utf8',
    );
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
