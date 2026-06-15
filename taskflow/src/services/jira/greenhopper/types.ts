/**
 * Shared GreenHopper response type definitions used across all domain modules.
 *
 * This file is the single source of truth for every GreenHopper REST API
 * response shape consumed by `services/jira/greenhopper/`. Domain modules
 * (allData/data/details/transitions, entityMaps, adapter) import from here;
 * they never define their own interfaces for GreenHopper entities.
 *
 * Shapes are lifted verbatim from .planning/phases/71-greenhopper-adapter-foundation/71-RESEARCH.md
 * §"API Response Shapes (TypeScript Types)" and verified against
 * .planning/research/GREENHOPPER-API.md plus the redacted captures under
 * `__fixtures__/*.real.json`.
 *
 * Endpoints sourced from:
 *  - GET /rest/greenhopper/1.0/xboard/work/allData.json?rapidViewId=...
 *  - GET /rest/greenhopper/1.0/xboard/plan/backlog/data.json?rapidViewId=...
 *  - GET /rest/greenhopper/1.0/xboard/issue/details.json?...
 *  - GET /rest/greenhopper/1.0/xboard/work/transitions.json?projectId=...
 */

/**
 * Base shape for every issue row returned by allData.issuesData.issues
 * (as GhBoardIssue) and by data.json (as GhIssue).
 * See RESEARCH §API Response Shapes.
 */
export interface GhIssue {
  id: number;
  key: string;
  hidden: boolean;
  typeId: string;
  summary: string;
  priorityId: string;
  done: boolean;
  assignee?: string; // username
  assigneeName?: string; // display name
  avatarUrl?: string;
  hasCustomUserAvatar: boolean;
  color: string; // hex
  flagged?: boolean;
  epicId?: number;
  epic?: string; // epic issue key
  parentId?: number; // present on sub-tasks
  parentKey?: string;
  estimateStatisticRequired: boolean;
  estimateStatistic: {
    statFieldId: string;
    statFieldValue: { value?: number; text?: string };
  };
  trackingStatistic: {
    statFieldId: string;
    statFieldValue: { value?: number; text?: string };
  };
  statusId: string;
  fixVersions: number[];
  projectId: number;
}

/**
 * Board-only extension of GhIssue. Returned by allData.issuesData.issues
 * (board context), NOT by data.json (backlog).
 * See RESEARCH §API Response Shapes.
 */
export interface GhBoardIssue extends GhIssue {
  timeInColumn: {
    enteredStatus: number; // unix ms
    durationPreviously: number;
  };
}

/**
 * Status entity returned in allData.entityData.statuses (keyed by statusId).
 * See RESEARCH §API Response Shapes.
 */
export interface GhStatusEntity {
  statusUrl: string;
  statusName: string;
  status: {
    id: string;
    name: string;
    description: string;
    iconUrl: string;
    statusCategory: { id: string; key: string; colorName: string };
  };
}

/**
 * Priority entity returned in allData.entityData.priorities (keyed by priorityId).
 * See RESEARCH §API Response Shapes.
 */
export interface GhPriorityEntity {
  priorityName: string;
  priorityUrl: string;
}

/**
 * Issue-type entity returned in allData.entityData.types (keyed by typeId).
 * See RESEARCH §API Response Shapes.
 */
export interface GhTypeEntity {
  typeUrl: string;
  typeName: string;
}

/**
 * Epic entity returned in allData.entityData.epics (keyed by epicId).
 * See RESEARCH §API Response Shapes.
 */
export interface GhEpicEntity {
  epicField: {
    id: string;
    label: string;
    editable: boolean;
    renderer: string;
    epicKey: string;
    epicColor: string;
    text: string;
  };
}

/**
 * Full response of GET /rest/greenhopper/1.0/xboard/work/allData.json.
 * Carries the entity maps + board/swimlane/column structure + issues.
 * See RESEARCH §API Response Shapes.
 */
export interface GhAllDataResponse {
  rapidViewId: number;
  statistics: {
    fieldConfigured: boolean;
    typeId: string;
    id: string;
    name: string;
  };
  entityData: {
    statuses: Record<string, GhStatusEntity>;
    priorities: Record<string, GhPriorityEntity>;
    types: Record<string, GhTypeEntity>;
    epics: Record<string, GhEpicEntity>;
  };
  columnsData: {
    rapidViewId: number;
    columns: Array<{ id: number; name: string; statusIds: string[] }>;
  };
  swimlanesData: {
    rapidViewId: number;
    swimlaneStrategy: string;
    parentSwimlanesData: {
      parentIssueIds: number[];
      inprogressCandidates: number[];
      doneCandidates: number[];
    };
  };
  issuesData: {
    rapidViewId: number;
    activeFilters: unknown[];
    issues: GhBoardIssue[];
  };
}

