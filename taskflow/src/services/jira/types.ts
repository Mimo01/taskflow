/**
 * Extended Jira types for time tracking, attachments, and mentions.
 *
 * Base types (JiraAttachment, JiraComment, etc.) remain in ../jira.ts.
 * This module adds worklog and user types needed by the new service layer.
 */

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
