/**
 * Settings store — role and theme, persisted via Tauri Store plugin.
 *
 * Uses Zustand persist middleware with a custom storage adapter that
 * reads/writes via LazyStore from @tauri-apps/plugin-store.
 */

import { LazyStore } from '@tauri-apps/plugin-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { type SidebarItem, getDefaultSidebarItems } from '../components/app/sidebar-items';
import type { Theme } from '../services/theme';
import type { QuickFilter } from './filter.store';

export type Density = 'compact' | 'default' | 'comfortable';
export type CommentSortOrder = 'newest' | 'oldest';

const tauriStore = new LazyStore('settings.json');

/**
 * Custom storage adapter for Zustand persist middleware,
 * backed by Tauri Store plugin for cross-platform persistence.
 */
const tauriStorage = createJSONStorage(() => ({
  getItem: async (name: string): Promise<string | null> => {
    const value = await tauriStore.get<string>(name);
    return value ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await tauriStore.set(name, value);
    await tauriStore.save();
  },
  removeItem: async (name: string): Promise<void> => {
    await tauriStore.delete(name);
    await tauriStore.save();
  },
}));

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
  /** Enable API call logging for debug inspection. Default: false. */
  debugMode: boolean;
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
  /** Ordered list of sidebar items with visibility. */
  sidebarItems: SidebarItem[];
  setSidebarItems: (items: SidebarItem[]) => void;
  setSidebarItemVisible: (id: string, visible: boolean) => void;
  reorderSidebarItem: (fromIndex: number, toIndex: number) => void;
  /** Apply a role preset — resets sidebar items and dashboard layout. */
  applyPreset: (preset: 'dev' | 'pm') => void;
  /** Whether the sidebar is collapsed to icon-only mode. Default: false. */
  sidebarCollapsed: boolean;
  toggleSidebarCollapsed: () => void;
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
  setDebugMode: (v: boolean) => void;
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
      debugMode: false,
      density: 'default' as Density,
      sprintCollapseByDefault: false,
      showSubtasksInMyTasks: true,
      keyboardOverrides: {},
      commentSortOrder: 'newest' as CommentSortOrder,
      setCommentSortOrder: (order) => set({ commentSortOrder: order }),
      sidebarItems: getDefaultSidebarItems('dev'),
      setSidebarItems: (items) => set({ sidebarItems: items }),
      setSidebarItemVisible: (id, visible) =>
        set((s) => ({
          sidebarItems: s.sidebarItems.map((item) =>
            item.id === id ? { ...item, visible } : item,
          ),
        })),
      reorderSidebarItem: (fromIndex, toIndex) =>
        set((s) => {
          const items = [...s.sidebarItems];
          const [moved] = items.splice(fromIndex, 1);
          items.splice(toIndex, 0, moved);
          return { sidebarItems: items };
        }),
      applyPreset: (preset) =>
        set({ sidebarItems: getDefaultSidebarItems(preset) }),
      sidebarCollapsed: false,
      toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
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
      setDebugMode: (v) => set({ debugMode: v }),
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
    }),
    {
      name: 'settings-store',
      storage: tauriStorage,
      version: 8,
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
          if (s.sidebarItems === undefined) {
            const role = s.role as string | null;
            const preset = role === 'pm' ? 'pm' : 'dev';
            s.sidebarItems = getDefaultSidebarItems(preset) as unknown as string;
          }
        }
        return s as unknown as SettingsState;
      },
    },
  ),
);