/**
 * Single sprint row inside `data.sprints[]` returned by
 * GET /rest/greenhopper/1.0/xboard/plan/backlog/data.json.
 *
 * Sprint membership for backlog issues is expressed via `issuesIds: number[]`
 * (NOT via per-issue `sprint`/`sprintId` field on GhIssue) — consumers build a
 * reverse index `issueId → sprintId` at the call site. See Phase 74 D-04b.
 *
 * Sprint `state` is an uppercase string literal union as observed in the
 * real fixture (`'ACTIVE' | 'CLOSED' | 'FUTURE'`) — see Phase 74 RESEARCH A5.
 */
export interface GhSprintBacklog {
  id: number;
  sequence: number;
  rapidViewId: number;
  name: string;
  state: 'ACTIVE' | 'CLOSED' | 'FUTURE';
  autoStartStop: boolean;
  synced: boolean;
  startDate: string;
  endDate: string;
  activatedDate: string;
  completeDate: string;
  canUpdateSprint: boolean;
  canStartStopSprint: boolean;
  canUpdateDates: boolean;
  remoteLinks: unknown[];
  daysRemaining: number;
  timeRemaining?: { text: string; isFuture: boolean };
  goal?: string;
  issuesIds: number[];
}

/**
 * Full response of GET /rest/greenhopper/1.0/xboard/plan/backlog/data.json.
 *
 * Carries `issues`, `entityData` (same shape as `GhAllDataResponse.entityData`
 * — Phase 74 RESEARCH A3), `sprints[]` with `issuesIds[]` for sprint
 * membership, `rankCustomFieldId`, `projects`, `versionData`, and a set of
 * top-level capability/permission flags. Real fixture pinned by
 * `__tests__/types-fixture.test.ts`.
 *
 * Shape derived from `__fixtures__/data.real.json` (Phase 74 D-04a) — the
 * earlier shape `{ issues: GhIssue[] }` was incorrect.
 */
export interface GhBacklogResponse {
  issues: GhIssue[];
  entityData: GhAllDataResponse['entityData'];
  rankCustomFieldId: number;
  sprints: GhSprintBacklog[];
  supportsPages: boolean;
  projects: Array<{ id: number; key: string; name: string }>;
  canManageSprints: boolean;
  canCreateIssue: boolean;
  versionData: {
    versionsPerProject: Record<string, Array<{ id: number; name: string; released: boolean }>>;
    canCreateVersion: boolean;
    isLinkToDevStatusVersionAvailable: boolean;
  };
  hasBulkChangePermission: boolean;
  issueArchivingEnabled: boolean;
  emptyFilterBoard: boolean;
  cardColorStrategy: string;
}

/**
 * Single transition row returned by transitions.json's workflowToTransitions arrays.
 * `fromStatusId` is absent when `isGlobal === true`.
 * See RESEARCH §API Response Shapes.
 */
export interface GhTransition {
  transitionId: number;
  name: string;
  toStatusId: number;
  fromStatusId?: number; // absent when isGlobal
  hasScreen: boolean;
  hasConditions: boolean;
  hasValidators: boolean;
  isInitial: boolean;
  isGlobal: boolean;
}

/**
 * Full response of GET /rest/greenhopper/1.0/xboard/work/transitions.json?projectId=...
 * `projectAndIssueTypeToWorkflow[projectId][typeId] -> workflowName`, then
 * `workflowToTransitions[workflowName] -> GhTransition[]`.
 * See RESEARCH §API Response Shapes.
 */
export interface GhTransitionsResponse {
  projectAndIssueTypeToWorkflow: Record<string, Record<string, string>>;
  workflowToTransitions: Record<string, GhTransition[]>;
}

/**
 * Full response of GET /rest/greenhopper/1.0/xboard/issue/details.json.
 * Phase 71 keeps `tabs.defaultTabs` loose per RESEARCH Assumption A3 —
 * Phase 75 narrows each tabId variant.
 * See RESEARCH §API Response Shapes.
 */
export interface GhDetailsResponse {
  key: string;
  id: number;
  editable: boolean;
  canCreateComment: boolean;
  isSubtask: boolean;
  totalComments: number;
  flagged: boolean;
  projectName: string;
  projectAvatarUrl: string;
  isAssigned: boolean;
  primaryStatisticFieldId: string;
  trackingStatisticFieldId: string;
  sprint: {
    id: number;
    sequence: number;
    rapidViewId: number;
    name: string;
    state: 'ACTIVE' | 'CLOSED' | 'FUTURE';
    autoStartStop: boolean;
    synced: boolean;
  };
  operations: {
    issueKey: string;
    sections: Array<{
      groupId: string;
      operations: Array<{
        id: string;
        label: string;
        title: string;
        styleClass: string;
        url: string;
      }>;
    }>;
  };
  tabs: {
    defaultTabs: Array<{
      tabId:
        | 'HEADER'
        | 'DETAILS'
        | 'DESCRIPTION'
        | 'COMMENT'
        | 'ATTACHMENT'
        | 'SUB_TASKS'
        | 'ISSUES_IN_EPIC'
        | 'THIRD_PARTY_TAB';
      [key: string]: unknown;
    }>;
  };
}

