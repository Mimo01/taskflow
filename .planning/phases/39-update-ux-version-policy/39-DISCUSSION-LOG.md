# Phase 39: Update UX + Version Policy - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 39-update-ux-version-policy
**Areas discussed:** Update prompt dialog, Download & install flow, What's New dialog, Force-update policy UX

---

## Update Prompt Dialog

### Prompt appearance style

| Option | Description | Selected |
|--------|-------------|----------|
| Modal dialog | Centered dialog with version, changelog, and action buttons. Uses existing dialog.tsx pattern. | ✓ |
| Toast notification | Small non-blocking notification in corner. No existing toast system. | |
| Inline banner | Top-of-page banner similar to stale-data-banner.tsx. | |

**User's choice:** Modal dialog
**Notes:** Matches existing dialog.tsx pattern; ensures visibility.

### Changelog rendering

| Option | Description | Selected |
|--------|-------------|----------|
| Rendered markdown | Full markdown with react-markdown (already in deps). GitHub Release notes are markdown. | ✓ |
| Plain text summary | Strip markdown, show as plain bullet list. | |
| You decide | Claude chooses. | |

**User's choice:** Rendered markdown
**Notes:** react-markdown already in project for Jira wiki markup.

### "Later" dismiss behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Once per session | Dialog shows once, gone until next restart. | |
| Reappear on next check cycle | Dialog reappears after next polling interval (1h/6h/etc). | ✓ |
| Never again for this version | Dismissed version remembered (persisted). | |

**User's choice:** Reappear on next check cycle
**Notes:** More persistent than once-per-session — ensures user eventually updates.

### "Update Now" behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Same dialog shows progress | Dialog transitions to progress bar, then "Restart Now" when ready. | ✓ |
| Background download + notification | Dialog closes, download in background, toast when ready. | |
| You decide | Claude chooses. | |

**User's choice:** Same dialog shows progress

---

## Download & Install Flow

### User interaction during download

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, dialog stays open but app usable | Modal visible with progress, clickable outside to dismiss. | |
| Yes, dialog closes and downloads in background | Silent background download with status indicator. | |
| No, dialog blocks interaction | Non-dismissable modal during download. | ✓ |

**User's choice:** No, dialog blocks interaction
**Notes:** User prefers a decisive, blocking approach.

### Restart behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Always ask before restart | "Restart Now" / "Later" buttons. | |
| Auto-restart with 10s countdown | Countdown timer, user can cancel. | ✓ |

**User's choice:** Auto-restart with 10s countdown
**Notes:** Aggressive but gets users on new version quickly.

---

## What's New Dialog

### Trigger timing

| Option | Description | Selected |
|--------|-------------|----------|
| On first launch after update | Compare stored lastSeenVersion with current version. | ✓ |
| Immediately after restart | Show right after auto-restart countdown. | |
| You decide | Claude chooses. | |

**User's choice:** On first launch after update

### Dialog style

| Option | Description | Selected |
|--------|-------------|----------|
| Same dialog style, rendered changelog | Reuse modal dialog. Version + markdown changelog + "Got it" button. | ✓ |
| Full-page welcome screen | Dedicated route with rich layout and illustrations. | |
| You decide | Claude chooses. | |

**User's choice:** Same dialog style, rendered changelog

---

## Force-Update Policy UX

### Soft minimum banner

| Option | Description | Selected |
|--------|-------------|----------|
| Top-of-app persistent banner | Similar to stale-data-banner.tsx. Dismiss per session, reappears on next launch. | ✓ |
| Bottom-of-app sticky bar | Fixed to bottom. Less intrusive. Same dismiss behavior. | |
| You decide | Claude chooses. | |

**User's choice:** Top-of-app persistent banner

### Hard minimum overlay

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen centered overlay | Covers entire app. No dismiss. Version info + "Update Now" button. Fail-open. | ✓ |
| Modal dialog (no close) | Same dialog without X button. Same blocking effect. | |
| You decide | Claude chooses. | |

**User's choice:** Full-screen centered overlay

### Policy file location

| Option | Description | Selected |
|--------|-------------|----------|
| Public repo raw URL | Fetch from raw.githubusercontent.com. Same repo as releases. | ✓ |
| Bundled with latest.json | Add fields to Tauri updater endpoint JSON. | |
| You decide | Claude chooses. | |

**User's choice:** Public repo raw URL

### Policy check frequency

| Option | Description | Selected |
|--------|-------------|----------|
| Same interval as update check | Piggyback on existing polling. No extra requests. | ✓ |
| Only on launch | Fetch once at startup. | |
| You decide | Claude chooses. | |

**User's choice:** Same interval as update check

---

## Claude's Discretion

- Progress bar component implementation
- Countdown timer UI for auto-restart
- Changelog persistence across restart for What's New
- version-policy.json fetch implementation
- Semver comparison approach

## Deferred Ideas

None — discussion stayed within phase scope.
