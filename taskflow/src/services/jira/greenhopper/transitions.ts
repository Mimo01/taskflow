/**
 * GreenHopper /work/transitions.json fetcher + Phase 72 cache layer.
 *
 * Fetcher (`fetchGhTransitions`) returns the workflow→transitions map for a
 * project. Unlike services/jira/transitions.ts (REST shape), this endpoint
 * returns the entire envelope (projectAndIssueTypeToWorkflow +
 * workflowToTransitions) — consumers do their own indexing. Error envelope
 * matches services/jira/transitions.ts:19-41.
 *
 * Endpoint: GET /rest/greenhopper/1.0/xboard/work/transitions.json?projectId={projectId}
 *
 * Cache layer (Phase 72):
 *   - `useGhTransitions(projectId, issueTypeId)` — React Query hook returning
 *     adapted `JiraTransition[]`. Two-layer cache:
 *       * `['gh-transitions-envelope', projectId]` — raw envelope, shared
 *         across all issue types in the same project (project-level dedupe).
 *       * `['gh-transitions', projectId, issueTypeId]` — pre-adapted
 *         JiraTransition[] for a single (project, type) pair.
 *   - `getGhTransitions(...)` — imperative twin for non-component call sites.
 *   - `invalidateGhTransitions(qc, projectId?)` — invalidates one project or
 *     all projects across both layers.
 *   - `ensureStatusMap(qc, baseUrl, token)` — session-cached Map keyed by
 *     status id, sourced from `fetchAllJiraStatuses` under `['jira-statuses']`.
 *
 * See Phase 72 CONTEXT.md D-01..D-06 and RESEARCH §Code Examples 1-5.
 */

import {
  type QueryClient,
  type UseQueryResult,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { ApiError } from '../../../lib/api-error';
import { useAuthStore } from '../../../stores/auth.store';
import type { JiraTransition } from '../../jira';
import { readSecret } from '../../stronghold';
import { fetchAllJiraStatuses, type JiraStatus } from '../statuses';
import { greenhopperFetch } from './client';
import type { GhTransition, GhTransitionsResponse } from './types';
import { warnOnce } from './warnOnce';

/**
 * Fetch the GreenHopper workflow→transitions map for a project.
 *
 * NOTE: returns the whole envelope (no `.transitions` unwrap), unlike the REST-shape
 * jira/transitions.ts. See 71-PATTERNS.md "transitions.ts" deviation note.
 *
 * @param baseUrl   - Jira base URL
 * @param token     - Bearer PAT
 * @param projectId - Numeric Jira project id
 */
export async function fetchGhTransitions(
  baseUrl: string,
  token: string,
  projectId: number,
): Promise<GhTransitionsResponse> {
  let response: Response;
  try {
    response = await greenhopperFetch(
      baseUrl,
      token,
      `/work/transitions.json?projectId=${projectId}`,
      'Load Workflow Transitions',
    );
  } catch (err) {
    // WR-02: preserve ApiError (auth failures bubble through to
    // setJiraConnected(false) per D-04); only collapse network-class errors
    // to the "Cannot reach" envelope.
    if (err instanceof ApiError) throw err;
    const wrapped = new Error(`Cannot reach ${baseUrl} — check the base URL`);
    (wrapped as Error & { cause?: unknown }).cause = err;
    throw wrapped;
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Invalid token or token has expired', response.status, 'jira');
    }
    throw new Error(`GreenHopper transitions request failed with status ${response.status}`);
  }

  return (await response.json()) as GhTransitionsResponse;
}

// ---------------------------------------------------------------------------
// Phase 72 cache layer
// ---------------------------------------------------------------------------

type StatusEntry = { name: string; statusCategory: { id: number; key: string; name: string } };

/**
 * Private: look up the workflow for `(projectId, issueTypeId)` in the envelope
 * and return the GhTransition[] for that workflow. On miss (no workflow
 * mapping) returns `[]` and warns once per unique (pid, tid).
 *
 * Exported for tests only — not part of any public surface.
 */
export function __indexTransitions(
  envelope: GhTransitionsResponse,
  projectId: number,
  issueTypeId: string,
): GhTransition[] {
  const workflowName = envelope.projectAndIssueTypeToWorkflow[String(projectId)]?.[issueTypeId];
  if (!workflowName) {
    warnOnce('gh-transitions-workflow', `${projectId}:${issueTypeId}`);
    return [];
  }
  return envelope.workflowToTransitions[workflowName] ?? [];
}

/**
 * Private: adapt a single GhTransition to the legacy `JiraTransition` shape
 * the four call sites already read (`src/services/jira.ts:183-191`).
 *
 * On status-id miss (id not present in the global Jira status list) emits a
 * `gh-transitions-status` warn-once and synthesizes a deterministic fallback
 * `{ name: 'Status N', statusCategory: { id: 0, key: 'indeterminate', name: 'Unknown' } }`
 * per CONTEXT.md D-06b.
 *
 * Exported for tests only.
 */
