/**
 * Shared Jira type definitions used across all domain modules.
 *
 * This file is the single source of truth for all Jira REST API response
 * shapes and request parameter types. Domain modules import from here;
 * they never define their own interfaces for Jira entities.
 *
 * Includes Phase 32 additions: JiraWorklog, JiraAssignableUser, ParsedDuration.
 */

export interface JiraUser {
  displayName: string;
  emailAddress: string;
  name: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: {
      id: string;
      name: string;
      statusCategory?: { key: 'new' | 'indeterminate' | 'done' };
    };
    assignee: { displayName: string; avatarUrls: { '48x48': string } } | null;
    customfield_10016: number | null; // story points (most common field key)
    issuetype: {
      name: string;
      subtask: boolean; // Use this -- NOT name comparison. Admins can rename issue types.
    };
    description?: string | null;
    // v1.1 additions (all optional -- non-breaking for all four existing callers):
    parent?: { id: string; key: string; fields: { summary: string } };
    subtasks?: Array<{
      id: string;
      key: string;
      fields: { summary: string; status: { name: string } };
    }>;
    timetracking?: {
      originalEstimate?: string;
      remainingEstimate?: string;
      timeSpent?: string;
      originalEstimateSeconds?: number;
      remainingEstimateSeconds?: number;
      timeSpentSeconds?: number;
    };
    // v1.8 additions — Reporter, Priority, Severity (all optional, additive):
    reporter?: { displayName: string; name?: string; avatarUrls: { '48x48': string } } | null;
    priority?: { name: string; iconUrl?: string } | null;
    customfield_13415?: { value?: string; name?: string } | null;
    [key: string]: unknown; // Enables issue.fields[storyPointsFieldKey] without casting
  };
}

export interface JiraFixVersion {
  id: string;
  name: string;
  releaseDate?: string; // "YYYY-MM-DD" -- absent when not set, never null in API response
  released: boolean;
  description?: string;
}

export interface JiraTransition {
  id: string;
  name: string;
  to: {
    id: string;
    name: string;
    statusCategory?: { id: number; key: string; name: string };
  };
}

export interface JiraComment {
  id: string;
  author: { displayName: string; name?: string };
  body: string;
  created: string; // ISO 8601
  updated: string;
}

export interface JiraActiveSprint {
  id: number;
  name: string;
  state: 'active' | 'future' | 'closed';
  startDate?: string;
  endDate?: string;
  goal?: string;
  originBoardId?: number;
}

export interface JiraIssueLink {
  id: string;
  type: { id: string; name: string; inward: string; outward: string };
  inwardIssue?: { id: string; key: string; fields: { summary: string; status: { name: string } } };
  outwardIssue?: { id: string; key: string; fields: { summary: string; status: { name: string } } };
}

export interface JiraAttachment {
  id: string;
  filename: string;
  content: string;
  thumbnail?: string;
  mimeType: string;
}

export interface JiraIssueDetail {
  id: string;
  key: string;
  fields: {
    summary: string;
    description: string | null;
    status: { id: string; name: string; statusCategory?: { key: string } };
    issuetype: { name: string; subtask: boolean };
    priority: { name: string; iconUrl?: string } | null;
    assignee: { displayName: string; name: string; avatarUrls: { '48x48': string } } | null;
    reporter: { displayName: string; name?: string; avatarUrls: { '48x48': string } } | null;
    subtasks: Array<{
      id: string;
      key: string;
      fields: { summary: string; status: { name: string } };
    }>;
    issuelinks: JiraIssueLink[];
    comment: { comments: JiraComment[] };
    attachment?: JiraAttachment[];
    labels: string[];
    fixVersions: Array<{ id: string; name: string }>;
    parent?: { id: string; key: string; fields: { summary: string } };
    created: string;
    updated: string;
    duedate: string | null;
    [key: string]: unknown;
  };
  changelog?: {
    histories: Array<{
      id: string;
      created: string;
      author: { displayName: string; avatarUrls?: { '48x48'?: string } };
      items: Array<{
        field: string;
        fieldtype: string;
        from: string | null;
        fromString: string | null;
        to: string | null;
        toString: string | null;
      }>;
    }>;
  };
}

export interface JiraProjectStatus {
  id: string;
  name: string;
  statusCategory: { key: 'new' | 'indeterminate' | 'done' | string };
}

/**
 * Field descriptor returned by the createmeta endpoints.
 * Returned by both the Jira 8.4+ paginated endpoint and the legacy flat endpoint.
 */
export interface CreatemetaField {
  fieldId: string;
  name: string;
  required: boolean;
  autoCompleteUrl?: string;
  schema: {
    type: string;
    items?: string;
    system?: string;
    custom?: string;
    allowedValues?: Array<{ id: string; value: string }>;
  };
}

/**
 * Issue link type descriptor returned by GET /rest/api/2/issueLinkType.
 */
export interface IssueLinkType {
  id: string;
  name: string;
  inward: string;
  outward: string;
}

export interface BacklogViewData {
  sprints: Array<{ sprint: JiraActiveSprint; issues: JiraIssue[] }>;
  backlog: JiraIssue[];
  epicNames?: Map<string, string>; // epicKey -> epic summary (display name); provided by shared fetchEpicsBasic cache
  epicColors?: Map<string, string>; // epicKey -> Jira color string; provided by shared fetchEpicsBasic cache
}

export interface EpicEnriched {
  key: string;
  epicName: string;
  summary: string;
  status: JiraIssue['fields']['status'];
  assignee: JiraIssue['fields']['assignee'];
  totalStories: number;
  doneStories: number;
  totalPoints: number;
  color?: string | null;
}

// --- Phase 32 additions: Time tracking, attachments, and mentions ---

export interface JiraWorklog {
  id: string;
  author: {
    displayName: string;
    name?: string;
    avatarUrls?: { '48x48'?: string };
  };
  updateAuthor?: {
    displayName: string;
    name?: string;
  };
  timeSpent: string;
  timeSpentSeconds: number;
  started: string;
  created: string;
  updated: string;
  comment?: string;
}

export interface JiraAssignableUser {
  displayName: string;
  name: string;
  key?: string;
  avatarUrls?: { '48x48'?: string; '24x24'?: string; '16x16'?: string };
}

export interface ParsedDuration {
  seconds: number;
  display: string;
}

// --- Phase 33 additions: Board quick filters ---

export interface JiraBoardQuickFilter {
  id: number;
  boardId: number;
  name: string;
  jql: string;
  description?: string;
  position: number;
}

// --- Phase 35 additions: Saved filters ---

export interface JiraSavedFilter {
  id: string;
  name: string;
  jql: string;
  description?: string;
  owner?: { displayName: string };
  favourite?: boolean;
}
