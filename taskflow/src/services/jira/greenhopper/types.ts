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
    versionsPerProject: Record<
      string,
      Array<{ id: number; name: string; released: boolean }>
    >;
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