export function __adaptToJiraTransition(
  gh: GhTransition,
  statusMap: Map<string, StatusEntry>,
): JiraTransition {
  const toId = String(gh.toStatusId);
  const status = statusMap.get(toId);
  if (!status) {
    warnOnce('gh-transitions-status', toId);
    return {
      id: String(gh.transitionId),
      name: gh.name,
      to: {
        id: toId,
        name: `Status ${toId}`,
        statusCategory: { id: 0, key: 'indeterminate', name: 'Unknown' },
      },
    };
  }
  return {
    id: String(gh.transitionId),
    name: gh.name,
    to: { id: toId, name: status.name, statusCategory: status.statusCategory },
  };
}

/**
 * Private: ensure the global Jira status list is cached under
 * `['jira-statuses']` and return it as a `Map<statusId, StatusEntry>`.
 *
 * Cache config: `staleTime: Infinity`, `gcTime: Infinity` — session-scoped per
 * CONTEXT.md D-06.
 *
 * Exported for tests only.
 */
export async function __ensureStatusMap(
  queryClient: QueryClient,
  baseUrl: string,
  token: string,
): Promise<Map<string, StatusEntry>> {
  const statuses = await queryClient.ensureQueryData<JiraStatus[]>({
    queryKey: ['jira-statuses'],
    queryFn: () => fetchAllJiraStatuses(baseUrl, token),
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const map = new Map<string, StatusEntry>();
  for (const s of statuses) {
    map.set(s.id, { name: s.name, statusCategory: s.statusCategory });
  }
  return map;
}

/**
 * Imperative twin of `useGhTransitions` for non-component call sites
 * (BulkActionBar, post-create flows). Hits the same project-level envelope
 * cache and the same status map.
 */
export async function getGhTransitions(
  queryClient: QueryClient,
  baseUrl: string,
  token: string,
  projectId: number,
  issueTypeId: string,
): Promise<JiraTransition[]> {
  const envelope = await queryClient.ensureQueryData<GhTransitionsResponse>({
    queryKey: ['gh-transitions-envelope', projectId],
    queryFn: () => fetchGhTransitions(baseUrl, token, projectId),
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const statusMap = await __ensureStatusMap(queryClient, baseUrl, token);
  return __indexTransitions(envelope, projectId, issueTypeId).map((t) =>
    __adaptToJiraTransition(t, statusMap),
  );
}

/**
 * Invalidate the workflow-transitions cache for one project or every project.
 *
 * Hits both layers: the raw envelope (`['gh-transitions-envelope', ...]`) and
 * the per-type adapted entries (`['gh-transitions', ...]`).
 */
export function invalidateGhTransitions(queryClient: QueryClient, projectId?: number): void {
  if (projectId === undefined) {
    queryClient.invalidateQueries({ queryKey: ['gh-transitions-envelope'] });
    queryClient.invalidateQueries({ queryKey: ['gh-transitions'] });
  } else {
    queryClient.invalidateQueries({ queryKey: ['gh-transitions-envelope', projectId] });
    queryClient.invalidateQueries({ queryKey: ['gh-transitions', projectId] });
  }
}

/**
 * React hook returning the adapted `JiraTransition[]` for `(projectId, issueTypeId)`.
 *
 * Two-layer cache (envelope + per-type) means multiple consumers of the same
 * project but different issue types trigger exactly one underlying
 * `fetchGhTransitions` call per project per session.
 */
export function useGhTransitions(
  projectId: number,
  issueTypeId: string,
): UseQueryResult<JiraTransition[]> {
  const queryClient = useQueryClient();
  const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    readSecret('jira-pat')
      .then((t) => {
        if (!cancelled) setToken(t);
      })
      .catch(() => {
        if (!cancelled) setToken(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return useQuery<JiraTransition[]>({
    queryKey: ['gh-transitions', projectId, issueTypeId],
    queryFn: async () => {
      const envelope = await queryClient.ensureQueryData<GhTransitionsResponse>({
        queryKey: ['gh-transitions-envelope', projectId],
        queryFn: () => fetchGhTransitions(jiraBaseUrl as string, token as string, projectId),
        staleTime: Infinity,
        gcTime: Infinity,
      });
      const statusMap = await __ensureStatusMap(
        queryClient,
        jiraBaseUrl as string,
        token as string,
      );
      return __indexTransitions(envelope, projectId, issueTypeId).map((t) =>
        __adaptToJiraTransition(t, statusMap),
      );
    },
    enabled: !!jiraBaseUrl && !!token && Number.isFinite(projectId) && !!issueTypeId,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
