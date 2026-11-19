/**
 * dev-tools-view.store — transient UI state for the Developer Tools page.
 *
 * Base UI unmounts inactive tab panels, so selection, search and facet filters live here to
 * survive tab switches. Not persisted. Pause is UI-only: it snapshots the log entries so the
 * debug-log store (and its FIFO eviction) stays untouched.
 */
import { create } from 'zustand';
import { nowMs } from '../../lib/dev-tools/log-entry';
import type { ApiLogEntry } from '../../stores/debug-log.store';

export type DevToolsTabId = 'logs' | 'cache' | 'notifications' | 'editor';

export interface TabViewState {
  selectedId: string | null;
  search: string;
}

type FacetKey =
  | 'logSources'
  | 'logStatuses'
  | 'logMethods'
  | 'logOperations'
  | 'notificationOutcomes'
  | 'editorLevels'
  | 'editorEvents';

type FacetSets = Record<FacetKey, Set<string>>;

export const LOG_FACETS = ['logSources', 'logStatuses', 'logMethods', 'logOperations'] as const;
export const NOTIFICATION_FACETS = ['notificationOutcomes'] as const;
export const EDITOR_FACETS = ['editorLevels', 'editorEvents'] as const;

interface DevToolsViewState extends FacetSets {
  tabs: Record<DevToolsTabId, TabViewState>;
  /** Cache tab state filter (all | fetching | stale | error | inactive | invalidated). */
  cacheState: string;
  /** Inspector takes the whole pane (list hidden). Transient, shared by every tab. */
  inspectorMaximized: boolean;
  pausedEntries: ApiLogEntry[] | null;
  /** Epoch ms the log was paused at (freezes pending rows' elapsed time); null when live. */
  pausedAt: number | null;
  /** Logs tab presentation: the request list or the timeline. */
  logView: 'list' | 'timeline';
  /** Explicit open/closed choice per timeline load; absent means the default (newest open). */
  loadOpen: Record<string, boolean>;

  setLogView: (view: 'list' | 'timeline') => void;
  setLoadOpen: (id: string, open: boolean) => void;
  resetLoadOpen: () => void;
  setSelected: (tab: DevToolsTabId, id: string | null) => void;
  setSearch: (tab: DevToolsTabId, search: string) => void;
  setFacet: (key: FacetKey, next: Set<string>) => void;
  /** Empty the given facets (on Clear, so a filter whose values vanished can't get stuck on). */
  resetFacets: (keys: readonly FacetKey[]) => void;
  setCacheState: (state: string) => void;
  setInspectorMaximized: (maximized: boolean) => void;
  setPausedEntries: (entries: ApiLogEntry[] | null) => void;
}

const emptyTab = (): TabViewState => ({ selectedId: null, search: '' });

export const useDevToolsViewStore = create<DevToolsViewState>((set) => ({
  tabs: {
    logs: emptyTab(),
    cache: emptyTab(),
    notifications: emptyTab(),
    editor: emptyTab(),
  },
  logSources: new Set(),
  logStatuses: new Set(),
  logMethods: new Set(),
  logOperations: new Set(),
  notificationOutcomes: new Set(),
  editorLevels: new Set(),
  editorEvents: new Set(),
  cacheState: 'all',
  inspectorMaximized: false,
  pausedEntries: null,
  pausedAt: null,
  logView: 'list',
  loadOpen: {},

  setLogView: (logView) => set({ logView }),
  setLoadOpen: (id, open) => set((s) => ({ loadOpen: { ...s.loadOpen, [id]: open } })),
  resetLoadOpen: () => set({ loadOpen: {} }),
  setSelected: (tab, id) =>
    set((s) => ({ tabs: { ...s.tabs, [tab]: { ...s.tabs[tab], selectedId: id } } })),
  setSearch: (tab, search) =>
    set((s) => ({ tabs: { ...s.tabs, [tab]: { ...s.tabs[tab], search } } })),
  setFacet: (key, next) => set({ [key]: next } as Partial<FacetSets>),
  resetFacets: (keys) =>
    set(Object.fromEntries(keys.map((k) => [k, new Set<string>()])) as Partial<FacetSets>),
  setCacheState: (cacheState) => set({ cacheState }),
  setInspectorMaximized: (inspectorMaximized) => set({ inspectorMaximized }),
  setPausedEntries: (pausedEntries) =>
    set({ pausedEntries, pausedAt: pausedEntries ? nowMs() : null }),
}));

/** Adapter so a Set-valued facet can be passed to FilterPopover's React-style setter. */
export function facetSetter(key: FacetKey, current: Set<string>) {
  return (v: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    const next = typeof v === 'function' ? v(current) : v;
    useDevToolsViewStore.getState().setFacet(key, next);
  };
}
