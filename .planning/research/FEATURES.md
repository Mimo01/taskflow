# Feature Research

**Domain:** Release-coordination / release-train tooling for git-flow teams (Jira + GitLab)
**Researched:** 2026-08-10
**Confidence:** MEDIUM (grounded in GitLab's own API/docs + git-flow literature + engineering-analytics tool positioning; no direct hands-on access to Jira Release Hub/Shortcut/Sleuth UIs, so those are triangulated from public docs/marketing rather than direct inspection)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist once a tool claims to do "release coordination." Missing these makes the Releases view feel like a read-only report, not a working surface — which is exactly the gap v1.14 targets.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Release branch existence check | Any git-flow tool that talks about "this release" must know if `release/<tag>` exists — it's the substrate everything else hangs off | LOW | Single GitLab branches-API GET; render as a release-level banner, same visual language as the existing "No GitLab milestone matched" warning already in `ReleaseDetailPage.tsx` |
| Create release branch (guarded) | Once a tool detects "branch missing," users expect a one-click fix, not manual git — but branch creation is consequential (wrong base = broken release) so a confirm step is expected, not optional | LOW-MEDIUM | GitLab `POST /repository/branches` off project default branch (`develop`, read from API per PROJECT.md decision — never hardcode); confirm dialog matches existing `Dialog` pattern already used for the Edit Release modal |
| MR-to-release membership list, one row per MR | Every release-train tool (GitLab Release dashboard, Jira Release Hub) shows "what's in this release" as a flat, scannable list — this is the single most load-bearing view in the whole feature | LOW (data already fetched) | Already exists as `matchedRows`/`unmatchedMRs` in `ReleaseDetailPage.tsx`; v1.14 extends it to 3-channel union, not a new list |
| Wrong-target-branch flag | GitLab's own backlog explicitly names this as a top user pain point (issue #378526: "Allow MR author to change target branch" — filed because maintainers waste time fixing mistargeted MRs across "Current-stable, Legacy-stable, Next-minor, Next-major" branches) | LOW-MEDIUM | Already partially present as "Wrong milestone" badge pattern (`wrongMilestoneByKey`); extend the same visual grammar to target-branch mismatches |
| Missing-milestone flag | Symmetric to wrong-branch: an MR that targets the right branch but was never milestoned won't show up in milestone-based release reporting elsewhere in GitLab, so it's silently "invisible" to anyone using milestones as ground truth | LOW | Same pattern as existing "Missing MR" orange `AlertTriangle` badge |
| Per-item fix action co-located with the flag | GitLab's `/target_branch` quick action and the MR update API (`PUT .../merge_requests/:iid` accepting `target_branch` + `milestone_id` in one call) exist precisely because users expect "flag it, then fix it inline" not "flag it, then go somewhere else to fix it" | LOW-MEDIUM | Confirmed: GitLab's MR API updates `target_branch` and `milestone_id` in the *same* PUT request — this app's "retarget + assign milestone" corrective action can be one API call per MR, matching the v1.12 bulk-subtask per-row retry pattern already in the codebase |
| Post-release merge-back verification | The single most commonly cited git-flow failure mode across every source (git-flow docs, Runway blog, trunkbaseddevelopment.com) is fixes landing in `release/x` and never reaching `develop` — silently regressing in the next release. Tools that support git-flow either warn about this or automate the merge; silence is a known trust-breaker | LOW-MEDIUM | GitLab branch-compare API (`/repository/compare` or ahead/behind check) after `released: true`; render release as "unfinished" until merge-back confirmed — matches the milestone spirit of "surface as unresolved until proven done" |
| Create missing GitLab milestone | Symmetric table-stakes to branch creation — if channel (B) requires a milestone and none exists, the release-level flow is dead in the water without this | LOW | `POST /milestones`; user types final name, latest milestones shown for format reference (`1.1.0`/`2.0.0`) — same "type it yourself, we don't guess" caution already chosen for release-branch naming |

### Differentiators (Competitive Advantage)

Not required by "release coordination" in the abstract, but directly answer this team's actual git-flow pain (MRs opened against the wrong branch) better than generic tools do.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Three-channel union with per-channel provenance | Most release dashboards (GitLab's own, Jira Release Hub) trust exactly one source of truth (usually the milestone). This app's insight — that disagreement *between* Jira-linkage, milestone-tag, and branch-target is itself the signal — is closer to a reconciliation/audit tool than a status dashboard. No competitor researched does this three-way union explicitly | MEDIUM-HIGH | Already ~60% built: `releaseIssueKeySet` (channel A signal), `milestoneMRs` (channel B), needs channel C (`target_branch = release/<tag>` query) added and reconciled — see Q3 answer below for presentation guidance |
| Zero-navigation corrective actions (retarget + assign, one click, one row) | GitLab itself only offers `/target_branch` as a comment quick-action (context-switch to the MR) or a full edit-form field; no GitLab-native surface offers "see the problem and fix it in the same glance" the way this app's inline row pattern (established in v1.12 bulk-subtask creation) does | LOW (pattern already proven in-app) | Reuse, don't invent: per-row status/spinner/retry chip from the bulk-subtask-creation pattern; NOT a new interaction paradigm |
| Release-branch lifecycle awareness (missing → cut → drift → merge-back) as one continuous view | Generic tools (LinearB, Swarmia) are metrics-first and don't model git-flow branch lifecycle at all; GitLab's own release dashboard is milestone/tag-first and doesn't track branch merge-back. A single "is this release *actually* done" view spanning branch-cut through merge-back is the differentiator over both categories | MEDIUM | This is the throughline connecting branch-resolve/create through merge-back-check into one release-detail narrative rather than disconnected widgets |

