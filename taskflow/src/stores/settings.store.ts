/**
 * Settings store — theme, sidebar, and app preferences, persisted via Tauri Store plugin.
 *
 * Uses Zustand persist middleware with a custom storage adapter that
 * reads/writes via LazyStore from @tauri-apps/plugin-store.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getDefaultSidebarItems, type SidebarItem } from '@/components/app/sidebar-items';
import { setJiraConcurrencyLimit as setConcurrencyRuntime } from '../lib/concurrency';
import { createTauriStorage } from '../lib/tauri-storage';
import type { Theme } from '../services/theme';
import type { QuickFilter } from './filter.store';

export type Density = 'compact' | 'default' | 'comfortable';
export type CommentSortOrder = 'newest' | 'oldest';

/** Default values for all persisted data fields (no actions, no sidebarItems). */
const initialSettings = {
  theme: 'system' as Theme,
  onboardingComplete: false,
  staleMrThresholdDays: 3,
  notificationPollIntervalSecs: 60,
  osNotifJiraEnabled: true,
  osNotifGitlabEnabled: true,
  storyPointsFieldKey: 'customfield_10016',
  epicLinkFieldKey: 'customfield_10014',
  epicNameFieldKey: 'customfield_10015',
  sprintFieldKey: 'customfield_10020',
  epicColorFieldKey: 'customfield_10013',
  flaggedFieldKey: 'customfield_10021',
  accountFieldKey: null as string | null,
  devToolsEnabled: false,
  requestLogging: false,
  responseBodyCapture: false,
  operationProfiling: false,
  performanceWaterfall: false,
  retentionLimit: 200,
  jiraConcurrencyLimit: 6,
  density: 'default' as Density,
  sprintCollapseByDefault: false,
  keyboardOverrides: {} as Record<string, string>,
  commentSortOrder: 'newest' as CommentSortOrder,
  updateCheckInterval: 6 as 1 | 6 | 12 | 24 | 'manual',
  lastSeenVersion: null as string | null,
  lastSeenChangelog: null as string | null,
  lastChecked: null as string | null,
  sidebarCollapsed: false,
  sidebarWidth: 224,
  issueDetailPanelWidth: null as number | null,
  peekPanelWidth: null as number | null,
  mrDetailPanelWidth: 288,
  releaseDetailPanelWidth: 288,
  aioEnabled: false,
  tempoEnabled: false,
  selectedAioProjectKey: null as string | null,
  quickFilters: [] as QuickFilter[],
  rankFieldKey: null as string | null,
  notifCommentMentionEnabled: true,
  notifIssueUpdateEnabled: true,
  notifMrNoteEnabled: true,
  notifGitlabMentionEnabled: true,
  notifJiraCommentEnabled: true,
  notifMrApprovalEnabled: true,
  notifPipelineFailureEnabled: true,
  notifIssueAssignmentEnabled: true,
  notifDueDateReminderEnabled: true,
};

