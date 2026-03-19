/**
 * Jira field discovery and metadata operations.
 */

import { ApiError } from '../../lib/api-error';
import { apiFetch } from '../../lib/apiFetch';
import type { CreatemetaField, JiraProjectStatus } from './types';

/**
 * Discover the custom field IDs for this Jira instance.
 *
 * Calls GET /rest/api/2/field to get all field descriptors, then matches by schema.
 * Falls back to standard defaults on any failure.
 *
 * Cache the result in settings store at app startup.
 */
export async function discoverCustomFields(
  baseUrl: string,
  token: string,
): Promise<{
  storyPointsFieldKey: string;
  epicLinkFieldKey: string;
  epicNameFieldKey: string;
  sprintFieldKey: string;
  epicColorFieldKey: string;
}> {
  const defaults = {
    storyPointsFieldKey: 'customfield_10016',
    epicLinkFieldKey: 'customfield_10014',
    epicNameFieldKey: 'customfield_10015',
    sprintFieldKey: 'customfield_10020',
    epicColorFieldKey: 'customfield_10013',
  };
  try {
    const response = await apiFetch('jira', `${baseUrl.replace(/\/$/, '')}/rest/api/2/field`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return defaults;
    const fields: Array<{ id: string; name: string; schema?: { custom?: string } }> =
      await response.json();
    const result = { ...defaults };
    for (const f of fields) {
      const custom = f.schema?.custom ?? '';
      if (custom === 'com.pyxis.greenhopper.jira:gh-epic-link') result.epicLinkFieldKey = f.id;
      if (custom === 'com.pyxis.greenhopper.jira:gh-epic-label') result.epicNameFieldKey = f.id;
      if (custom === 'com.pyxis.greenhopper.jira:gh-sprint') result.sprintFieldKey = f.id;
      if (custom === 'com.pyxis.greenhopper.jira:gh-epic-color') result.epicColorFieldKey = f.id;
      if (
        custom === 'com.atlassian.jira.plugin.system.customfieldtypes:float' &&
        (f.name === 'Story Points' || f.name === 'story_points')
      )
        result.storyPointsFieldKey = f.id;
      if (f.id === 'customfield_10028') result.storyPointsFieldKey = f.id;
    }
    return result;
  } catch {
    return defaults;
  }
}

/**
 * Derive an autoCompleteUrl for fields that the API doesn't provide one for.
 * Maps known plugin schema.custom patterns to their REST search endpoints.
 */
function deriveAutoCompleteUrl(field: CreatemetaField, base: string): string | undefined {
  if (field.autoCompleteUrl) return field.autoCompleteUrl;
  const custom = field.schema.custom ?? '';
  if (custom.includes('tempo-accounts'))
    return `${base}/rest/tempo-accounts/1/account/search?query=`;
  return undefined;
}

/**
 * Discover required fields for a given issue type via the createmeta endpoint.
 *
 * Strategy (Jira version adaptive):
 * 1. Try new paginated endpoint (Jira 8.4+): GET /rest/api/2/issue/createmeta/{project}/issuetypes/{id}
 * 2. On non-ok (including 404 on pre-8.4 instances), fall back to legacy flat endpoint:
 *    GET /rest/api/2/issue/createmeta?projectKeys={key}&issuetypeNames={name}&expand=projects.issuetypes.fields
 */
export async function fetchCreatemeta(
  baseUrl: string,
  token: string,
  projectKey: string,
  issueTypeId: string,
  issueTypeName: string,
): Promise<CreatemetaField[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}` };

  const enrich = (fields: CreatemetaField[]) =>
    fields.map((f) => ({ ...f, autoCompleteUrl: deriveAutoCompleteUrl(f, base) }));

  // Strategy A: Jira 8.4+ paginated endpoint
  const newEndpoint = `${base}/rest/api/2/issue/createmeta/${projectKey}/issuetypes/${issueTypeId}?maxResults=50`;
  const resp = await apiFetch('jira', newEndpoint, { headers });
  if (resp.ok) {
    const data = await resp.json();
    return enrich((data.values ?? []) as CreatemetaField[]);
  }

  // Strategy B: Legacy flat endpoint (pre-8.4 or 9.0+ with re-enabled flag)
  const legacyUrl = `${base}/rest/api/2/issue/createmeta?projectKeys=${projectKey}&issuetypeNames=${encodeURIComponent(issueTypeName)}&expand=projects.issuetypes.fields`;
  const legacyResp = await apiFetch('jira', legacyUrl, { headers });
  if (!legacyResp.ok) return [];
  const legacyData = await legacyResp.json();
  const fields = legacyData.projects?.[0]?.issuetypes?.[0]?.fields;
  if (!fields) return [];
  return enrich(Object.values(fields) as CreatemetaField[]);
}

/**
 * Fetch all statuses for a Jira project, flattened across issue types.
 *
 * Calls GET /rest/api/2/project/{projectKey}/statuses which returns one object
 * per issue type, each with a `statuses` array. This function flattens them
 * and deduplicates by status id (first occurrence wins).
 */
export async function fetchProjectStatuses(
  baseUrl: string,
  token: string,
  projectKey: string,
): Promise<JiraProjectStatus[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/project/${projectKey}/statuses`;
  const response = await apiFetch('jira', url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to fetch project statuses', response.status, 'jira');
    }
    throw new Error(`Failed to fetch project statuses: ${response.status}`);
  }
  const data: Array<{ statuses: JiraProjectStatus[] }> = await response.json();
  const seen = new Set<string>();
  const result: JiraProjectStatus[] = [];
  for (const issueType of data) {
    for (const status of issueType.statuses) {
      if (!seen.has(status.id)) {
        seen.add(status.id);
        result.push(status);
      }
    }
  }
  return result;
}
