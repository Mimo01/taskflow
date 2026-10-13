/**
 * AIO test case detail.
 *
 * GET /rest/aio-tcms-api/1.0/project/{pk}/testcase/{tcKey}/detail (live P4 CONFIRMED).
 * The response has no precondition or priority field.
 */

import { ApiError } from '../../lib/api-error';
import { aioFetch } from './client';
import { normalizeCustomFields } from './cycles';
import type { AioTestCaseDetail } from './types';

type RawTestCaseDetail = {
  key?: string;
  title?: string;
  description?: string;
  ownedByID?: string;
  createdDate?: number | string;
  status?: { name?: string };
  type?: { name?: string };
  folder?: { name?: string };
  version?: number | string;
  customFields?: unknown;
};

function str(v: string | undefined | null): string | undefined {
  return v ? v : undefined;
}

/**
 * @returns AioTestCaseDetail; null when the test case is not found (404)
 * @throws ApiError with status 401 on authentication failure
 * @throws Error on network failure
 */
export async function fetchAioTestCaseDetail(
  baseUrl: string,
  token: string,
  projectKey: string,
  tcKey: string,
): Promise<AioTestCaseDetail | null> {
  const path = `/project/${encodeURIComponent(projectKey)}/testcase/${encodeURIComponent(tcKey)}/detail`;
  let response: Response;
  try {
    response = await aioFetch(baseUrl, token, path, 'Load AIO Test Case');
  } catch {
    throw new Error(`Cannot reach AIO at ${baseUrl}`);
  }
  if (response.ok) {
    const raw = (await response.json()) as RawTestCaseDetail;
    return {
      key: raw.key ?? tcKey,
      title: raw.title ?? '',
      description: str(raw.description),
      statusName: str(raw.status?.name),
      typeName: str(raw.type?.name),
      folderName: str(raw.folder?.name),
      ownedByID: str(raw.ownedByID),
      createdDate: raw.createdDate != null ? new Date(raw.createdDate).toISOString() : undefined,
      version: raw.version != null ? String(raw.version) : undefined,
      customFields: normalizeCustomFields(raw.customFields),
    };
  }
  if (response.status === 401) {
    throw new ApiError('Invalid token or token has expired', 401, 'jira');
  }
  if (response.status === 404) {
    return null;
  }
  throw new Error(`AIO request failed with status ${response.status}`);
}