interface SettingsState {
  theme: Theme;
  onboardingComplete: boolean;
  /** Number of days without update before an MR is considered stale. Default: 3. */
  staleMrThresholdDays: number;
  /** Notification polling interval in seconds. Default: 60. Clamped to [30, 300]. */
  notificationPollIntervalSecs: number;
  /** Enable OS desktop notifications for Jira comment mentions. Default: true. */
  osNotifJiraEnabled: boolean;
  /** Enable OS desktop notifications for GitLab MR notes. Default: true. */
  osNotifGitlabEnabled: boolean;
  /** Discovered story points custom field key. Defaults to customfield_10016. */
  storyPointsFieldKey: string;
  /** Discovered epic link custom field key. Defaults to customfield_10014. */
  epicLinkFieldKey: string;
  /** Discovered epic name custom field key. Defaults to customfield_10015. */
  epicNameFieldKey: string;
  /** Discovered sprint custom field key. Defaults to customfield_10020. */
  sprintFieldKey: string;
  /** Discovered epic color custom field key. Defaults to customfield_10013. */
  epicColorFieldKey: string;
  /** Discovered flagged custom field key. Defaults to customfield_10021. */
  flaggedFieldKey: string;
  /** Discovered account custom field key. Reserved for Phase 11. */
  accountFieldKey: string | null;
  /** Discovered rank custom field key. Null until populated from GreenHopper backlog response. */
  rankFieldKey: string | null;
  setRankFieldKey: (key: string) => void;
  /** Master toggle for developer tools. Default: false. */
  devToolsEnabled: boolean;
  /** Enable request/response logging to debug log store. Default: false. */
  requestLogging: boolean;
  /** Enable response body capture (clones response). Default: false. */
  responseBodyCapture: boolean;
  /** Enable operation profiling with timing. Default: false. */
  operationProfiling: boolean;
  /** Enable performance waterfall visualization. Default: false. */
  performanceWaterfall: boolean;
  /** Maximum number of retained log/profiler entries. Default: 200. */
  retentionLimit: number;
  /** Maximum number of parallel Jira API calls. Default: 6. */
  jiraConcurrencyLimit: number;
  /** UI density preference. Default: 'default'. */
  density: Density;
  /** Collapse sprints by default in the board view. Default: false. */
  sprintCollapseByDefault: boolean;
  /** User-customized key overrides. Map of shortcut id → key string. Default: {}. Future: editable via Settings > Keyboard. */
  keyboardOverrides: Record<string, string>;
  /** Comment sort order. Default: 'newest'. */
  commentSortOrder: CommentSortOrder;
  setCommentSortOrder: (order: CommentSortOrder) => void;
  /** Update check interval in hours. 'manual' disables automatic checking. Default: 6. Per D-07. */
  updateCheckInterval: 1 | 6 | 12 | 24 | 'manual';
  setUpdateCheckInterval: (v: 1 | 6 | 12 | 24 | 'manual') => void;
  /** Version string of the last seen update, for What's New dialog. Default: null. */
  lastSeenVersion: string | null;
  /** Changelog markdown of the last seen update, for What's New dialog. Default: null. */
  lastSeenChangelog: string | null;
  setLastSeenVersion: (v: string) => void;
  setLastSeenChangelog: (v: string | null) => void;
  /** ISO timestamp of last update check. Default: null. */
  lastChecked: string | null;
  setLastChecked: (iso: string) => void;
  /** Whether the sidebar is collapsed to icon-only mode. Default: false. */
  sidebarCollapsed: boolean;
  toggleSidebarCollapsed: () => void;
  /** User-dragged main navigation sidebar width in px. Default: 224 (md:w-56 = 14rem). */
  sidebarWidth: number;
  setSidebarWidth: (w: number) => void;
  /** Issue detail right panel width in px. Null = use 42% of container until first drag. */
  issueDetailPanelWidth: number | null;
  setIssueDetailPanelWidth: (w: number) => void;
  /** Peek panel width in px. Null = use default 480 until first drag. */
  peekPanelWidth: number | null;
  setPeekPanelWidth: (w: number) => void;
  /** MR detail right panel width in px. Default: 288 (w-72). */
  mrDetailPanelWidth: number;
  setMrDetailPanelWidth: (w: number) => void;
  /** Release detail right panel width in px. Default: 288 (w-72). */
  releaseDetailPanelWidth: number;
  setReleaseDetailPanelWidth: (w: number) => void;
  /** Enable AIO Test Management integration. Default: false. Gates all AIO API calls. */
  aioEnabled: boolean;
  setAioEnabled: (v: boolean) => void;
  /** Enable Tempo Timesheets integration. Default: false. Gates all Tempo API calls. */
  tempoEnabled: boolean;
  setTempoEnabled: (v: boolean) => void;
  /** Selected AIO project key. Null until user picks a project. */
  selectedAioProjectKey: string | null;
  setSelectedAioProjectKey: (key: string | null) => void;
  /** Saved quickfilter presets. Default: []. */
  quickFilters: QuickFilter[];
  addQuickFilter: (qf: QuickFilter) => void;
  removeQuickFilter: (id: string) => void;
  renameQuickFilter: (id: string, name: string) => void;
  moveQuickFilter: (id: string, to: 'left' | 'right' | 'front' | 'back') => void;
  /** Per-type notification toggles. All default to true. */
  notifCommentMentionEnabled: boolean;
  notifIssueUpdateEnabled: boolean;
  notifMrNoteEnabled: boolean;
  notifGitlabMentionEnabled: boolean;
  notifJiraCommentEnabled: boolean;
  notifMrApprovalEnabled: boolean;
  notifPipelineFailureEnabled: boolean;
  notifIssueAssignmentEnabled: boolean;
  notifDueDateReminderEnabled: boolean;
  setNotifCommentMentionEnabled: (v: boolean) => void;
  setNotifIssueUpdateEnabled: (v: boolean) => void;
  setNotifMrNoteEnabled: (v: boolean) => void;
  setNotifGitlabMentionEnabled: (v: boolean) => void;
  setNotifJiraCommentEnabled: (v: boolean) => void;
  setNotifMrApprovalEnabled: (v: boolean) => void;
  setNotifPipelineFailureEnabled: (v: boolean) => void;
  setNotifIssueAssignmentEnabled: (v: boolean) => void;
  setNotifDueDateReminderEnabled: (v: boolean) => void;
  setDevToolsEnabled: (v: boolean) => void;
  setRequestLogging: (v: boolean) => void;
  setResponseBodyCapture: (v: boolean) => void;
  setOperationProfiling: (v: boolean) => void;
  setPerformanceWaterfall: (v: boolean) => void;
  setRetentionLimit: (v: number) => void;
  setJiraConcurrencyLimit: (v: number) => void;
  setDensity: (d: Density) => void;
  setSprintCollapseByDefault: (v: boolean) => void;
  setTheme: (theme: Theme) => void;
  setOnboardingComplete: (complete: boolean) => void;
  setStaleMrThresholdDays: (days: number) => void;
  /** Clamps input to [30, 300] before storing. */
  setNotificationPollIntervalSecs: (secs: number) => void;
  setOsNotifJiraEnabled: (v: boolean) => void;
  setOsNotifGitlabEnabled: (v: boolean) => void;
  setStoryPointsFieldKey: (key: string) => void;
  setEpicLinkFieldKey: (key: string) => void;
  setEpicNameFieldKey: (key: string) => void;
  setSprintFieldKey: (key: string) => void;
  setEpicColorFieldKey: (key: string) => void;
  setFlaggedFieldKey: (key: string) => void;
  setAccountFieldKey: (key: string | null) => void;
  /** Sidebar item visibility and order. Default: all items visible. */
  sidebarItems: SidebarItem[];
  setSidebarItems: (items: SidebarItem[]) => void;
  setSidebarItemVisible: (id: string, visible: boolean) => void;
  /**
   * Reset settings to defaults.
   * - 'preferences': restores appearance/notifications/workflow/sidebar/integrations/updates
   *   defaults while keeping onboardingComplete and the seven custom field keys.
   * - 'all': restores every data field to its default value.
   * Uses merge-mode set() so action functions are always preserved.
   */
  resetSettings: (scope: 'preferences' | 'all') => void;
}

