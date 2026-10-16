---
phase: 92
slug: advanced-global-search-prioritized-ranking-current-sprint-up
status: draft
nyquist_compliant: false
wave_0_complete: false
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

| Decision | Behavior | Test Type | Automated Command | File Exists | Status |
|----------|----------|-----------|-------------------|-------------|--------|
| D-01 | Index excludes done issues; Closed tier only when included | unit | `npx vitest run src/lib/global-search.test.ts -t "closed"` | ❌ W0 | ⬜ pending |
| D-02 | Title hits with no Jira request; body request once after debounce | component | `npx vitest run src/components/app/CommandPalette.test.tsx -t "body"` | ❌ W0 | ⬜ pending |
| D-03 | Palette fetches `['gh-backlog']` cold, off /backlog route | hook | `npx vitest run src/hooks/useGlobalSearchIndex.test.tsx` | ❌ W0 | ⬜ pending |
| D-04 | desc vs comment inference | unit | `-t "field tier"` | ❌ W0 | ⬜ pending |
| D-05 | Tier order Current > next > later > Backlog > Closed | unit | `-t "tier order"` | ❌ W0 | ⬜ pending |
| D-06 | Tier headers, empty tiers omitted, "(next)" suffix | component | `-t "tier headers"` | ❌ W0 | ⬜ pending |
| D-07 | Group rank parent vs child-only; no duplicates | unit | `-t "grouping"` | ❌ W0 | ⬜ pending |
| D-08 | Typo match; exact/word-start beats scattered fuzzy | unit | `-t "fuzzy"` | ❌ W0 | ⬜ pending |
| D-09 | Panel `max-w-3xl`, list `max-h-[70vh]` | component | `-t "geometry"` | ❌ W0 | ⬜ pending |
| D-10 | Row anatomy single line | component | `-t "row"` | ❌ W0 | ⬜ pending |
| D-11 | Snippet + desc/comment tag | unit+component | `-t "snippet"` | ❌ W0 | ⬜ pending |
| D-12 | `<mark>` ranges, max 6, no innerHTML | unit | `-t "highlight"` | ❌ W0 | ⬜ pending |
| D-13 | Dimmed parent context header + indented subtasks | component | `-t "context header"` | ❌ W0 | ⬜ pending |
| D-14 | Hotkey/props contract unchanged | component | `npx vitest run src/components/app/CommandPalette.test.tsx` | ✅ (update mocks) | ⬜ pending |
| D-15 | "Include closed issues" item; no "Search Jira for" | component | `-t "include closed"` | ❌ W0 | ⬜ pending |
| D-16 | MRs/Nav/Actions only when matching | component | `-t "filters MRs"` | ❌ W0 | ⬜ pending |
| D-17 | Key/number direct match from index first | component | `-t "direct match"` | partial | ⬜ pending |
| D-18 | <2 chars → Recent + Navigation only | component | existing default-state tests | ✅ | ⬜ pending |
| JQL | `searchJiraBody` escaping, last-token wildcard, throws on !ok | unit | `npx vitest run src/services/ -t "searchJiraBody"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/global-search.test.ts` — ranking/grouping/matching (synthetic subtasks; real fixture has none)
- [ ] `src/hooks/useGlobalSearchIndex.test.tsx` — cold-cache fetch off-route
- [ ] fuzzysort v4 ESM import resolves under vitest/jsdom
- [ ] Update `CommandPalette.test.tsx` mocks (settings `epicLinkFieldKey`, auth board ids, `useBoardId`, new fetcher)
- [ ] Install `fuzzysort@^4` as direct dependency

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
