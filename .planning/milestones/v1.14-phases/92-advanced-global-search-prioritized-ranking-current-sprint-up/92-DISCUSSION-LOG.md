# Phase 92: Advanced Global Search - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-16
**Phase:** 92-advanced-global-search-prioritized-ranking-current-sprint-up
**Areas discussed:** Index scope & Jira load, Ranking model, Result row & grouping, Existing palette pieces

---

## Index scope & Jira load

| Question | Options | Selected |
|---|---|---|
| Scope | Sprints + backlog, closed on demand / Current + upcoming only / Whole project open+closed | Sprints + backlog, closed on demand |
| Body text | Hybrid cache titles + one text~ / Prefetch bodies on open / Titles only | Other: "you decide. I want it fast but think of performance" → Claude chose Hybrid |
| Cold cache | Fetch via shared hook / Prefetch at app start / Search whatever is cached | Fetch via shared hook |
| Field tier | Infer from fetched description / Fetch comments to confirm / Lump desc+comments | Infer from fetched description |

## Ranking model

| Question | Options | Selected |
|---|---|---|
| Ordering | Sprint tier first then field / Field first then sprint / Blended score | Sprint tier first, then field |
| Headers | Per tier / Flat with sprint badge | Per tier |
| Subtask rank | Parent own match else child −1 step / Best member / Subtask-only groups last | Parent own match, else child −1 step |
| Matching | All words any order prefix / Fuzzy typo-tolerant / Exact substring | Fuzzy / typo-tolerant |

## Result row & grouping

| Question | Options | Selected |
|---|---|---|
| Dialog size | max-w-3xl ~70vh / Near full-screen / max-w-2xl 60vh | max-w-3xl, ~70vh |
| Row content | icon·key·title·epic·status·avatar / same with name text / minimal | icon·key·title·epic·status·avatar |
| Body snippet | Trailing muted snippet same line / Second line / Tag only | Trailing muted snippet |
| Parent ctx | Dimmed context header / Parent normal + all subtasks / Subtask with parent prefix | Dimmed context header |

**Notes:** "but not too large, try to compact it a bit" (on row content).

## Existing palette pieces

| Question | Options | Selected |
|---|---|---|
| Placement | Upgrade CommandPalette in place / Separate dialog + slim palette | Upgrade in place |
| Tail items | Drop Search Jira, keep 'Include closed' / Keep both | Drop Search Jira, keep Include closed |
| Other groups | Below issue tiers when matching / Nav first if strong / Remove MRs | Below issue tiers, only when matching |
| Key match | Pinned Direct match / Normal ranked hit | Pinned Direct match |

## Claude's Discretion

- Hybrid index mechanics (debounce, JQL, fields, merge), fuzzy matcher + weights, per-tier caps, keyboard/loading/empty states.

## Deferred Ideas

- None. Todo "Priority stripe: color by Jira priority-scheme rank" reviewed, not folded.
