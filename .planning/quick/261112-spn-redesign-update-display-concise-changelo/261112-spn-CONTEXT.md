# Quick Task 261112-spn: Redesign update display — concise changelogs, release script/instructions, update + updated modals, Settings → Updates page - Context

**Gathered:** 2026-11-12
**Status:** Ready for planning

<domain>
## Task Boundary

Redesign how the app presents updates. 100% backwards compatible (older installed clients must still render new release notes correctly; new clients must render all old notes correctly).

Scope:
1. Release notes become concise — change `taskflow/scripts/release.sh`, `taskflow/scripts/bump-version.mjs` (usage/validation/help) and add written release-notes instructions (no guide exists today; only script header comments).
2. Redesign the "Update available" modal (`taskflow/src/components/update/UpdateDialog.tsx`).
3. Redesign the post-update "What's new" modal (`taskflow/src/components/update/WhatsNewDialog.tsx`).
4. Settings → Updates page (`taskflow/src/routes/settings/UpdatesSection.tsx`) — nicer, more flexible past-updates browsing.

Current data flow (verified):
- Notes piped to `release.sh` → `bump-version.mjs` → prepended to `taskflow/CHANGELOG.md` + tag annotation (`--cleanup=verbatim`).
- CI (`.github/workflows/release-cross-platform.yml`) uses the tag body as the GitHub release body (Mimo01/taskflow-releases) and as `notes` in `latest.json`.
- Old/new clients: UpdateDialog renders `latest.json` notes via ReactMarkdown; WhatsNewDialog renders `settings.lastSeenChangelog` (persisted before restart via `persistChangelogBeforeRestart`); UpdatesSection fetches `https://api.github.com/repos/Mimo01/taskflow-releases/releases?per_page=20` and renders bodies.
- Existing notes format: `### Added|Changed|Fixed` sections with bullets `- **Title** — long description`.

</domain>

<decisions>
## Implementation Decisions

### Note format (new releases)
- "Headline + titles": one summary sentence first (plain paragraph), then short bullets grouped under `###` headings.
- Bullet = `**Bold title**` optionally followed by ` — ` and ONE short clause (a few words). No multi-sentence descriptions.
- Fixed section collapses many fixes into one or a few short bullets.
- Must remain plain GitHub markdown with `###` headings so OLD clients (ReactMarkdown) and GitHub render it fine.
- Section headings: planner/researcher decide whether to keep Added/Changed/Fixed or move to New/Improved/Fixed — the parser must accept BOTH (old notes use Added/Changed/Fixed; possibly also Removed/Security etc.).

### Full detail
- Short everywhere: the same short notes go to CHANGELOG.md, tag, GitHub release and in-app. No separate long text.
- Do NOT rewrite existing CHANGELOG.md history.

### Release script + instructions
- release.sh / bump-version.mjs: update usage examples to new format; add a lint/guard step that warns (or fails, with an override flag) when notes are too wordy (e.g. bullet longer than N chars, missing headline sentence, too many bullets). Must not break `--skip-bump` path.
- Add written release-notes instructions (e.g. `taskflow/docs/RELEASE-NOTES.md` or similar, referenced from the script header) describing the format with an example. Claude writes notes per release (see memory: release changelogs written by Claude).

### Old notes in the app
- Parse `- **Title** — description` bullets: show titles only by default; click a bullet to reveal its description. Raw-markdown fallback for anything unparsable (whole release body or single bullet).
- A single shared parser + shared notes-body component used by Update modal, What's New modal and Settings history.

### Update available modal ("Compact card")
- Header: "Update available", version jump `current → new · date`, and "(N releases)" when skipping versions.
- Headline sentence, then grouped titles (NEW / IMPROVED / FIXED-style small caps labels), each bullet expandable (›) for its description; Fixed may collapse to "N fixes ›".
- Skipped-version roll-up: when the user skips versions, show intermediate releases as compact rows below (e.g. `1.14.19 — <headline or first title> … ›`), expandable. Intermediate notes come from the GitHub releases API (same source as Settings); if unavailable/offline, show only the latest `latest.json` notes — never block the update.
- Footer: Later / Update now. Downloading progress replaces the footer in place (still non-dismissable); error state keeps Dismiss / Retry.

### What's new modal ("Same body, celebratory header")
- Same notes body component as the update modal.
- Header: check icon + "Updated to X.Y.Z", subline "from <previous version>" (previous = `lastSeenVersion`).
- Roll-up of skipped versions too (from GitHub API, fallback to `lastSeenChangelog`).
- Footer: "See all updates" link → Settings → Updates; primary "Got it". Show/dismiss semantics unchanged (lastSeenVersion / lastSeenChangelog logic must stay backwards compatible).

### Settings → Updates history
- Load all versions (page past the 20 cap — GitHub API pagination), grouped by minor version (e.g. 1.14.x) with collapsible groups.
- Uses the same parsed, titles-first rendering.
- Claude's discretion for "nice UX": search across notes text, type filter chips, highlight the installed version, expand/collapse — user said "you decide, I want a nice UX".

### Claude's Discretion
- Exact visual styling, filter/search UI, grouping details, lint thresholds, docs location.
- Follow user design memories: page/section headers conventions, compact EmptyState for empty/error, no card panels on detail pages, hover affordances w/o layout shift, one row = one line.

</decisions>

<specifics>
## Specific Ideas

Example of desired new note format (approved preview):

```
Notifications got a full redesign.

### New
- **Notification panel** — stacks per issue, quick actions
- **Epic picker on stories**
- **Searchable pickers** in Settings and setup

### Improved
- **Attachment tiles**
- **No active sprint** messaging

### Fixed
- Duplicate notifications, package mismatches, peek over-scroll
```

</specifics>

<canonical_refs>
## Canonical References

- `.github/workflows/release-cross-platform.yml` (tag body → GitHub release body + latest.json notes) — do not need to change; verify compatibility.
- `taskflow/CHANGELOG.md` — existing format samples.
- Memory: release changelogs written by Claude personally.

</canonical_refs>
