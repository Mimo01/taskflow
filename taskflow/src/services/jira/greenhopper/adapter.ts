/**
 * GreenHopper → JiraIssue adapter (Phase 71-05).
 *
 * Pure transformer: takes a GhIssue or GhBoardIssue plus the EntityMaps built by
 * `buildEntityMaps()` plus the project's story-points custom-field key, and
 * returns a value assignable to the legacy `JiraIssue` shape
 * (services/jira.ts:139) PLUS four GH-only top-level props (timeInColumn?,
 * color, flagged, done) — see Phase 71 D-01.
 *
 * Locked behavior:
 *   D-01: Return shape is a JiraIssue superset — drop-in for the ~60 existing
 *         consumers of jira.ts, with GH-only fields available natively.
 *   D-02: `customfield_10016` is synthesized only when
 *         gh.estimateStatistic.statFieldId === storyPointsFieldKey AND a
 *         numeric value is present; otherwise null. The caller is responsible
 *         for resolving `storyPointsFieldKey` via the existing custom-field
 *         discovery helper in services/jira.ts and threading it in — adapter
 *         is pure (D-09).
 *   D-03: When `gh.done === true` AND the resolved statusCategory.key !== 'done',
 *         the adapter forces statusCategory.key = 'done' (the GH done flag is
 *         the source of truth — see RESEARCH ambiguity #2).
 *
 * No I/O, no async, no custom-field discovery call from inside `adaptIssue`
 * (keeps the function synchronous + pure — Phase 71 D-09).
 *
 * Field-by-field mapping lifted from
 * .planning/phases/71-greenhopper-adapter-foundation/71-RESEARCH.md
 * §"Adapter Mapping Table".
 */

import {
  resolveEpic,
  resolveParent,
  resolvePriority,
  resolveStatus,
  resolveType,
} from './entityMaps';
import type { EntityMaps, GhBoardIssue, GhIssue } from './types';
// JiraIssue lives in the legacy dual-file services/jira.ts:139 (memory:
// project_jira_ts_dual_file.md + Phase 71 D-05). DO NOT import from '../../jira/index'.
import type { JiraIssue } from '../../jira';

/**
 * Return shape: the legacy JiraIssue plus the four GH-only top-level props (D-01).
 * timeInColumn is only present on GhBoardIssue (allData), not GhIssue (data/backlog).
 */
export type AdaptedIssue = JiraIssue & {
  timeInColumn?: GhBoardIssue['timeInColumn'];
  color: string;
  flagged: boolean;
  done: boolean;
};

type StatusCategoryKey = 'new' | 'indeterminate' | 'done';

/**
 * Transform a GreenHopper issue into a JiraIssue-superset for downstream consumers.
 *
 * @param gh                   the raw GH issue row from allData.issuesData.issues
 *                             or data.json's issues[]
 * @param entityMaps           the four-map aggregate from `buildEntityMaps`
 * @param storyPointsFieldKey  the project's story-points custom-field id
 *                             (resolved upstream by the caller)
 */
export function adaptIssue(
  gh: GhIssue | GhBoardIssue,
  entityMaps: EntityMaps,
  storyPointsFieldKey: string,
): AdaptedIssue {
  // RESEARCH Mapping Table row "status": resolve via entityMaps.statuses[gh.statusId]
  const status = resolveStatus(gh.statusId, entityMaps);

  // D-03 override: gh.done is authoritative — if it says "done" but the resolved
  // statusCategory disagrees, force 'done' on the output.
  const categoryKey: StatusCategoryKey =
    gh.done && status.statusCategory.key !== 'done' ? 'done' : status.statusCategory.key;

  // D-02 gate: only synthesize `customfield_10016` when the GH estimateStatistic
  // is reporting the project's story-points field. Otherwise the legacy `null`
  // sentinel is preserved (matches JiraIssue.fields.customfield_10016: number | null).
  // Defensive guard: real-capture fixture shows 103/156 issues with `estimateStatistic`
  // absent — type declares it required but the API can omit it (Rule 1 — bug-fix).
  const estimate = gh.estimateStatistic as GhIssue['estimateStatistic'] | undefined;
  const storyPoints: number | null =
    estimate?.statFieldId === storyPointsFieldKey
      ? (estimate.statFieldValue.value ?? null)
      : null;

  // Resolve issuetype display name; subtask flag is derived from parentId presence
  // per Phase 71 D-11 + RESEARCH ambiguity #1. NOTE: legacy `JiraIssue.fields.issuetype`
  // shape in src/services/jira.ts:151-154 is `{ name, subtask }` ONLY — adding `id`
  // would fail tsc excess-property checks (PATTERNS §adapter.ts).
  const issuetype = resolveType(gh.typeId, entityMaps);
  const adaptedIssuetype: JiraIssue['fields']['issuetype'] = {
    name: issuetype.name,
    subtask: gh.parentId !== undefined,
  };

  // Assignee — GH carries a single avatar URL; project legacy shape uses { '48x48' }.
  const assignee: JiraIssue['fields']['assignee'] = gh.assignee
    ? {
        displayName: gh.assigneeName ?? gh.assignee,
        avatarUrls: { '48x48': gh.avatarUrl ?? '' },
      }
    : null;

  // Parent — GH child rows omit the parent summary; consumers do not render it
  // for board/backlog cards. Phase 75 details adapter can hydrate via details.json.
  const parent: JiraIssue['fields']['parent'] | undefined =
    gh.parentId !== undefined
      ? {
          id: String(gh.parentId),
          key: gh.parentKey ?? '',
          fields: { summary: '' },
        }
      : undefined;

  // Side-effect-free use of the optional resolvers — they're called for parity
  // with the resolver surface (no top-level `epic`/`priority` synthesis on
  // fields per RESEARCH ambiguity #3 + D-01 superset list — these helpers are
  // surface-exercised by entityMaps tests; we keep this single touch so static
  // analysers and tree-shakers see the imports as live for the future Phase 73
  // wiring).
  void resolveEpic(gh.epicId, entityMaps);
  void resolvePriority(gh.priorityId, entityMaps);
  void resolveParent(gh.parentId, gh.parentKey);

  const fields: JiraIssue['fields'] = {
    summary: gh.summary,
    status: {
      id: gh.statusId,
      name: status.name,
      statusCategory: { key: categoryKey },
    },
    assignee,
    issuetype: adaptedIssuetype,
    customfield_10016: storyPoints,
    ...(parent !== undefined ? { parent } : {}),
  };

  return {
    id: String(gh.id),
    key: gh.key,
    fields,
    // GH-only top-level props per D-01
    timeInColumn: 'timeInColumn' in gh ? gh.timeInColumn : undefined,
    color: gh.color,
    flagged: gh.flagged ?? false,
    done: gh.done,
  };
}

/**
 * Ergonomic factory for Phase 73/74 callers: bind storyPointsFieldKey + entityMaps
 * once at view-open and adapt per-issue without re-threading args (RESEARCH Open
 * Question 1).
 */
export function createAdapter(opts: {
  storyPointsFieldKey: string;
  entityMaps: EntityMaps;
}): (gh: GhIssue | GhBoardIssue) => AdaptedIssue {
  return (gh) => adaptIssue(gh, opts.entityMaps, opts.storyPointsFieldKey);
}
