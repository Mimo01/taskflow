---
phase: 92
slug: advanced-global-search-prioritized-ranking-current-sprint-up
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-16
---

# Phase 92 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 + jsdom + @testing-library/react ^16 + user-event ^14 |
| **Config file** | `taskflow/vitest.config.ts` (setup `src/test/setup.ts`) |
| **Quick run command** | `cd taskflow && npx vitest run src/lib/global-search.test.ts src/components/app/CommandPalette.test.tsx` |
| **Full suite command** | `cd taskflow && npm test` (pre-commit also runs biome + tsc) |
| **Estimated runtime** | ~60 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run quick run command (pre-commit runs full suite anyway)
- **After every plan wave:** `npm test` + `npx biome check` on touched files + `npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

Decision → test mapping (task IDs filled in by planner):

| Decision | Task ID | Behavior | Test Type | Automated Command | File Exists | Status |
|----------|---------|----------|-----------|-------------------|-------------|--------|
| D-01 | 92-04-T1/T2 | Index excludes done issues; Closed tier only when included | unit | `npx vitest run src/lib/global-search.test.ts -t "closed"` | ✅ | ✅ green |
| D-02 | 92-02-T1, 92-05-T1 | Title hits with no Jira request; body request once after debounce | component | `npx vitest run src/components/app/CommandPalette.test.tsx -t "body"` | ✅ | ✅ green |
| D-03 | 92-02-T2, 92-05-T1 | Palette fetches `['gh-backlog']` cold, off /backlog route | hook | `npx vitest run src/hooks/useGlobalSearchSources.test.tsx` | ✅ | ✅ green |
| D-04 | 92-01-T2, 92-04-T2 | desc vs comment inference | unit | `-t "field tier"` | ✅ | ✅ green |
| D-05 | 92-04-T1/T2 | Tier order Current > next > later > Backlog > Closed | unit | `-t "tier order"` | ✅ | ✅ green |
| D-06 | 92-04-T1, 92-05-T1 | Tier headers, empty tiers omitted, "(next)" suffix | component | `-t "tier headers"` | ✅ | ✅ green |
| D-07 | 92-04-T2 | Group rank parent vs child-only; no duplicates | unit | `-t "grouping"` | ✅ | ✅ green |
| D-08 | 92-01-T2, 92-04-T2 | Typo match; exact/word-start beats scattered fuzzy | unit | `-t "fuzzy"` | ✅ | ✅ green |
| D-09 | 92-05-T1 | Panel `max-w-3xl`, list `max-h-[70vh]` | component | `-t "geometry"` | ✅ | ✅ green |
| D-10 | 92-03-T2 | Row anatomy single line | component | `-t "row"` | ✅ | ✅ green |
| D-11 | 92-01-T2, 92-03-T2, 92-04-T2 | Snippet + desc/comment tag | unit+component | `-t "snippet"` | ✅ | ✅ green |
| D-12 | 92-01-T2, 92-03-T1 | `<mark>` ranges, max 6, no innerHTML | unit | `-t "highlight"` | ✅ | ✅ green |
| D-13 | 92-03-T2, 92-04-T2 | Dimmed parent context header + indented subtasks | component | `-t "context header"` | ✅ | ✅ green |
| D-14 | 92-05-T1/T2 | Hotkey/props contract unchanged | component | `npx vitest run src/components/app/CommandPalette.test.tsx` | ✅ | ✅ green |
| D-15 | 92-05-T1/T2 | "Include closed issues" item; no "Search Jira for" | component | `-t "include closed"` | ✅ | ✅ green |
| D-16 | 92-05-T1/T2 | MRs/Nav/Actions only when matching | component | `-t "filters MRs"` | ✅ | ✅ green |
| D-17 | 92-05-T1/T2 | Key/number direct match from index first | component | `-t "direct match"` | ✅ | ✅ green |
| D-18 | 92-05-T1/T2 | <2 chars → Recent + Navigation only | component | existing default-state tests | ✅ | ✅ green |
| JQL | 92-02-T1 | `searchJiraBody` escaping, last-token wildcard, throws on !ok | unit | `npx vitest run src/services/ -t "searchJiraBody"` | ✅ | ✅ green |
| D-19 | 92-02-T2, 92-04-T1 | Phase 92 ranking/source behaviour | unit | `npx vitest run src/lib/global-search.test.ts src/hooks/useGlobalSearchSources.test.tsx` | ✅ | ✅ green |
| D-20 | 92-04-T1/T2 | Done active-sprint issues stay in Current sprint | unit | `npx vitest run src/lib/global-search.test.ts` | ✅ | ✅ green |
| D-21 | 92-02-T2 | Source hook behaviour | hook | `npx vitest run src/hooks/useGlobalSearchSources.test.tsx` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/lib/global-search.test.ts` — ranking/grouping/matching (synthetic subtasks; real fixture has none)
- [x] `src/hooks/useGlobalSearchIndex.test.tsx` — cold-cache fetch off-route
- [x] fuzzysort v4 ESM import resolves under vitest/jsdom
- [x] Update `CommandPalette.test.tsx` mocks (settings `epicLinkFieldKey`, auth board ids, `useBoardId`, new fetcher)
- [x] Install `fuzzysort@^4` as direct dependency

---

## Manual-Only Verifications

| Behavior | Decision | Why Manual | Test Instructions |
|----------|----------|------------|-------------------|
| Live Jira `text ~` wildcard/AND semantics | D-02/D-04 | Requires live Jira | Search a known description phrase and a prefix; confirm body hits appear |
| Subtask sprint membership | D-05/D-13 | Live data shape | Search a subtask title in current sprint; confirm it groups under parent in Current sprint tier |
| One-line rows at 560px / 768px in Tauri WebKit | D-10 | Visual | Open palette at both widths; no wrapped rows |
| Dimmed context-row contrast | D-13 | Visual | Check light + dark theme |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** automated gates green; live UAT pending (92-06 Task 2)
