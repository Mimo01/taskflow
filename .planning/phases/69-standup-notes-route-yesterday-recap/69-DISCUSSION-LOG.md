# Phase 69: Standup Notes — Route + Yesterday Recap - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 69-standup-notes-route-yesterday-recap
**Areas discussed:** Jira activity scope, MR activity fetch strategy, Page layout, Git commits scope

---

## Jira Activity Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Active project only | JQL: `project = {activeJiraProject} AND updated >= yesterday`. Fast, focused, matches standup context | ✓ |
| All projects | Scans every project the user has access to. More complete but potentially hundreds of issues | |
| Issues assigned to me + updated yesterday | JQL: `assignee = currentUser() AND updated >= yesterday`. Narrower — misses issues I commented on | |

**User's choice:** Active project only

---

| Option | Description | Selected |
|--------|-------------|----------|
| Status transitions + comments (STAND-04) | Fetch both with expand=changelog; filter by jiraUsername and date | ✓ |
| Status transitions only | Skip comments — saves per-issue calls | |
| Comments only | Skip transitions | |

**User's choice:** Status transitions + comments (as specified in STAND-04)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Cap at 50 issues | maxResults=50. Avoids accidental slow fetches on large projects | ✓ |
| Paginate to exhaustion | Complete picture but unpredictable performance | |
| You decide | Leave to researcher/planner | |

**User's choice:** Cap at 50 issues

---

## MR Activity Fetch Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| GitLab User Events API | `/api/v4/users/:id/events` — covers all projects in 1-2 calls. Clean and fast | ✓ |
| Configured project MRs only | Scan active MRs in configured GitLab project, filter for my activity | |
| You decide | Leave to researcher/planner | |

**User's choice:** GitLab User Events API

---

| Option | Description | Selected |
|--------|-------------|----------|
| Combined list | Two API calls (comments + approvals), merged into one "MR Activity" list | ✓ |
| Two separate sub-sections | "Comments" + "Approvals" sub-sections within MR activity | |

**User's choice:** Combined list

---

## Page Layout

**User provided a mockup:** `/Users/mimo/Downloads/Screenshot 2026-05-24 at 7.47.07 PM.png`

**User's description:** Two columns (Yesterday left, Today right), entries grouped by task/issue.

| Option | Description | Selected |
|--------|-------------|----------|
| Copy markdown included | Overrides earlier v1.10 rejection — build the Copy markdown button in Phase 69 | ✓ |
| Exclude (keep rejection) | No copy button | |
| Placeholder only | Show button, no logic | |

**Notes:** User explicitly overrode the REQUIREMENTS.md rejection of "Export Standup Notes to clipboard/markdown". Copy markdown is now in scope.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full shell now — Today placeholder in Phase 69 | Build 2-column layout; Today column shows placeholder | ✓ |
| Yesterday only — Today column added in Phase 70 | Phase 70 restructures into 2 columns | |

**User's choice:** Full shell now

---

| Option | Description | Selected |
|--------|-------------|----------|
| Separate "Other commits" group | Unlinked commits in catch-all group at bottom | — |
| Omit from page | Only show issue-linked commits | |
| You decide | Leave to planner | |

**User's choice (free text):** "If they are in a branch that contains the jira key, include them there. Otherwise in 'Other commits' section"

**Notes:** Commit grouping fallback chain: (1) Jira key in commit message, (2) Jira key in branch name, (3) "Other commits" catch-all.

---

## Git Commits Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Configured project only | Fetch from `activeGitlabProject` numeric project ID | |
| All accessible projects | N+1 API calls across all projects | |
| You decide | Leave to researcher/planner | ✓ |

**User's choice:** You decide

---

| Option | Description | Selected |
|--------|-------------|----------|
| gitlabUsername (Recommended) | Use stored `gitlabUsername` as author filter | ✓ |
| author_email | Extra API call to get email, more precise | |
| You decide | Leave to researcher/planner | |

**User's choice:** gitlabUsername

---

## Claude's Discretion

- Git commits project scope (configured project vs. all projects)
- Branch name → Jira key resolution strategy (per-commit `/refs` calls vs. batch branch listing)
- Today placeholder content in Phase 69 (static text, skeleton, or empty state)
- Exact Lucide icon names per activity type
- Exact markdown format for Copy markdown output
- Whether "synced Xm ago" timestamp tracks per-section or globally

## Deferred Ideas

- Today column content (STAND-07, STAND-08, STAND-09) — Phase 70