### Anti-Features (Commonly Requested, Often Problematic)

Explicitly rejected — either by prior milestone decisions or because they don't fit this team's already-stated constraints.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Historical release-cadence analytics / DORA-style dashboards (lead time, cycle time trend charts) | LinearB/Swarmia/Sleuth all lean heavily into this; feels like "what real release tools do" | Explicitly out of scope per PROJECT.md ("No analytics: Real-time/live only") and already tried-and-retired once in v1.13 Phase 85 (velocity/burndown insights built then deleted at Phase 86 for not earning daily-use place). Re-proposing this for v1.14 repeats a decision already made twice | LinearB/Swarmia exist for this per PROJECT.md's own Out-of-Scope note — don't rebuild them |
| "Fix all" bulk corrective action across every drifted MR | Feels efficient — why click N times when one button retargets everything? | Explicitly rejected by the milestone brief itself ("no 'fix all'") and by precedent: v1.12's bulk-subtask feature deliberately kept per-row status+retry rather than an opaque batch mutation, because retargeting is consequential (wrong branch context per MR) and partial-failure needs per-row visibility, not an all-or-nothing spinner | Per-row action with per-row status/retry — already the established in-app pattern |
| Automatic MR retargeting without confirmation (silent auto-fix on detection) | Would look "smart" — detect drift, fix it instantly | Changing an MR's target branch is a real git operation with review/diff implications for the MR author; doing it silently removes human judgment from a decision that affects what the reviewer is actually comparing against. GitLab's own community explicitly frames retargeting as author-owned, not tool-owned | Detect + flag + one-click confirm-or-not action, mirroring the existing confirm-dialog pattern for branch/milestone creation |
| Automatic merge-back (release → develop) performed by the app | Symmetric temptation to "just do it" once detected as missing | This is a real merge that can conflict; git-flow literature (Runway, trunkbaseddevelopment.com) universally treats merge-back as a deliberate, often manually-reviewed step, and the milestone brief itself only asks for a *check*, not an automated merge | Surface as unresolved/warning until the team merges it themselves via normal git tooling; app verifies, doesn't perform |
| Widget/grid customizable release dashboard | Feels like a natural evolution of "release readiness at a glance" | Directly re-treads the react-grid-layout widget system removed in v1.9 and the constraint restated in v1.13 ("not a return to widgets"); this team has rejected customizable-widget dashboards twice already | Curated, fixed-layout detail page — same pattern as the v1.13 Dashboard redesign |
| Slack/email notification when drift is detected | "Real release tools" (LinearB, Sleuth) often ping channels on release events | Explicitly out of scope per PROJECT.md ("Email or Slack notifications — external service dependencies") | In-app badge/warning, checked on view load — consistent with the app's pull-not-push architecture everywhere else |
| GitLab code-review actions (approve/request changes) surfaced from the release view | Once you're looking at "problem MRs," it's tempting to let users act on review state too | Explicitly still out of scope per PROJECT.md's v1.14-narrowed exclusion — only release-management writes (branch/milestone/retarget/assign) are in scope; review actions remain deferred to v2.0 | Deep-link to GitLab's MR page for review actions, same as today |

