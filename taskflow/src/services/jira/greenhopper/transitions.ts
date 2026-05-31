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
  // `isGlobal` transitions apply from any status; non-global ones carry a
  // fromStatusId that `filterTransitionsForStatus` matches against the issue's
  // current status to surface only valid moves.
  // WR-06: use `== null` to cover both `undefined` and `null` (some Jira DC
  // versions emit `fromStatusId: null` for global-ish transitions; the
  // strict `=== undefined` check would let `null` slip through and produce
  // the string "null" via String(null), causing the transition to be
  // silently hidden from every status by filterTransitionsForStatus).
  const fromRaw = gh.fromStatusId;
  const fromStatusId = gh.isGlobal || fromRaw == null ? undefined : String(fromRaw);
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
      fromStatusId,
    };
  }
  return {
    id: String(gh.transitionId),
    name: gh.name,
    to: { id: toId, name: status.name, statusCategory: status.statusCategory },
    fromStatusId,
  };
}

/**
 * Narrow a workflow's full transition list to those available from a specific
 * status. Global transitions (no `fromStatusId`) always pass through.
 *
 * The GreenHopper `transitions.json` envelope returns every transition in a
 * workflow regardless of source status — unlike the legacy per-issue REST
 * `/transitions` endpoint which server-filters. Callers MUST apply this filter
 * before surfacing transitions to the user.
 */
export function filterTransitionsForStatus(
  transitions: JiraTransition[],
  currentStatusId: string | undefined,
): JiraTransition[] {
  if (!currentStatusId) return transitions.filter((t) => !t.fromStatusId);
  return transitions.filter((t) => !t.fromStatusId || t.fromStatusId === currentStatusId);
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
  // WR-03: refuse to fetch with a missing/zero project id. Caller fed us a
  // default placeholder (typically `Number(undefined ?? 0)` from an issue
  // whose `fields.project` was not in the search payload). Throw a typed
  // error so callers can surface "missing project context" instead of
  // silently rendering an empty popover.
  if (!Number.isFinite(projectId) || projectId <= 0) {
    throw new Error(
      `Missing project context for GH transitions (projectId=${projectId}). ` +
        `Ensure 'project' is in the issue search fields list.`,
    );
  }
  if (!issueTypeId) {
    throw new Error('Missing issuetype context for GH transitions (empty issueTypeId).');
  }
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
 * Synchronous peek for `(projectId, issueTypeId)` transitions.
 *
 * Both layers (`['gh-transitions-envelope', projectId]` and `['jira-statuses']`)
 * are populated once per project by the first `useGhTransitions` or
 * `getGhTransitions` call; thereafter any `(projectId, issueTypeId)` pair can
 * be resolved synchronously from cache without registering a per-type query.
 *
 * Returns `undefined` when either layer is missing (envelope not fetched yet,
 * or status list not loaded). Returns `[]` on workflow miss (warn-once).
 *
 * Use this from render paths that need transitions for many issuetypes (e.g.
 * sprint-board cards mixing stories + subtasks) where calling `useGhTransitions`
 * per type is impossible (hooks in loops).
 */
export function peekGhTransitions(
  queryClient: QueryClient,
  projectId: number,
  issueTypeId: string,
): JiraTransition[] | undefined {
  // WR-03: missing project context — treat as "not loaded yet" so the
  // render path falls back to its loading affordance instead of an empty
  // popover. (Mirrors the throw in getGhTransitions but non-fatal because
  // peek is called during render.)
  if (!Number.isFinite(projectId) || projectId <= 0 || !issueTypeId) return undefined;
  const envelope = queryClient.getQueryData<GhTransitionsResponse>([
    'gh-transitions-envelope',
    projectId,
  ]);
  const statuses = queryClient.getQueryData<JiraStatus[]>(['jira-statuses']);
  if (!envelope || !statuses) return undefined;
  const statusMap = new Map<string, StatusEntry>();
  for (const s of statuses) {
    statusMap.set(s.id, { name: s.name, statusCategory: s.statusCategory });
  }
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: jiraBaseUrl is an intentional re-run trigger (WR-05) — the effect re-reads the secret on instance switch even though the body doesn't reference it.
  useEffect(() => {
    // WR-05: re-read the secret whenever the Jira instance changes (login
    // rotation, instance switch). An empty dep array left the hook with a
    // stale token across re-auth cycles.
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
  }, [jiraBaseUrl]);

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
    // WR-03: require a real (>0) projectId. Passing 0 (the
    // `Number(undefined ?? 0)` placeholder for issues missing
    // `fields.project`) would otherwise issue a request for project 0 and
    // warn-once on workflow miss while silently returning [].
    enabled: !!jiraBaseUrl && !!token && projectId > 0 && !!issueTypeId,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
