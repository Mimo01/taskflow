# My Tasks — Target Design Spec (from approved mockup)

This is the pixel-level contract for the My Tasks page redesign. The developer supplied a
high-fidelity mockup; this document transcribes it. Match it faithfully. Reuse existing
components (`PriorityIcon`, `IssueTypeIcon`, `statusPillClass`, `CachedAvatar`, `Progress`,
`Badge`, `formatDuration`) and the standup notes patterns. Degrade gracefully where data is
unavailable; never crash.

## Overall layout (top → bottom)

1. **Page header row**
   - Left: large bold title `My Tasks` (~text-3xl/4xl, font-bold).
     - Directly under the title, a muted **context subtitle** line with a small calendar icon:
       `Sprint 182 · Operations · 14 open · 3 done · 34 points in flight`
       - Derive from the active scope's data: project name (from `fields.project.name`),
         counts (`open` = non-done issues, `done` = done issues), `points in flight`
         = sum of story points of non-done PARENT issues (filter `!subtask`).
       - Sprint name/number is NOT in fetched fields — if not readily available, omit the
         `Sprint NNN` segment and start with the project name. Do not block on it.
       - For All Assigned / All Reported scopes (no single sprint), adapt:
         `All Assigned · 14 open · 3 done · 34 points in flight` (no project/sprint prefix).
   - Right: a horizontal toolbar, vertically centered with the title:
     - **Scope segmented control** (pill group, the three existing scopes):
       `[ Current Sprint | All Assigned | All Reported ]` — active segment has a solid dark
       (`bg-foreground text-background`) fill; inactive are plain. This REPLACES the old
       scope toggle. Wire to `setScope` exactly as today (`current-sprint` / `all-assigned`
       / `all-reported`).
     - `[ States ▾ ]` button, `[ 📄 Spec ]` button, `[ + New issue ]` (solid dark button).
       - `+ New issue`: wire to the existing create-issue flow if exposed via outlet context
         (`openCreateStory`); otherwise render the button but no-op with a `title`.
       - `States ▾` and `Spec`: render to match the visual, but these have no defined
         behavior yet — render as buttons that are visually present; do NOT invent backend.
         (Flagged to the developer as needing definition.)

2. **Stat tiles row — THREE big summary tiles** (replaces the 6 filter pills/tiles)
   - Three equal-width tiles spanning the content width with gaps:
     `6  To Do`  ·  `5  In Progress`  ·  `3  Done`
   - Each tile: a rounded bordered card (`rounded-xl border bg-card`, generous padding ~p-4),
     containing on one row:
     - a LARGE bold count on the left (`text-3xl font-bold tabular-nums`),
     - the label immediately to its right (`text-sm text-muted-foreground`, vertically centered),
     - a category icon on the FAR RIGHT of the tile (muted): To Do → list icon (`ListTodo`/`List`),
       In Progress → git-branch icon (`GitBranch`), Done → green check (`Check`, green).
   - NO bottom accent bar, NO left stripe on the tiles.
   - The three buckets map to status category: To Do = `new`, In Progress = `indeterminate`,
     Done = `done`. Counts are over the active scope's PARENT issues.
   - Clicking a tile toggles a single-select filter on that bucket (one active at a time, click
     again clears) — this is the page's transient filter (never persisted). Active tile shows a
     clear selected state (`ring-1 ring-inset ring-primary` + subtle bg). This supersedes the old
     six-key filter; the filter now has three buckets (toDo / inProgress / done).

3. **GROUP control row**
   - Left: a small uppercase muted `GROUP` label, then a segmented control
     `[ My Day | By Status | By Sprint & Parent ]` (active = white/solid pill). Wire to the
     existing `groupingMode` (`my-day` / `by-status` / `by-sprint-parent`).
   - Right: an `≡ Updated` button — a sort control. Implement as a simple sort toggle that
     orders rows within each group by `fields.updated` descending (label stays `Updated`).
     If risky, render the control and default-sort by updated.

4. **Grouped list** (sticky group headers + flat rows)