## Feature Dependencies

```
Release branch resolve/detect
    └──requires──> GitLab default-branch read (existing: activeGitlabProject config)
Release branch create
    └──requires──> release branch resolve/detect (must know it's missing first)

Three-channel MR discovery
    └──requires──> Channel A: existing fixVersionIssues + linkMRToTask (already built)
    └──requires──> Channel B: existing fetchMilestoneMRs (already built)
    └──requires──> Channel C (NEW): MRs targeting release/<tag> — new GitLab query
    └──requires──> release branch resolve/detect (need the resolved branch name for Channel C)

Drift flagging
    └──requires──> Three-channel MR discovery (union is the input to diffing)

Per-MR corrective actions
    └──requires──> Drift flagging (must know WHAT is wrong before offering a fix)
    └──requires──> Release branch resolve/detect + create (retarget needs the branch to exist)
    └──requires──> Milestone creation OR existing milestone (assign-milestone needs a target)

Milestone creation
    └──enhances──> Per-MR corrective actions (assign-milestone action needs a milestone target to exist)

Post-release merge-back check
    └──requires──> Release branch resolve/detect (must know the release branch name)
    └──requires──> version.released flag flip (existing Jira fix-version data)
    └──independent of──> Three-channel discovery / drift flagging / per-MR actions (can ship as an isolated per-release check)
```

### Dependency Notes

- **Per-MR corrective actions require branch/milestone existence first:** retargeting to a release branch that doesn't exist, or assigning a milestone that doesn't exist, are 404s waiting to happen. Branch/milestone creation must land (or at minimum be live-checked) before the per-MR mutation fires — the row action should itself re-verify or the app should disable the action until the branch/milestone exist, matching the "confirm dialog" caution already used elsewhere.
- **Three-channel discovery requires the resolved branch name:** Channel C literally cannot query "MRs targeting `release/<tag>`" until the branch name is deterministically known (the `release/<milestone name>` naming convention), so three-channel discovery has a hard ordering dependency on branch resolution, not just a soft one.
- **Merge-back check is architecturally independent:** it only needs the branch name and the Jira `released` boolean flip — it does not need drift flagging or per-MR actions to exist. This means it can be built/shipped as an isolated vertical slice, which is useful roadmap-phasing information (a phase can ship branch-resolve + merge-back-check together as "release branch lifecycle bookends" while three-channel-discovery + drift-flagging + per-MR-actions form a second, larger "drift detection and fix" phase).

## MVP Definition

### Launch With (v1.14, matches committed Active requirements exactly)

- [ ] Release branch resolve + existence detection + release-level warning — foundation for everything else
- [ ] Create release branch behind confirm dialog — closes the "branch missing" dead-end
- [ ] Three-channel MR union (Jira-linkage, milestone, branch-target) — the core reconciliation signal
- [ ] Drift flagging (wrong branch, missing milestone, task not in fix version) — the payoff of the union
- [ ] Per-MR retarget + assign-milestone corrective action, per-row status + retry — turns detection into action
- [ ] Create missing GitLab milestone behind confirm dialog — closes the "milestone missing" dead-end
- [ ] Post-release merge-back check — closes the loop after ship

