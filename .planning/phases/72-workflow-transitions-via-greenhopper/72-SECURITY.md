---
phase: 72
slug: workflow-transitions-via-greenhopper
status: secured
threats_open: 0
threats_closed: 19
asvs_level: default
created: 2026-05-29
---

# SECURITY — Phase 72 workflow-transitions-via-greenhopper

## Security Audit 2026-05-29

| Metric | Count |
|--------|-------|
| Threats found | 19 |
| Closed | 19 |
| Open | 0 |

**Closed:** 19/19
**Open:** 0
**ASVS Level:** default

Verification mode: register_authored_at_plan_time=true. Each threat in the PLAN
threat_model verified against final implementation; no new scanning.

## Threat Verification

| Threat ID | Category | Disposition | Evidence |
|-----------|----------|-------------|----------|
| T-72-01 | Spoofing | mitigate | `statuses.ts:35-44` uses `apiFetch('jira', url, { Authorization: Bearer ${token} }, 'Load Statuses')`; `transitions.ts:320-330` reads `readSecret('jira-pat')` via `useEffect`; identical pattern to `fetchProjectStatuses` |
| T-72-02 | Tampering | accept | In-memory React Query cache only — no `localStorage`/`sessionStorage`/Stronghold write paths added. Cache keys `['jira-statuses']`, `['gh-transitions-envelope', pid]`, `['gh-transitions', pid, tid]` live in `QueryClient` (`transitions.ts:193-198, 232-237, 332-357`). Risk acceptance still holds |
| T-72-03 | Repudiation | mitigate | `warnOnce.ts:24-29` emits one `console.warn` per `(kind,id)`; called from `transitions.ts:108` (workflow miss) and `transitions.ts:142` (status-id miss); shared `seenMissing` Set with `entityMaps.ts` (re-exports `__resetWarnOnce` at line 26) |
| T-72-04 | Information Disclosure | mitigate | `statuses.ts:47` throws `new ApiError('Failed to fetch Jira statuses', response.status, 'jira')` — no token in message. `transitions.ts:80` throws `ApiError('Invalid token or token has expired', response.status, 'jira')`. `apiFetch` (lib/apiFetch.ts:27) calls `auth.setJiraConnected(false)` on 401/403 |
| T-72-05 | Denial of Service | mitigate | 4 in-impl occurrences of `gcTime: Infinity` in `transitions.ts:197, 236, 339, 356` (envelope, status map, hook envelope, hook outer). Exceeds expected ≥3 |
| T-72-06 | Elevation of Privilege | accept | Synthesized fallback at `transitions.ts:149` uses `key: 'indeterminate'`. No call site reads `statusCategory.key` from GH transitions for authorization; only column bucketing in `SprintBoardTab.tsx:69` reads issue.fields.status.statusCategory.key, not transition.to.statusCategory.key. Risk acceptance holds |
| T-72-07 | Spoofing | accept | `StatusPopover.tsx:55` passes `(projectId, issueTypeId)` from issue payload; `BulkActionBar.tsx:181` and `QuickCreateInput.tsx` pass IDs sourced from server-rendered issue fields. Risk acceptance holds |
| T-72-08 | Tampering | accept | Toolbar refresh path `SprintBoardTab.tsx:768` calls `invalidateGhTransitions(queryClient, pid)`, idempotent RQ invalidation (`transitions.ts:290-298`). No mutations from refresh action |
| T-72-09 | Information Disclosure | mitigate | `fetchGhTransitions` preserves `ApiError` (`transitions.ts:72`); `useGhTransitions`/`getGhTransitions` propagate to RQ error states (no try/catch swallow in `transitions.ts:307-358` or `:211-242`); StatusPopover surfaces via `isError` (`StatusPopover.tsx:55`) |
| T-72-10 | Denial of Service | mitigate | Single project-level warm: `SprintBoardTab.tsx:731-733` registers one sentinel `useGhTransitions(sentinelProjectId, sentinelIssueTypeId)`; remaining cards use synchronous `peekGhTransitions` (`transitions.ts:259-282`). No per-issue prefetch loop. Test `SprintBoardTab.test.tsx:923-994` asserts `useGhTransitions` is called and `invalidateGhTransitions(_, 10042)` runs on refresh |
| T-72-11 | Elevation of Privilege | mitigate | Call sites match on `to.name`/`to.id`, not `statusCategory.key`: `BulkActionBar.tsx:189` (`t.to.name.toLowerCase() === targetStatus.toLowerCase()`), `QuickCreateInput.tsx:79` (`tr.to.id === statusId`), `StatusPopover.tsx:100`, `TaskCard.tsx:207-208`, `StoryHeaderRow.tsx:184-185`. Fallback `to.name='Status ${toId}'` (`transitions.ts:148`) cannot match real status names |
| T-72-12 | Repudiation | accept | Refresh handler in `SprintBoardTab.tsx:768` is read-only invalidation; apiFetch op label 'Load Statuses'/'Load Workflow Transitions' suffices. Risk acceptance holds |
| T-72-13 | Tampering | mitigate | `postTransition` grep: 1 definition in `services/jira/transitions.ts:15`; re-exported via `services/jira.ts:695`. `JiraTransition` interface: 1 canonical definition in `services/jira.ts:193` (plus a `services/jira/types.ts:76` parallel — pre-existing; `greenhopper/transitions.ts:38` imports the canonical from `../../jira`) |
| T-72-14 | Denial of Service | mitigate | Call-site grep confirms `fetchTransitions` is fully removed (T-72-15 evidence) and `postTransition` retained at 1 definition site (T-72-13). Gate executed pre-deletion per SUMMARY |
| T-72-15 | Information Disclosure | mitigate | `grep -rn fetchTransitions src/` returns ZERO matches. Legacy per-issue REST GET path removed; only `postTransition` retained (`services/jira/transitions.ts:1-48`) |
| T-72-16 | Repudiation | accept | Phase work landed via standard git commits (e.g. 11570c88, 6bc87fb7, c96dedd9, 7dd2eb25, c158995c). Risk acceptance holds |
| T-72-SC #1 | Tampering | mitigate | Phase 72-01 PLAN: no `npm install` declared; only TS source authored |
| T-72-SC #2 | Tampering | mitigate | Phase 72-02 PLAN: no `npm install` declared; cutover deletes legacy code only |
| T-72-SC #3 | Tampering | mitigate | Phase 72-03 PLAN: no `npm install` declared; refresh-action wiring only |

## Unregistered Flags

None. SUMMARY.md per-step `Threat Flags` lists were reviewed; all flags map to
threats in the register above (T-72-01..T-72-16, T-72-SC×3). No new attack
surface appeared during implementation without a registered threat ID.

## Accepted Risks Log

The following dispositions are formally accepted for Phase 72 (rationale per
PLAN threat_model):

- **T-72-02** — In-memory React Query cache only; no persistence layer added.
- **T-72-06** — UI never authorizes off `statusCategory.key`; synthesized
  `'indeterminate'` fallback poses no privilege boundary.
- **T-72-07** — `projectId` / `issueTypeId` are derived from server-issued
  issue payloads, not user input.
- **T-72-08** — Toolbar refresh is a pure RQ invalidation, idempotent.
- **T-72-12** — Existing apiFetch operation labels ('Load Statuses',
  'Load Workflow Transitions') provide sufficient audit trail for read-only
  refresh action.
- **T-72-16** — Standard git history (signed commits) sufficient for phase
  authorship attribution.

## Verification Notes

- Implementation files were NOT modified.
- All `mitigate` dispositions backed by grep evidence at file:line.
- All `accept` dispositions confirmed against post-cutover code; rationale
  still applies.
- No ESCALATE conditions encountered.
