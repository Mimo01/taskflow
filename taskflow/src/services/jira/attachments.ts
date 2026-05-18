/**
 * Attachment upload and delete service for Jira.
 *
 * Upload uses multipart FormData with X-Atlassian-Token: no-check header
 * (required by Jira to bypass XSRF protection on attachment uploads).
 * Content-Type is intentionally NOT set -- FormData sets the multipart
 * boundary automatically.
 */

import { ApiError } from '../../lib/api-error';
import { apiFetch } from '../../lib/apiFetch';
import type { JiraAttachment } from '../jira';

/**
 * Upload a file attachment to a Jira issue.
 *
 * @param baseUrl - Jira base URL
 * @param token - Personal Access Token
 * @param issueKey - Issue key (e.g. "PROJ-1")
 * @param file - File to upload
 * @returns Array of created attachment objects
 */
export async function uploadAttachment(
  baseUrl: string,
  token: string,
  issueKey: string,
  file: File,
): Promise<JiraAttachment[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/attachments`;

  const formData = new FormData();
  formData.append('file', file);

  let response: Response;
  try {
    response = await apiFetch('jira', url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Atlassian-Token': 'no-check',
      },
      body: formData,
    }, 'Manage Attachments');
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(`Failed to upload attachment to ${issueKey}`, response.status, 'jira');
    }
    throw new Error(`Failed to upload attachment to ${issueKey}: status ${response.status}`);
  }

  return (await response.json()) as JiraAttachment[];
}

/**
 * Delete an attachment by ID.
 *
 * @param baseUrl - Jira base URL
 * @param token - Personal Access Token
 * @param attachmentId - Attachment ID to delete
 */
export async function deleteAttachment(
  baseUrl: string,
  token: string,
  attachmentId: string,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/attachment/${attachmentId}`;

  let response: Response;
  try {
    response = await apiFetch('jira', url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }, 'Manage Attachments');
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(`Failed to delete attachment ${attachmentId}`, response.status, 'jira');
    }
    throw new Error(`Failed to delete attachment ${attachmentId}: status ${response.status}`);
  }
}