/**
 * A single change entry within the `GreenHopperBurndown.changes` record.
 *
 * Shape: CONFIRMED via live curl (board 6708, sprint 19562, 2026-06-15 — UAT-4 gap closure).
 * For a `timeestimate` statistic the deltas live under `timeC: { oldEstimate, newEstimate,
 * timeSpent }` (SECONDS), NOT the originally-assumed `statC: { newValue, oldValue }`. `statC`
 * is retained (optional) so a story-point-statistic board still parses via the fallback path.
 * All fields are optional so `parseBurndownChanges` (dashboardMetrics.ts, the sole consumer)
 * stays null-safe; it MUST use `?? 0` fallbacks and `Math.max(0, ...)` clamping.
 *
 * If the live DC returns yet other field names, update this interface AND the parser in
 * dashboardMetrics.ts together — not just one or the other.
 */
export interface BurndownChangeEntry {
  /** Issue key this change applies to (e.g. "PROJ-123") */
  key?: string;
  /**
   * Time-estimate change (live shape for a `timeestimate` statistic). Values in SECONDS
   * (Jira DC native unit; 28800 = 8h). `parseBurndownChanges` burns down on
   * `newEstimate - oldEstimate`. `timeSpent` is informational (logged work in the transition).
   */
  timeC?: {
    oldEstimate?: number;
    newEstimate?: number;
    timeSpent?: number;
  };
  /**
   * Statistic change for a non-time statistic (e.g. story points): new/old values of the
   * tracked metric. Fallback path when `timeC` is absent. Kept for board configs whose
   * `statisticField` is not `timeestimate`.
   */
  statC?: {
    newValue?: number;
    oldValue?: number;
  };
  /** True when the issue was added to the sprint (scope creep); false/absent when removed or updated. */
  added?: boolean;
}

/**
 * Response shape for GET /rest/greenhopper/1.0/rapid/charts/scopechangeburndownchart.
 *
 * Top-level keys confirmed by Probe C (2026-06-15):
 * activatedTime, changes, endTime, issueToParentKeys, issueToSummary, now,
 * openCloseChanges, startTime, statisticField, workRateData.
 *
 * `statisticField` = `"timeestimate"` on this DC instance — the burndown unit is
 * HOURS REMAINING (time estimate), NOT story points. Y-axis must be labeled in hours.
 *
 * `changes` has ~496 entries at probe time. Keys are epoch-ms strings; values are
 * arrays of BurndownChangeEntry deltas for all issues that changed at that timestamp.
 */
export interface GreenHopperBurndown {
  /** Sprint activation time (epoch ms) */
  activatedTime: number;
  /** Sprint end time (epoch ms) */
  endTime: number;
  /** Sprint start time (epoch ms) — used as the anchor point for parseBurndownChanges */
  startTime: number;
  /** Server clock time at response generation (epoch ms) */
  now: number;
  /**
   * Burndown change timeline. Keys are epoch-ms strings (serialized numbers).
   * Each value is an array of BurndownChangeEntry deltas at that point in time.
   *
   * All-optional BurndownChangeEntry: the entry-level field names are MEDIUM-confidence
   * (RESEARCH A2). 85-01's parseBurndownChanges must remain null-safe (?? 0, Math.max(0, ...)).
   */
  changes: Record<string, BurndownChangeEntry[]>;
  /**
   * Statistic field descriptor. Live DC returns an OBJECT (confirmed 2026-06-15), e.g.
   * `{ fieldId: 'timeestimate', name: 'Remaining Time Estimate', renderer: 'duration' }` —
   * NOT a bare string. `fieldId: 'timeestimate'` → Y-axis is hours remaining (not story points).
   * Loosely typed; the chart hardcodes the seconds→hours conversion and does not read this.
   */
  statisticField?: { fieldId?: string; name?: string; renderer?: string } | string;
  /**
   * Ideal burndown guideline data. Shape is loosely typed — the chart component
   * (BurndownChart.tsx) owns parsing and rendering of this guideline series.
   */
  workRateData?: { rates?: unknown[] } | unknown;
  /** Parent-key map for issues in the burndown (key → parent key). */
  issueToParentKeys?: Record<string, string>;
  /** Summary map for issues in the burndown (key → summary string). */
  issueToSummary?: Record<string, string>;
  /** Open/close change data (auxiliary, not used for the primary burndown line). */
  openCloseChanges?: unknown;
}

/**
 * Aggregated entity maps built from GhAllDataResponse.entityData per D-09.
 * Consumed by resolvers (Phase 71-04) and adapter (Phase 71-05).
 * See RESEARCH §Entity Map Shape.
 */
export interface EntityMaps {
  statuses: Record<string, GhStatusEntity>;
  priorities: Record<string, GhPriorityEntity>;
  types: Record<string, GhTypeEntity>;
  epics: Record<string, GhEpicEntity>;
}