### Add After Validation (v1.x, not committed — flag if UAT surfaces demand)

- [ ] Freeze-window awareness (warn if the release branch's base has diverged significantly since cut) — trigger: if UAT users manually check "is this branch stale" today
- [ ] Cherry-pick visibility: which commits on `develop` post-cut are NOT yet on the release branch (freeze-violation detection, the inverse of the merge-back problem) — trigger: if the team reports fixes landing on `develop` but forgetting the release branch

### Future Consideration (v2+, defer until this MVP proves the pattern)

- [ ] Automated (not just checked) merge-back with conflict detection — defer: real merges are risky to automate; prove the "check" surface is trusted first
- [ ] Multi-release-branch awareness (hotfix branches alongside a release branch) — defer: PROJECT.md constraint is "one Jira project + one GitLab project at a time," single-release-in-flight is the current scale

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Release branch resolve/detect | HIGH | LOW | P1 |
| Release branch create | HIGH | LOW-MEDIUM | P1 |
| Three-channel MR union | HIGH | MEDIUM-HIGH | P1 |
| Drift flagging | HIGH | LOW (built on union) | P1 |
| Per-MR corrective action | HIGH | LOW-MEDIUM | P1 |
| Milestone creation | MEDIUM-HIGH | LOW | P1 |
| Merge-back check | HIGH | LOW-MEDIUM | P1 |
| Freeze-violation / cherry-pick visibility | MEDIUM | MEDIUM-HIGH | P3 (not committed) |
| Automated merge-back | LOW (per git-flow literature — risky) | HIGH | P3 (anti-feature candidate, not just deferred) |

## Answers to the Five Research Questions

**1. Release readiness dashboards — what signals, what makes a row scannable.**
Across GitLab's own release dashboard, Jira Release Hub-style views, and engineering-analytics tools (LinearB, Swarmia), the consistent scannable-row grammar is: **name + status badge + date/countdown + a single aggregate progress indicator + a single "problems exist" indicator**, with detail behind a click. Taskflow's `ReleasesTab.tsx` already matches this shape (name, Released/Unreleased/Overdue/Due-today badges, GitLab match link, done/total count). Swarmia's own positioning explicitly argues that "more metrics isn't more clarity" — opinionated signals beat raw charts. For v1.14, the row-level addition should be a single new badge class ("N MRs need attention") rather than expanding the row with multiple new columns — keep the row scannable by aggregating, and push the three-channel detail into the existing `ReleaseDetailPage`.

**2. Drift / misconfiguration detection — visual language.**
GitLab's own backlog (issue #378526) confirms "wrong target branch" is a recognized, named pain point industry-wide, not a Taskflow-specific quirk. The convention already adopted in this codebase — an orange `AlertTriangle` inline badge with a `title` tooltip explaining the specific mismatch (see `wrongMilestoneByKey` rendering in `ReleaseDetailPage.tsx`) — is consistent with how GitLab itself surfaces warnings (e.g., merge-train inconsistent-state warnings) and should be extended verbatim to "wrong target branch" and "missing milestone," rather than inventing a new severity system. Severity should stay single-tier (warning, not error/blocker) since these are correctable states, not hard failures — matches the existing amber/orange palette already used for "Unreleased," "No date set," and "Missing MR."

**3. Reconciling three sources of truth without overwhelming the user.**
No competitor product researched does true three-way set reconciliation (most trust one channel, usually the milestone, as ground truth). The safe pattern, and the one already partially implemented (`wrongMilestoneByKey` for the two-way Jira/milestone case), is: **don't show a Venn diagram or matrix — show one row per issue/MR with a single flag describing the specific disagreement in plain language** ("Wrong milestone", "Missing MR", extend to "Wrong branch", "No milestone"). Aggregate the *count* of disagreements at the release-row level (signal 1 in Q1's scannable row) and defer all per-item detail to the release-detail table, which is already the established drill-down pattern in this app (`ReleasesTab` → `ReleaseDetailPage`).

