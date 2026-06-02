# Phase 76: Visual Polish and Shared Primitives - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver app-wide visual consistency for done-state items and add priority color stripes to sprint board cards, landing shared display utilities and a rank-calc primitive that downstream phases (Backlog Drag-to-Rank) will consume.

**In scope:**
- Done-state line-through treatment on the Backlog active-sprint list, Standup Notes "Today" section, and any Dashboard per-story list (VISUAL-01/02/03)
- Left-edge priority color stripe on sprint board cards, WCAG ≥ 3:1 in both themes (VISUAL-04/05)
- `lib/issueDisplayUtils.ts` exporting `isDoneStatus`, `doneSummaryClass`, `priorityStripeClass`
- `services/jira/rank.ts` exporting `rankIssue` (pure, tested)
- Settings store bump (v24 → v25) adding persisted `rankFieldKey`

**Out of scope (future phases):**
- Drag-to-rank UI, reorder interactions, and the Jira rank-API write call
- Adding new rows/sections to Standup "Today" (no "Done" subsection)
- Heavy dimming/opacity treatments on done rows
</domain>

<decisions>
## Implementation Decisions

### Priority Color Stripe (VISUAL-04/05)
- **D-01:** Palette = **red→gray severity ramp**. Intent: Highest=red, High=orange, Medium=yellow, Low=gray, Lowest=lighter gray. Only urgent priorities are saturated; low/lowest fade out.
- **D-02:** Exact Tailwind shades are tuned **per-theme to meet WCAG ≥ 3:1 against `bg-card`** — the ramp *intent* is locked, not the literal tokens. Note: `gray-300` on near-white `bg-card` (light mode) will not clear 3:1, so light/dark variants must diverge (likely darken grays in light mode, lighten in dark). Stripe is a non-text graphical object → 3:1 is the correct threshold.
- **D-03:** Cards with **no priority / unmapped priority** render a **neutral gray stripe** (not absent, not transparent) so every card keeps consistent left-edge geometry; gray = unset.
- **D-04:** Stripe lives on the existing `TaskCard` outer button (`taskflow/src/routes/dashboard/TaskCard.tsx`), which already uses a `border-l-2 border-l-muted` idiom for subtasks — the priority stripe layers onto/extends that left-edge mechanism.

### Done-State Treatment (VISUAL-01/02/03)
- **D-05:** **Truly key-only** strike. Apply `line-through` to the **issue key** element only (monospace), leaving the summary text normal — identical to kanban `TaskCard`'s existing treatment. No opacity/dimming.
- **D-06:** `doneSummaryClass` keeps its roadmap-mandated name but returns the `line-through` class applied to the **issue key** element on list rows (NOT the summary). ⚠️ Verifier note: success criteria say "stories appear struck-through" — the user explicitly chose key-only for kanban consistency over a stronger list signal. Verify against THIS decision, not a literal "summary struck-through" reading.
- **D-07:** `isDoneStatus` = `statusCategory?.key === 'done'` — exactly mirrors the kanban check. Single source of truth; handles custom done-statuses automatically.

### Standup "Today" Done Items (VISUAL-02)
- **D-08:** **Style-only, no new rows.** Do NOT add a "Done" subsection or change which items render. The key-strike applies only IF a done item already surfaces in a rendered Today section (e.g. it transitioned mid-day and remains in In-Progress/Up-Next). VISUAL-02 is treated as styling-readiness, not a new section. (Avoids scope creep — a new Done section would be its own feature.)

