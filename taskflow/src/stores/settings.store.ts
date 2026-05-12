/**
 * Settings store — role and theme, persisted via Tauri Store plugin.
 *
 * Uses Zustand persist middleware with a custom storage adapter that
 * reads/writes via LazyStore from @tauri-apps/plugin-store.
 */

// biome-ignore assist/source/organizeImports: import order must match module init order to avoid TDZ circular dependency with registry
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createTauriStorage } from '../lib/tauri-storage';
import { setJiraConcurrencyLimit as setConcurrencyRuntime } from '../lib/concurrency';
import type { Theme } from '../services/theme';
import type { QuickFilter } from './filter.store';
import { getDefaultSidebarItems } from '@/components/app/sidebar-items';
import { getDefaultDashboardLayout, WIDGET_REGISTRY } from '@/routes/dashboard/widgets/registry';

export type Density = 'compact' | 'default' | 'comfortable';
export type CommentSortOrder = 'newest' | 'oldest';

export interface SidebarItem {
  id: string;
  visible: boolean;
}

export interface DashboardLayoutItem {
  i: string; // unique instance ID e.g. 'my-subtasks-1'
  type: string; // widget type from registry e.g. 'my-subtasks'
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  config?: Record<string, unknown>; // widget-specific config (JQL query etc.)
}
interface SettingsState {
  role: 'developer' | 'pm' | 'tech-lead' | null;
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
  /** Discovered account custom field key. Reserved for Phase 11. */
  accountFieldKey: string | null;
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
  /** Show subtasks inside My Tasks view. Default: true. */
  showSubtasksInMyTasks: boolean;
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
  /** MR detail right panel width in px. Default: 288 (w-72). */
  mrDetailPanelWidth: number;
  setMrDetailPanelWidth: (w: number) => void;
  /** Release detail right panel width in px. Default: 288 (w-72). */
  releaseDetailPanelWidth: number;
  setReleaseDetailPanelWidth: (w: number) => void;
  /** Enable AIO Test Management integration. Default: false. Gates all AIO API calls. */
  aioEnabled: boolean;
  setAioEnabled: (v: boolean) => void;
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
  setShowSubtasksInMyTasks: (v: boolean) => void;
  setRole: (role: 'developer' | 'pm' | 'tech-lead') => void;
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
  setAccountFieldKey: (key: string | null) => void;
  /** Sidebar item visibility and order. Default: DEV_SIDEBAR_PRESET. */
  sidebarItems: SidebarItem[];
  /** Dashboard widget layout grid. Default: DEV_DASHBOARD_PRESET. */
  dashboardLayout: DashboardLayoutItem[];
  setSidebarItems: (items: SidebarItem[]) => void;
  setSidebarItemVisible: (id: string, visible: boolean) => void;
  reorderSidebarItem: (fromIndex: number, toIndex: number) => void;
  setDashboardLayout: (layout: DashboardLayoutItem[]) => void;
  addDashboardWidget: (widgetType: string) => void;
  removeDashboardWidget: (widgetId: string) => void;
  updateWidgetConfig: (widgetId: string, config: Record<string, unknown>) => void;
  applyPreset: (preset: 'dev' | 'pm') => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      role: null,
      theme: 'system',
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
      accountFieldKey: null,
      devToolsEnabled: false,
      requestLogging: false,
      responseBodyCapture: false,
      operationProfiling: false,
      performanceWaterfall: false,
      retentionLimit: 200,
      jiraConcurrencyLimit: 6,
      density: 'default' as Density,
      sprintCollapseByDefault: false,
      showSubtasksInMyTasks: true,
      keyboardOverrides: {},
      commentSortOrder: 'newest' as CommentSortOrder,
      setCommentSortOrder: (order) => set({ commentSortOrder: order }),
      updateCheckInterval: 6 as 1 | 6 | 12 | 24 | 'manual',
      setUpdateCheckInterval: (v) => set({ updateCheckInterval: v }),
      lastSeenVersion: null,
      lastSeenChangelog: null,
      setLastSeenVersion: (v) => set({ lastSeenVersion: v }),
      setLastSeenChangelog: (v) => set({ lastSeenChangelog: v }),
      lastChecked: null,
      setLastChecked: (iso) => set({ lastChecked: iso }),
      sidebarCollapsed: false,
      toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      sidebarWidth: 224,
      setSidebarWidth: (w) => set({ sidebarWidth: w }),
      issueDetailPanelWidth: null,
      setIssueDetailPanelWidth: (w) => set({ issueDetailPanelWidth: w }),
      mrDetailPanelWidth: 288,
      setMrDetailPanelWidth: (w) => set({ mrDetailPanelWidth: w }),
      releaseDetailPanelWidth: 288,
      setReleaseDetailPanelWidth: (w) => set({ releaseDetailPanelWidth: w }),
      aioEnabled: false,
      setAioEnabled: (v) => set({ aioEnabled: v }),
      quickFilters: [],
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
          if (idx === -1) return state;
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
      notifCommentMentionEnabled: true,
      notifIssueUpdateEnabled: true,
      notifMrNoteEnabled: true,
      notifGitlabMentionEnabled: true,
      notifJiraCommentEnabled: true,
      notifMrApprovalEnabled: true,
      notifPipelineFailureEnabled: true,
      notifIssueAssignmentEnabled: true,
      notifDueDateReminderEnabled: true,
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
      setShowSubtasksInMyTasks: (v) => set({ showSubtasksInMyTasks: v }),
      setRole: (role) => set({ role }),
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
      setAccountFieldKey: (key) => set({ accountFieldKey: key }),
      sidebarItems: getDefaultSidebarItems('dev'),
      dashboardLayout: getDefaultDashboardLayout('dev'),
      setSidebarItems: (items) => set({ sidebarItems: items }),
      setSidebarItemVisible: (id, visible) =>
        set((s) => ({
          sidebarItems: s.sidebarItems.map((item) =>
            item.id === id ? { ...item, visible } : item,
          ),
        })),
      reorderSidebarItem: (fromIndex, toIndex) =>
        set((s) => {
          const arr = [...s.sidebarItems];
          const [item] = arr.splice(fromIndex, 1);
          arr.splice(toIndex, 0, item);
          return { sidebarItems: arr };
        }),
      setDashboardLayout: (layout) => set({ dashboardLayout: layout }),
      addDashboardWidget: (widgetType) =>
        set((s) => {
          const reg = WIDGET_REGISTRY[widgetType];
          if (!reg) return s;
          const count = s.dashboardLayout.filter((w) => w.type === widgetType).length;
          const newItem: DashboardLayoutItem = {
            i: `${widgetType}-${count + 1}-${Date.now()}`,
            type: widgetType,
            x: 0,
            y: Infinity,
            w: reg.defaultSize.w,
            h: reg.defaultSize.h,
            minW: reg.minSize.w,
            minH: reg.minSize.h,
            maxW: reg.maxSize.w,
            maxH: reg.maxSize.h,
          };
          return { dashboardLayout: [...s.dashboardLayout, newItem] };
        }),
      removeDashboardWidget: (widgetId) =>
        set((s) => ({
          dashboardLayout: s.dashboardLayout.filter((w) => w.i !== widgetId),
        })),
      updateWidgetConfig: (widgetId, config) =>
        set((s) => ({
          dashboardLayout: s.dashboardLayout.map((w) =>
            w.i === widgetId ? { ...w, config: { ...w.config, ...config } } : w,
          ),
        })),
      applyPreset: (preset) =>
        set({
          sidebarItems: getDefaultSidebarItems(preset),
          dashboardLayout: getDefaultDashboardLayout(preset),
        }),
    }),
    {
      name: 'settings-store',
      storage: createTauriStorage('settings.json'),
      version: 15,
      migrate: (persisted, version) => {
        const s = persisted as Record<string, unknown>;
        if (version < 1) {
          if (s.density === undefined) s.density = 'default';
          if (s.sprintCollapseByDefault === undefined) s.sprintCollapseByDefault = false;
          if (s.showSubtasksInMyTasks === undefined) s.showSubtasksInMyTasks = true;
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
          const role = s.role as string | null;
          const preset = role === 'pm' ? 'pm' : 'dev';
          s.sidebarItems = getDefaultSidebarItems(preset);
          s.dashboardLayout = getDefaultDashboardLayout(preset);
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
        return persisted as SettingsState;
      },
    },
  ),
);