function appendAioItemIfMissing(items: SidebarItem[]): SidebarItem[] {
  if (items.some((i) => i.id === 'aio-projects')) return items;
  return [...items, { id: 'aio-projects', visible: true }];
}

function appendWorklogsItemIfMissing(items: SidebarItem[]): SidebarItem[] {
  if (items.some((i) => i.id === 'worklogs')) return items;
  return [...items, { id: 'worklogs', visible: true }];
}

function appendStandupNotesItemIfMissing(items: SidebarItem[]): SidebarItem[] {
  if (items.some((i) => i.id === 'standup-notes')) return items;
  return [...items, { id: 'standup-notes', visible: true }];
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...initialSettings,
      sidebarItems: getDefaultSidebarItems(),
      setCommentSortOrder: (order) => set({ commentSortOrder: order }),
      setUpdateCheckInterval: (v) => set({ updateCheckInterval: v }),
      setLastSeenVersion: (v) => set({ lastSeenVersion: v }),
      setLastSeenChangelog: (v) => set({ lastSeenChangelog: v }),
      setLastChecked: (iso) => set({ lastChecked: iso }),
      toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarWidth: (w) => set({ sidebarWidth: w }),
      setIssueDetailPanelWidth: (w) => set({ issueDetailPanelWidth: w }),
      setPeekPanelWidth: (w) => set({ peekPanelWidth: w }),
      setMrDetailPanelWidth: (w) => set({ mrDetailPanelWidth: w }),
      setReleaseDetailPanelWidth: (w) => set({ releaseDetailPanelWidth: w }),
      setAioEnabled: (v) => set({ aioEnabled: v }),
      setTempoEnabled: (v) => set({ tempoEnabled: v }),
      setSelectedAioProjectKey: (key) => set({ selectedAioProjectKey: key }),
      addQuickFilter: (qf) => set((state) => ({ quickFilters: [...state.quickFilters, qf] })),
      removeQuickFilter: (id) =>
        set((state) => ({ quickFilters: state.quickFilters.filter((q) => q.id !== id) })),
      renameQuickFilter: (id, name) =>
        set((state) => ({
          quickFilters: state.quickFilters.map((q) => (q.id === id ? { ...q, name } : q)),
        })),
      moveQuickFilter: (id, to) =>
        set((state) => {
          const arr = [...state.quickFilters];
          const idx = arr.findIndex((q) => q.id === id);
          if (idx === -1) return {};
          const [item] = arr.splice(idx, 1);
          switch (to) {
            case 'front':
              arr.unshift(item);
              break;
            case 'back':
              arr.push(item);
              break;
            case 'left':
              arr.splice(Math.max(0, idx - 1), 0, item);
              break;
            case 'right':
              arr.splice(Math.min(arr.length, idx + 1), 0, item);
              break;
          }
          return { quickFilters: arr };
        }),
      setNotifCommentMentionEnabled: (v) => set({ notifCommentMentionEnabled: v }),
      setNotifIssueUpdateEnabled: (v) => set({ notifIssueUpdateEnabled: v }),
      setNotifMrNoteEnabled: (v) => set({ notifMrNoteEnabled: v }),
      setNotifGitlabMentionEnabled: (v) => set({ notifGitlabMentionEnabled: v }),
      setNotifJiraCommentEnabled: (v) => set({ notifJiraCommentEnabled: v }),
      setNotifMrApprovalEnabled: (v) => set({ notifMrApprovalEnabled: v }),
      setNotifPipelineFailureEnabled: (v) => set({ notifPipelineFailureEnabled: v }),
      setNotifIssueAssignmentEnabled: (v) => set({ notifIssueAssignmentEnabled: v }),
      setNotifDueDateReminderEnabled: (v) => set({ notifDueDateReminderEnabled: v }),
      setDevToolsEnabled: (v) => set({ devToolsEnabled: v }),
      setRequestLogging: (v) => set({ requestLogging: v }),
      setResponseBodyCapture: (v) => set({ responseBodyCapture: v }),
      setOperationProfiling: (v) => set({ operationProfiling: v }),
      setPerformanceWaterfall: (v) => set({ performanceWaterfall: v }),
      setRetentionLimit: (v) => set({ retentionLimit: v }),
      setJiraConcurrencyLimit: (v) => {
        set({ jiraConcurrencyLimit: v });
        setConcurrencyRuntime(v);
      },
      setDensity: (d) => set({ density: d }),
      setSprintCollapseByDefault: (v) => set({ sprintCollapseByDefault: v }),
      setTheme: (theme) => set({ theme }),
      setOnboardingComplete: (complete) => set({ onboardingComplete: complete }),
      setStaleMrThresholdDays: (days) => set({ staleMrThresholdDays: days }),
      setNotificationPollIntervalSecs: (secs) =>
        set({ notificationPollIntervalSecs: Math.max(30, Math.min(300, secs)) }),
      setOsNotifJiraEnabled: (v) => set({ osNotifJiraEnabled: v }),
      setOsNotifGitlabEnabled: (v) => set({ osNotifGitlabEnabled: v }),
      setStoryPointsFieldKey: (key) => set({ storyPointsFieldKey: key }),
      setEpicLinkFieldKey: (key) => set({ epicLinkFieldKey: key }),
      setEpicNameFieldKey: (key) => set({ epicNameFieldKey: key }),
      setSprintFieldKey: (key) => set({ sprintFieldKey: key }),
      setEpicColorFieldKey: (key) => set({ epicColorFieldKey: key }),
      setFlaggedFieldKey: (key) => set({ flaggedFieldKey: key }),
      setAccountFieldKey: (key) => set({ accountFieldKey: key }),
      setRankFieldKey: (key) => set({ rankFieldKey: key }),
      setSidebarItems: (items) => set({ sidebarItems: items }),
      setSidebarItemVisible: (id, visible) =>
        set((s) => ({
          sidebarItems: s.sidebarItems.map((item) =>
            item.id === id ? { ...item, visible } : item,
          ),
        })),
      resetSettings: (scope) =>
        set((s) => {
          const base = { ...initialSettings, sidebarItems: getDefaultSidebarItems() };
          if (scope === 'all') return base;
          // 'preferences': restore defaults but keep onboardingComplete and all 7 custom field keys
          return {
            ...base,
            onboardingComplete: s.onboardingComplete,
            storyPointsFieldKey: s.storyPointsFieldKey,
            epicLinkFieldKey: s.epicLinkFieldKey,
            epicNameFieldKey: s.epicNameFieldKey,
            sprintFieldKey: s.sprintFieldKey,
            epicColorFieldKey: s.epicColorFieldKey,
            flaggedFieldKey: s.flaggedFieldKey,
            accountFieldKey: s.accountFieldKey,
            rankFieldKey: s.rankFieldKey,
          };
        }),
    }),
    {
      name: 'settings-store',
      storage: createTauriStorage('settings.json'),
      version: 26,
      migrate: (persisted, version) => {
        const s = persisted as Record<string, unknown>;
        if (version < 1) {
          if (s.density === undefined) s.density = 'default';
          if (s.sprintCollapseByDefault === undefined) s.sprintCollapseByDefault = false;
        }
        if (version < 2) {
          if (s.keyboardOverrides === undefined) s.keyboardOverrides = {};
        }
        if (version < 3) {
          if (s.notifCommentMentionEnabled === undefined) s.notifCommentMentionEnabled = true;
          if (s.notifIssueUpdateEnabled === undefined) s.notifIssueUpdateEnabled = true;
          if (s.notifMrNoteEnabled === undefined) s.notifMrNoteEnabled = true;
          if (s.notifGitlabMentionEnabled === undefined) s.notifGitlabMentionEnabled = true;
          if (s.notifJiraCommentEnabled === undefined) s.notifJiraCommentEnabled = true;
          if (s.notifMrApprovalEnabled === undefined) s.notifMrApprovalEnabled = true;
          if (s.notifPipelineFailureEnabled === undefined) s.notifPipelineFailureEnabled = true;
          if (s.notifIssueAssignmentEnabled === undefined) s.notifIssueAssignmentEnabled = true;
          if (s.notifDueDateReminderEnabled === undefined) s.notifDueDateReminderEnabled = true;
        }
        if (version < 4) {
          if (s.epicColorFieldKey === undefined) s.epicColorFieldKey = 'customfield_10013';
        }
        if (version < 5) {
          if (s.quickFilters === undefined) s.quickFilters = [];
        }
        if (version < 6) {
          if (s.sidebarCollapsed === undefined) s.sidebarCollapsed = false;
        }
        if (version < 7) {
          if (s.commentSortOrder === undefined) s.commentSortOrder = 'newest';
        }
        if (version < 8) {
          s.devToolsEnabled = (s as Record<string, unknown>).debugMode === true;
          s.requestLogging = (s as Record<string, unknown>).debugMode === true;
          s.responseBodyCapture = (s as Record<string, unknown>).debugMode === true;
          s.operationProfiling = false;
          s.performanceWaterfall = false;
          s.retentionLimit = 200;
          delete (s as Record<string, unknown>).debugMode;
        }
        if (version < 9) {
          s.sidebarItems = getDefaultSidebarItems();
        }
        if (version < 10) {
          if (s.updateCheckInterval === undefined) s.updateCheckInterval = 6;
        }
        if (version < 11) {
          if (s.lastSeenVersion === undefined) s.lastSeenVersion = null;
          if (s.lastSeenChangelog === undefined) s.lastSeenChangelog = null;
        }
        if (version < 12) {
          if (s.lastChecked === undefined) s.lastChecked = null;
        }
        if (version < 13) {
          if (s.jiraConcurrencyLimit === undefined) s.jiraConcurrencyLimit = 6;
        }
        if (version < 14) {
          if (s.sidebarWidth === undefined) s.sidebarWidth = 224;
          if (s.issueDetailPanelWidth === undefined) s.issueDetailPanelWidth = null;
          if (s.mrDetailPanelWidth === undefined) s.mrDetailPanelWidth = 288;
          if (s.releaseDetailPanelWidth === undefined) s.releaseDetailPanelWidth = 288;
        }
        if (version < 15) {
          if (s.aioEnabled === undefined) s.aioEnabled = false;
        }
        if (version < 16) {
          if (Array.isArray(s.sidebarItems)) {
            s.sidebarItems = appendAioItemIfMissing(s.sidebarItems as SidebarItem[]);
          }
        }
        if (version < 17) {
          if (s.selectedAioProjectKey === undefined) s.selectedAioProjectKey = null;
        }
        if (version < 18) {
          if (s.flaggedFieldKey === undefined) s.flaggedFieldKey = 'customfield_10021';
        }
        if (version < 19) {
          // No new fields to initialize. Version bump drops dashboardLayout from
          // persisted shape implicitly — Zustand LazyStore ignores extra keys.
        }
        if (version < 20) {
          if (s.tempoEnabled === undefined) s.tempoEnabled = false;
        }
        if (version < 21) {
          if (Array.isArray(s.sidebarItems)) {
            s.sidebarItems = appendWorklogsItemIfMissing(s.sidebarItems as SidebarItem[]);
          }
        }
        if (version < 22) {
          delete (s as Record<string, unknown>).role;
        }
        if (version < 23) {
          if (Array.isArray(s.sidebarItems)) {
            s.sidebarItems = appendStandupNotesItemIfMissing(s.sidebarItems as SidebarItem[]);
          }
        }
        if (version < 24) {
          delete (s as Record<string, unknown>).showSubtasksInMyTasks;
        }
        if (version < 25) {
          if (s.rankFieldKey === undefined) s.rankFieldKey = null;
        }
        if (version < 26) {
          if (s.peekPanelWidth === undefined) s.peekPanelWidth = null;
        }
        return persisted as SettingsState;
      },
    },
  ),
);