### Rank Primitive (shared scaffolding)
- **D-09:** `rankIssue` = **pure client-side LexoRank-style midpoint calculator** computing a rank value between two neighbors. Fully unit-tested. **No Jira API calls, no UI wiring** — those belong to the drag-to-rank phase. A real, tested primitive, not a stub.
- **D-10:** `rankFieldKey` persisted in settings (default `null`, added via **v25** migration — store is already at v24, so roadmap's "bump to persist v24" is actually v25).
- **D-11:** `rankFieldKey` is **populated when discovered** from the GreenHopper backlog response's `rankCustomFieldId`, composed as `customfield_${rankCustomFieldId}`. Probe-verified: `data.real.json` carries `rankCustomFieldId: 10105` → `customfield_10105`. The rank field id comes from the **backlog response**, not per-issue fields (issues in the probe only inline `customfield_10106`/`10103`).

### Claude's Discretion
- Rank-primitive scope (D-09/10/11) was explicitly delegated to Claude by the user; decided as pure-calc + persisted-key with discovery-time population.
- Exact stripe render mechanism (extended `border-l`, pseudo-element, or inline element) left to planner/executor — constraint is WCAG ≥ 3:1 + visual consistency with the subtask `border-l` idiom.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/ROADMAP.md` § Phase 76 — goal, success criteria, exact export contract
- `.planning/REQUIREMENTS.md` — VISUAL-01 … VISUAL-05 definitions

### Existing patterns to mirror
- `taskflow/src/routes/dashboard/TaskCard.tsx` (~lines 90–204) — kanban card; done key-strike at ~114 (`statusCategory?.key === 'done'` → `line-through`); subtask `border-l-2 border-l-muted` idiom (the stripe anchor)
- `taskflow/src/lib/statusStyles.ts` — established status-styling util conventions (`dark:` prefix, tone classes)
- `taskflow/src/lib/epicColors.ts` — established Jira-color → Tailwind mapping pattern (closest analog for `priorityStripeClass`)
- `taskflow/src/lib/utils.ts` — `cn()` className merge helper

### Targets to modify
- `taskflow/src/routes/dashboard/BacklogPage.tsx` + `BacklogRow.tsx` — active-sprint list rows (VISUAL-01)
- `taskflow/src/routes/standup-notes/TodayColumn.tsx` (+ `TodayInProgressSection`/`TodayUpNextSection`) — Today section (VISUAL-02)
- `taskflow/src/stores/settings.store.ts` (~line 340 version, ~341–442 migrate) — v25 + `rankFieldKey`

### Rank field source (probe-verified)
- `taskflow/src/services/jira/greenhopper/__fixtures__/data.real.json` — `rankCustomFieldId: 10105`
- `taskflow/src/services/jira/greenhopper/types.ts` (~line 199) — `rankCustomFieldId` on `GhBacklogResponse`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TaskCard.tsx` done-strike logic (`statusCategory?.key === 'done'` → `line-through`): the canonical behavior `isDoneStatus`/`doneSummaryClass` must centralize and reuse.
- `TaskCard.tsx` `border-l-2 border-l-muted` (subtask marker): the left-edge mechanism the priority stripe extends.
- `epicColors.ts` / `statusStyles.ts`: pattern templates for `priorityStripeClass` (Jira-value → theme-aware Tailwind class with `dark:` variants).
- Settings store versioned `migrate()` chain (v1→v24): append `rankFieldKey` as v25 following the existing per-version backfill pattern.

### Established Patterns
- Theme handling: raw Tailwind in light, `dark:` prefix with opacity tweaks in dark. Stripe colors must follow this and additionally satisfy WCAG ≥ 3:1 vs `bg-card`.
- "Done" = `statusCategory.key === 'done'` everywhere (not status-name matching).
- No client-side LexoRank exists yet; `rank` is read-only via JQL `ORDER BY rank ASC`. `rankIssue` introduces the first client-side rank computation.

### Integration Points
- New `lib/issueDisplayUtils.ts` consumed by TaskCard (refactor to use shared util), BacklogRow, TodayColumn sections.
- `rankFieldKey` written from wherever the GreenHopper backlog response is parsed; read by future drag-to-rank phase only.

</code_context>

<specifics>
## Specific Ideas

- Done strike must look **identical** to the current kanban board (key-only line-through) — consistency with the existing board was the explicit priority over a stronger list-row signal.
- Priority ramp: saturated reds/oranges for urgent, deliberately faded grays for Low/Lowest — the visual hierarchy should make high-priority cards "pop" and low-priority cards recede.

</specifics>

<deferred>
## Deferred Ideas

- **Standup "Done / Completed today" subsection** — surfacing done current-sprint items as their own list in the Today column. Considered and deferred (would be a new capability, not visual polish). Future phase if desired.
- **Drag-to-rank UI + Jira rank-API persistence** — consumes `rankIssue` + `rankFieldKey` from this phase. Already roadmapped as the Backlog Drag-to-Rank phase.

</deferred>

---

*Phase: 76-Visual Polish and Shared Primitives*
*Context gathered: 2026-06-03*
