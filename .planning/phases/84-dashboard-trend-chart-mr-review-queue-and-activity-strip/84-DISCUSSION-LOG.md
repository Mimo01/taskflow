# Phase 84: Dashboard Trend Chart, MR Review Queue, and Activity Strip - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-15
**Phase:** 84-dashboard-trend-chart-mr-review-queue-and-activity-strip
**Areas discussed:** Trend chart scope, Activity strip content, MR review queue shape, Layout & releases (DASH-05)

---

## Trend chart scope

| Option | Description | Selected |
|--------|-------------|----------|
| Logged + scheduled overlay | Bars for logged hours + daily scheduled/required hours via fetchUserSchedule (second Tempo call) | |
| Logged hours only | Just logged-hours bars Mon–Fri; "vs schedule" deferred | |
| Logged bars + 8h marker | Logged-hours bars with a static 8h/day target line, no schedule fetch | ✓ |

**User's choice:** Logged bars + 8h marker
**Notes:** Gives the "vs target" feel cheaply without a per-user schedule fetch.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, new weekly Tempo query | Dedicated useQuery fetching Mon–today worklogs when tempoEnabled | ✓ |
| Reuse if a week-range cache exists | Prefer existing warm week-range cache, fall back to new query | |

**User's choice:** Yes, new weekly Tempo query
**Notes:** Trend chart is the only section permitted a new fetch; others reuse warm caches.

| Option | Description | Selected |
|--------|-------------|----------|
| Mon–Fri, zero-fill | All 5 weekday buckets; no-log/future days = 0 bar | ✓ |
| Mon–today, zero-fill | Only weekdays up to today | |

**User's choice:** Mon–Fri, zero-fill

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed 8h, hardcoded constant | Single named constant DAILY_TARGET_HOURS = 8 | ✓ |
| Reuse a schedule value if trivially available | Use settings-store daily-hours if it's a one-liner, else 8 | |

**User's choice:** Fixed 8h, hardcoded constant

---

## Activity strip content

| Option | Description | Selected |
|--------|-------------|----------|
| Jira activity (mentions/changelog) | ['standup','jira',...] — core changelog/mentions | ✓ |
| Jira created issues | ['standup','jira-created',...] | |
| GitLab commits | ['standup','commits',...] | ✓ |
| GitLab MR events | ['standup','mr-events',...] | |

**User's choice:** Jira activity + GitLab commits
**Notes:** MR events excluded (redundant with dedicated MR queue); jira-created excluded as lower-signal.

| Option | Description | Selected |
|--------|-------------|----------|
| Compact, capped list (~5–7) | Condensed list + "+N more" overflow | ✓ |
| Compact, scrollable | Internally-scrolling section showing all items | |

**User's choice:** Compact, capped list (~5–7)

| Option | Description | Selected |
|--------|-------------|----------|
| Fetch on demand (shared key) | Strip mounts own useQuery with same keys: warm→cache, cold→fetch | ✓ |
| Render only from warm cache | enabled:false reactive cache-read; blank on cold Dashboard | |

**User's choice:** Fetch on demand (shared key)
**Notes:** Shared key satisfies "no duplicate request when both visited" while keeping the strip functional on a cold Dashboard.

| Option | Description | Selected |
|--------|-------------|----------|
| Merged, newest-first | Single interleaved timeline sorted by timestamp | ✓ |
| Grouped by source | Separate Jira / GitLab groups | |

**User's choice:** Merged, newest-first

---

## MR review queue shape

| Option | Description | Selected |
|--------|-------------|----------|
| Two labelled groups | "Awaiting my review" then "My open MRs" | ✓ |
| Single list, role badge | One list with Review/Mine tags | |

**User's choice:** Two labelled groups

| Option | Description | Selected |
|--------|-------------|----------|
| mr-health review status | needs_review / approved / changes_requested from ['mr-health',...] | ✓ |
| Pipeline/CI status | CI pass/fail/running — not in cache, new fetch | |
| Approval count | e.g. 1/2 approved — not in cache, new fetch | |

**User's choice:** mr-health review status
**Notes:** Reuses warm cache; pipeline/approvals would require new fetches (out of scope).

| Option | Description | Selected |
|--------|-------------|----------|
| Title + author/project + open externally | Row shows title, author/project, badge; click → web_url | ✓ |
| Title + badge only, open externally | Minimal row | |
| Title + author/project, non-clickable | Display-only | |

**User's choice:** Title + author/project + open externally

| Option | Description | Selected |
|--------|-------------|----------|
| Context-aware empty states | Empty queue vs "GitLab not connected" distinct states | ✓ |
| Single generic empty state | One "Nothing here" regardless of cause | |

**User's choice:** Context-aware empty states

---

## Layout & releases (DASH-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep release where Phase 83 put it | Activity strip separate; release unmoved | |
| Co-locate activity + release | Pair activity strip + next-release countdown into one "Activity & Releases" section | ✓ |

**User's choice:** Co-locate activity + release
**Notes:** Literally matches DASH-05's "activity & releases section" framing; relocates the Phase 83 release element.

| Option | Description | Selected |
|--------|-------------|----------|
| You decide (sensible default) | Planner/Claude chooses coherent layout | ✓ |
| Charts together, lists together | Sprint-health + trend side by side; MR queue + activity side by side | |
| Single stacked column | All sections full-width vertically | |

**User's choice:** You decide (sensible default)

---

## Claude's Discretion

- Overall section ordering / responsive layout of the Dashboard (within DASH-07 independent degradation).
- Visual treatment of trend-chart bars + 8h marker (color tokens must be `var(--chart-N)`).
- Compact-row markup for activity items and MR rows; the "+N more" overflow affordance.
- Component decomposition (new components vs inline).

## Deferred Ideas

- Logged-vs-scheduled overlay (fetchUserSchedule) for the trend chart.
- Configurable daily target (lift the hardcoded 8h to a setting).
- jira-created + MR events in the activity strip.
- Pipeline/CI or approval-count MR badges (would require new fetches).
- Internally-scrollable full activity feed.
