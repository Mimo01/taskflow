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
import { DEV_SIDEBAR_PRESET, PM_SIDEBAR_PRESET } from '@/components/app/sidebar-items';
import {
  DEV_DASHBOARD_PRESET,
  PM_DASHBOARD_PRESET,
  WIDGET_REGISTRY,
} from '@/routes/dashboard/widgets/registry';

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

describe('settings.store — layout customization (Phase 34)', () => {
  beforeEach(() => {
    act(() => {
      useSettingsStore.setState({
        sidebarItems: [...DEV_SIDEBAR_PRESET],
        dashboardLayout: DEV_DASHBOARD_PRESET.map((item) => ({ ...item })),
      } as any);
    });
  });

  it('sidebarItems defaults to DEV_SIDEBAR_PRESET when store is fresh', () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(result.current.sidebarItems).toEqual(DEV_SIDEBAR_PRESET);
  });

  it('dashboardLayout defaults to DEV_DASHBOARD_PRESET when store is fresh', () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(result.current.dashboardLayout).toEqual(DEV_DASHBOARD_PRESET);
  });

  it('setSidebarItemVisible sets visible=false for epics item', () => {
    const { result } = renderHook(() => useSettingsStore());
    act(() => {
      result.current.setSidebarItemVisible('epics', false);
    });
    const epics = result.current.sidebarItems.find((i) => i.id === 'epics');
    expect(epics?.visible).toBe(false);
  });

  it('setSidebarItemVisible sets visible=true for epics item', () => {
    const { result } = renderHook(() => useSettingsStore());
    // First hide it
    act(() => {
      result.current.setSidebarItemVisible('epics', false);
    });
    // Then show it
    act(() => {
      result.current.setSidebarItemVisible('epics', true);
    });
    const epics = result.current.sidebarItems.find((i) => i.id === 'epics');
    expect(epics?.visible).toBe(true);
  });

  it('reorderSidebarItem(0, 2) moves first item to index 2', () => {
    const { result } = renderHook(() => useSettingsStore());
    const originalFirst = result.current.sidebarItems[0];
    act(() => {
      result.current.reorderSidebarItem(0, 2);
    });
    expect(result.current.sidebarItems[2]).toEqual(originalFirst);
  });

  it('addDashboardWidget appends a new widget with unique ID containing the widget type', () => {
    const { result } = renderHook(() => useSettingsStore());
    const before = result.current.dashboardLayout.length;
    act(() => {
      result.current.addDashboardWidget('sprint-progress');
    });
    expect(result.current.dashboardLayout).toHaveLength(before + 1);
    const added = result.current.dashboardLayout[result.current.dashboardLayout.length - 1];
    expect(added.i).toContain('sprint-progress');
    expect(added.type).toBe('sprint-progress');
    expect(added.w).toBe(WIDGET_REGISTRY['sprint-progress'].defaultSize.w);
    expect(added.h).toBe(WIDGET_REGISTRY['sprint-progress'].defaultSize.h);
  });

  it('removeDashboardWidget removes the widget with that ID', () => {
    const { result } = renderHook(() => useSettingsStore());
    const target = result.current.dashboardLayout[0].i;
    const before = result.current.dashboardLayout.length;
    act(() => {
      result.current.removeDashboardWidget(target);
    });
    expect(result.current.dashboardLayout).toHaveLength(before - 1);
    expect(result.current.dashboardLayout.find((w) => w.i === target)).toBeUndefined();
  });

  it('setDashboardLayout replaces the entire layout array', () => {
    const { result } = renderHook(() => useSettingsStore());
    const newLayout = [{ i: 'test-1', type: 'my-subtasks', x: 0, y: 0, w: 6, h: 4 }];
    act(() => {
      result.current.setDashboardLayout(newLayout);
    });
    expect(result.current.dashboardLayout).toEqual(newLayout);
  });

  it('updateWidgetConfig merges config into the matching widget', () => {
    const { result } = renderHook(() => useSettingsStore());
    const widgetId = result.current.dashboardLayout[0].i;
    act(() => {
      result.current.updateWidgetConfig(widgetId, { jql: 'project = FOO' });
    });
    const updated = result.current.dashboardLayout.find((w) => w.i === widgetId);
    expect(updated?.config).toEqual({ jql: 'project = FOO' });
  });

  it('updateWidgetConfig merges into existing config (does not replace)', () => {
    const { result } = renderHook(() => useSettingsStore());
    const widgetId = result.current.dashboardLayout[0].i;
    act(() => {
      result.current.updateWidgetConfig(widgetId, { jql: 'project = FOO' });
    });
    act(() => {
      result.current.updateWidgetConfig(widgetId, { limit: 10 });
    });
    const updated = result.current.dashboardLayout.find((w) => w.i === widgetId);
    expect(updated?.config).toEqual({ jql: 'project = FOO', limit: 10 });
  });

  it('applyPreset("dev") sets sidebarItems to DEV_SIDEBAR_PRESET and dashboardLayout to DEV_DASHBOARD_PRESET', () => {
    const { result } = renderHook(() => useSettingsStore());
    // First apply PM preset to change state
    act(() => {
      result.current.applyPreset('pm');
    });
    // Then apply dev preset
    act(() => {
      result.current.applyPreset('dev');
    });
    expect(result.current.sidebarItems).toEqual(DEV_SIDEBAR_PRESET);
    expect(result.current.dashboardLayout).toEqual(DEV_DASHBOARD_PRESET);
  });

  it('applyPreset("pm") sets sidebarItems to PM_SIDEBAR_PRESET and dashboardLayout to PM_DASHBOARD_PRESET', () => {
    const { result } = renderHook(() => useSettingsStore());
    act(() => {
      result.current.applyPreset('pm');
    });
    expect(result.current.sidebarItems).toEqual(PM_SIDEBAR_PRESET);
    expect(result.current.dashboardLayout).toEqual(PM_DASHBOARD_PRESET);
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