**4. Per-item corrective actions — inline vs bulk.**
The team's own v1.12 bulk-subtask-creation pattern (per-row progress + retry-failed-only, no bulk "fix all") is the correct precedent and the milestone brief explicitly reuses it ("no 'fix all'"). GitLab's own API confirms the mechanical shape is cheap: `PUT /projects/:id/merge_requests/:iid` accepts `target_branch` and `milestone_id` in a single call, so "retarget + assign milestone" can be one optimistic mutation per row, not two sequential ones. Expected UX per the existing app-wide pattern (`StatusPopover`, bulk-subtask rows): optimistic update with rollback on failure, inline spinner during flight, inline error + retry affordance on failure, no toast/modal for success (silent success, visible failure) — this matches the Key Decision already logged for `StatusPopover` in PROJECT.md.

**5. Git-flow specific expectations — table stakes vs nice-to-have.**
Cross-referencing git-flow's own docs, trunkbaseddevelopment.com, and Runway's cherry-pick/backmerge analysis: **cut** (branch creation) and **merge-back verification** are universally treated as mandatory lifecycle bookends — every source flags merge-back as the most common failure mode when skipped, which directly justifies the merge-back check as P1, not a nice-to-have. **Freeze enforcement** (blocking non-fix commits) and **cherry-pick tracking** (which fixes landed on develop but not the release branch, or vice versa) are treated as advanced/optional even in mature git-flow tooling — several sources note teams formalize freeze only via social process ("fix request" approval), not tooling — so these are correctly excluded from v1.14's committed scope and belong in the "Add After Validation" tier above, not as anti-features (they're real, just not MVP).

## Sources

- [GitLab: Allow merge request author to change target branch (#378526)](https://gitlab.com/gitlab-org/gitlab/-/issues/378526) — confirms "wrong target branch" as a named, recognized industry pain point
- [GitLab Merge Requests API docs](https://docs.gitlab.com/api/merge_requests/) — confirms single PUT updates both `target_branch` and `milestone_id`
- [GitLab: Create merge requests docs](https://docs.gitlab.com/user/project/merge_requests/creating_merge_requests/) — `/target_branch` quick action, chained-MR auto-retargeting behavior
- [Cherry-picks vs backmerges — Runway](https://www.runway.team/blog/cherry-picks-vs-backmerges-whats-the-right-way-to-get-fixes-into-your-release-branch) — cherry-pick discipline, tagging before cleanup
- [git-flow 1.0 docs — Releases](https://git-flow.readthedocs.io/en/latest/releases.html) — canonical cut/finish/merge-back lifecycle description
- [Branch for release — trunkbaseddevelopment.com](https://trunkbaseddevelopment.com/branch-for-release/) — freeze-window pitfalls, cutting too early
- [LinearB vs Swarmia — Swarmia](https://www.swarmia.com/alternative/linearb/) — "opinionated signals vs pile of charts" positioning, directly informs Q1 scannability guidance
- [LinearB vs Swarmia — LinearB](https://linearb.io/compare/swarmia-vs-linearb) — counter-positioning on dashboard depth
- Taskflow codebase: `taskflow/src/routes/dashboard/ReleasesTab.tsx`, `ReleaseDetailPage.tsx` — existing visual/interaction patterns this milestone must extend, not replace
- `.planning/PROJECT.md` — v1.14 committed scope, Out-of-Scope history (v1.9/v1.13 widget rejection, v1.13 analytics rejection), v1.12 bulk-subtask precedent

---
*Feature research for: Taskflow v1.14 Release Management*
*Researched: 2026-08-10*
