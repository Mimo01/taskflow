/**
 * Tempo Timesheets type definitions.
 *
 * Field names derived from the Phase 61 live probe against Jira DC v3.
 * See .planning/phases/61-tempo-probe-service-layer/61-PROBE-RESULT.md for full
 * probe JSON and resolution of assumptions A1 (author shape), A2 (username param),
 * A3 (no pagination).
 *
 * NOTE: v3 returns a plain TempoWorklog[] array — no pagination envelope.
 * dateStarted is normalized to YYYY-MM-DD by fetchWorklogs (slice(0, 10)).
 */

/**
 * A single Tempo Timesheets worklog entry.
 * Returned as a flat array by GET /rest/tempo-timesheets/3/worklogs
 * (Phase 61 probe confirmed — no pagination wrapper on this DC instance).
 */
export interface TempoWorklog {
  tempoWorklogId?: number;
  jiraWorklogId?: number;
  issue: {
    key: string;
    id?: string | number;
    projectId?: string | number;
    summary?: string;
    issueType?: { name: string };
  };
  author: {
    name: string;
    key?: string;
    displayName?: string;
  };
  timeSpentSeconds: number;
  /** ISO date string normalized to YYYY-MM-DD by fetchWorklogs (was ISO 8601 datetime with TZ offset from API). */
  dateStarted: string;
  comment?: string;
  dateCreated?: string;
  dateUpdated?: string;
  worklogAttributes?: unknown[];
  workAttributeValues?: Array<{
    workAttribute?: { name: string };
    value?: string;
  }>;
}
