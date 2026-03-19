/**
 * Jira epic management: fetch, enrich, and list epic stories.
 */

import { fetchAllSearchPages } from './client';
import type { EpicEnriched, JiraIssue } from './types';

/**
 * Fetch all epics in a project without story enrichment -- fast first-load.
 */
export async function fetchEpicsBasic(
  baseUrl: string,
  token: string,
  projectKey: string,
  epicNameFieldKey = 'customfield_10015',
  epicColorFieldKey = 'customfield_10013',
): Promise<EpicEnriched[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const epicFields = [
    ...new Set(['summary', 'status', 'assignee', epicNameFieldKey, epicColorFieldKey]),
  ].join(',');
  const epicJql = encodeURIComponent(
    `project = ${projectKey} AND issuetype = Epic AND statusCategory != Done ORDER BY updated DESC`,
  );
  const epicIssues = await fetchAllSearchPages(
    `${base}/rest/api/2/search?jql=${epicJql}&fields=${epicFields}`,
    headers,
  );
  return epicIssues.map((epic) => ({
    key: epic.key,
    epicName: (epic.fields[epicNameFieldKey] as string | null) ?? epic.fields.summary,
    summary: epic.fields.summary,
    status: epic.fields.status,
    assignee: epic.fields.assignee,
    totalStories: 0,
    doneStories: 0,
    totalPoints: 0,
    color: (epic.fields[epicColorFieldKey] as string | null) ?? null,
  }));
}

/**
 * Fetch story counts and points for a set of epic keys and return a map.
 * Used to progressively enrich an already-displayed epic list.
 */
export async function fetchEpicEnrichmentMap(
  baseUrl: string,
  token: string,
  epicKeys: string[],
  storyPointsFieldKey = 'customfield_10016',
  epicLinkFieldKey = 'customfield_10014',
): Promise<Map<string, { total: number; done: number; points: number }>> {
  if (epicKeys.length === 0) return new Map();
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const storyFields = [
    ...new Set(['status', storyPointsFieldKey, epicLinkFieldKey, 'customfield_10016']),
  ].join(',');
  const storiesJql = encodeURIComponent(
    `"Epic Link" in (${epicKeys.join(',')}) AND issuetype != Sub-task`,
  );
  const stories = await fetchAllSearchPages(
    `${base}/rest/api/2/search?jql=${storiesJql}&fields=${storyFields}`,
    headers,
  ).catch(() => [] as JiraIssue[]);

  const countMap = new Map<string, { total: number; done: number; points: number }>();
  for (const story of stories) {
    const ek = story.fields[epicLinkFieldKey] as string | null;
    if (!ek) continue;
    const entry = countMap.get(ek) ?? { total: 0, done: 0, points: 0 };
    entry.total++;
    if (story.fields.status.statusCategory?.key === 'done') entry.done++;
    entry.points += (story.fields[storyPointsFieldKey] as number | null) ?? 0;
    countMap.set(ek, entry);
  }
  return countMap;
}

/**
 * Fetch all epics in a project and enrich them with child story counts and points.
 *
 * Two-query pattern (mirrors fetchBacklogView):
 * 1. JQL `issuetype = Epic` returns epic issues.
 * 2. JQL `"Epic Link" in (...)` batches child stories for aggregation.
 *
 * On stories fetch failure the function returns epics with zero counts (no throw).
 */
export async function fetchEpicsWithEnrichment(
  baseUrl: string,
  token: string,
  projectKey: string,
  storyPointsFieldKey = 'customfield_10016',
  epicLinkFieldKey = 'customfield_10014',
  epicNameFieldKey = 'customfield_10015',
): Promise<EpicEnriched[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Step 1: fetch epics
  const epicFields = [
    ...new Set([
      'summary',
      'status',
      'assignee',
      'priority',
      'description',
      'created',
      'updated',
      epicNameFieldKey,
    ]),
  ].join(',');
  const epicJql = encodeURIComponent(
    `project = ${projectKey} AND issuetype = Epic AND statusCategory != Done ORDER BY updated DESC`,
  );
  const epicIssues = await fetchAllSearchPages(
    `${base}/rest/api/2/search?jql=${epicJql}&fields=${epicFields}`,
    headers,
  );
  if (epicIssues.length === 0) return [];

  // Step 2: batch-fetch child stories (exclude subtasks)
  const epicKeys = epicIssues.map((e) => e.key);
  const storyFields = [
    ...new Set(['status', storyPointsFieldKey, epicLinkFieldKey, 'customfield_10016']),
  ].join(',');
  const storiesJql = encodeURIComponent(
    `"Epic Link" in (${epicKeys.join(',')}) AND issuetype != Sub-task`,
  );
  const stories = await fetchAllSearchPages(
    `${base}/rest/api/2/search?jql=${storiesJql}&fields=${storyFields}`,
    headers,
  ).catch(() => [] as JiraIssue[]);

  // Step 3: aggregate per epic
  const countMap = new Map<string, { total: number; done: number; points: number }>();
  for (const story of stories) {
    const ek = story.fields[epicLinkFieldKey] as string | null;
    if (!ek) continue;
    const entry = countMap.get(ek) ?? { total: 0, done: 0, points: 0 };
    entry.total++;
    if (story.fields.status.statusCategory?.key === 'done') entry.done++;
    entry.points += (story.fields[storyPointsFieldKey] as number | null) ?? 0;
    countMap.set(ek, entry);
  }

  return epicIssues.map((epic) => {
    const counts = countMap.get(epic.key) ?? { total: 0, done: 0, points: 0 };
    return {
      key: epic.key,
      epicName: (epic.fields[epicNameFieldKey] as string | null) ?? epic.fields.summary,
      summary: epic.fields.summary,
      status: epic.fields.status,
      assignee: epic.fields.assignee,
      totalStories: counts.total,
      doneStories: counts.done,
      totalPoints: counts.points,
    };
  });
}

/**
 * Fetch all stories linked to a given epic key, excluding subtasks.
 *
 * Used by EpicDetailSheet to display the stories list for an epic.
 * Returns empty array on fetch failure (no throw).
 */
export async function fetchEpicStories(
  baseUrl: string,
  token: string,
  epicKey: string,
  _projectKey: string,
  storyPointsFieldKey = 'customfield_10016',
): Promise<JiraIssue[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const fields = [
    ...new Set([
      'summary',
      'status',
      'assignee',
      'issuetype',
      storyPointsFieldKey,
      'customfield_10016',
    ]),
  ].join(',');
  const jql = encodeURIComponent(
    `"Epic Link" = ${epicKey} AND issuetype != Sub-task ORDER BY rank ASC`,
  );
  return fetchAllSearchPages(
    `${base}/rest/api/2/search?jql=${jql}&fields=${fields}`,
    headers,
  ).catch(() => [] as JiraIssue[]);
}