### Group header
- A sticky header (`sticky top-0 z-10`, opaque bg) per section, with:
  - a **colored left accent stripe** (`border-l-4`) in the section's category color
    (Flagged/Blocked = red, Overdue = amber/orange, In Review = purple, In Progress = blue,
    To Do = gray/slate, Done = green),
  - the **bold section label** + a small muted **count** next to it (e.g. `Flagged / Blocked  1`),
  - on the FAR RIGHT, the section **story-point total**: `N pts` (sum of SP of parent stories in
    that section; `!subtask`). Muted, small.

### Row anatomy (parent story)
Left → right, single line (with the metadata chips wrapping/truncating gracefully):
1. **Expand/collapse chevron** (`▾`/`▸`) — collapses/expands this story's subtasks. Local UI
   state (a `Set<string>` of collapsed parent keys). Only shown when the story has subtasks.
2. **Issue type icon** (`IssueTypeIcon`).
3. **Priority icon** (`PriorityIcon`, the Jira iconUrl).
4. **Issue key** (monospace, muted, e.g. `ESHOP-19233`) — clicking it opens the full page via
   outlet `onIssueClick` (breadcrumb-aware). Row body (elsewhere) opens peek via `onOpenIssue`.
5. **Summary** (flex-1, truncate).
6. **Metadata chips** (inline, after the summary, muted/colored, each `shrink-0`):
   - `N sub` — subtask-count badge (from `fields.subtasks.length`), small muted pill.
   - `🚩 Flagged` — red, when the flagged field is set (`isIssueFlagged`).
   - `🚫 Blocked` — red, ONLY if derivable (e.g. a `blocked`/`impediment` label). If not
     derivable from available data, omit it (do not fake).
   - **Label chips** — for each Jira label (`fields.labels`), a small gray pill with a folder
     icon + label text (e.g. `▢ Checkout reliability`, `▢ Analytics`). Cap at ~2 visible + `+N`.
   - **MR health** — when the story has a matched authored MR: a small colored indicator with
     icon + text: `Awaiting review` (blue), `Approved` (green check), `Changes requested`
     (amber/orange ⚠). Derive REAL health via the GitLab authored-MRs query + `matchMrsToStories`
     / `deriveReviewHealth` (replace the current `getMrHealth` sentinel). If MR data is
     unavailable, show nothing (graceful).
7. **Status pill** (`statusPillClass`, e.g. `In Progress` blue, `To Do` gray, `In Review` blue).
   Right-aligned group begins here (these columns line up across rows).
8. **Story points** — `N pts` (muted). HIDDEN on subtasks.
9. **Time bar — STACKED** (this is the key change): a fixed-width column (~`w-36`/144px) with:
   - the colored progress bar on TOP (`Progress`, full column width, `indicatorClassName`:
     red if spent ≥ estimate, amber if ≥75%, else green; a thin track),
   - the caption BELOW it in small mono muted text: `6h 30m / 5h` (`formatDuration(spent) / formatDuration(est)`).
   - No estimate but spent: muted track + `0m / —` or spent-only caption, same column width so
     rows align. No data at all: empty equal-width spacer. (Mockup shows e.g. `0m / 2h`, `0m / 4h`,
     `1h 30m / —`.)
10. **Assignee avatar** (`CachedAvatar`, size ~24) — FAR RIGHT, all row types. Unassigned →
    fallback (dashed/empty circle as in mockup).

### Subtask rows
- Indented (`pl-8`/`pl-10` with the `↳` corner-arrow glyph like the mockup), then: issue key,
  summary, status pill, stacked time bar, avatar. NO `N sub` badge, NO priority/SP, NO label
  chips (matches mockup — subtasks are lean). Subtasks hide under a collapsed parent.

## Behavior to preserve (do not regress)
- 3 scopes (current-sprint / all-assigned / all-reported), epic exclusion, progressive paging +
  "Loading more tasks…", persistence of groupingMode + scope, peek (`onOpenIssue`) + breadcrumb
  (`onIssueClick`) wiring, per-section loading/error/empty states.
- All three grouping modes still work; subtasks always nest under their parent.

## Notes / known data gaps (flag, don't fake)
- Sprint name/number for the subtitle (not in fetched fields) — omit if unavailable.
- `Blocked` chip source unknown — omit unless a label/field clearly provides it.
- `States ▾` and `Spec` toolbar buttons — visual only; behavior undefined.
- Ensure `labels` is in the fetched `fields` for ALL scopes (add if missing) so label chips work
  on All Assigned / All Reported too.
