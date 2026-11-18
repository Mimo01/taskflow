---
phase: 101-issue-drafts-large-create-edit-modal
plan: 12
subsystem: verification
tags: [uat, tauri, drafts, modal]
requires: [101-01, 101-02, 101-03, 101-04, 101-05, 101-06, 101-07, 101-08, 101-09, 101-10, 101-11]
provides: [phase-101-gate, manual-verification-record]
key-files:
  modified:
    - .planning/phases/101-issue-drafts-large-create-edit-modal/101-VALIDATION.md
    - taskflow/src/components/wiki-editor/host.ts
    - taskflow/src/components/wiki-editor/nodeviews/ImageView.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/useDraftResume.ts
    - taskflow/src/routes/dashboard/CreateEpicDialog.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/IssueTypeSelector.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/ModalSidebar.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx
decisions:
  - "Issue type moved from the modal header into the sidebar as the first field (user choice after three header variants)"
  - "Jira-writing checks were skipped at the user's request (no issue creation, no Edit save)"
metrics:
  completed: 2026-11-18
---

# Phase 101 Plan 12: Phase gate and manual verification Summary

The automated gate is green. Claude drove the running Tauri app for the manual checks, at the user's request, and skipped everything that writes to Jira. Three bugs found in the app were fixed and committed.

## Task 1: Automated gate

Commit 7dae38d7. `npm test` passed (6730 tests at the time), and `tsc` and `cargo check` passed. `npm run check` exits 1 only on the pre-existing biome baseline, in files this phase did not touch. The validation map is filled in and `nyquist_compliant: true`.

## Task 2: Manual checks (driven by Claude in `tauri dev`)

| Step | Result |
|------|--------|
| 1 Restart persistence (DRAFT-05/06) | Pass with one fix. The draft and its staged image survived Cmd+Q and a relaunch. The copy was written to `~/Library/Application Support/com.taskflow.app/issue-drafts/<id>/`, and there were no fs-scope errors. Resume restored the summary, description and staged file. The image preview did not come back, so that was fixed (see below). The final "Create Issue" upload and on-disk cleanup after create were not run because they write to Jira. Discard deleted the copies on disk. |
| 2 Edit labels/fix-version round-trip | Skipped: it writes to Jira (user instruction). |
| 3 Create another (UI-02) | Skipped: it creates Jira issues (user instruction). |
| 4 Visual (UI-01, D-01, D-18, D-19) | Pass after fixes. The dialog is large and fixed, and the footer stays put. At 1000px the sidebar is 300px, and at 900px it is 240px. Below 720px it stacks, and it now fills the full width (fixed). The chip is a pill to the left of Search, styled apart from pinned tabs. Discard shows "Draft discarded · Undo", Undo restores the row, and expiry removes the copies. |
| 5 Epic drafts (D-17) | Pass. The chip showed the epic draft with the Epic icon, and resuming from the Dashboard reopened Create Epic with the name. |
| 6 Account change (D-16) | Not run. No second Jira account was available, and switching credentials was out of scope. It is covered by `useDraftsAccountGuard.test.tsx`. |

## Deviations (bugs found in the app and fixed)

**1. [Rule 1 - Bug] Restored image previews never showed (DRAFT-04/05).** Commit fe5f4d38.
- A resumed image rendered as a filename chip. The app's React Compiler memoized `getLocalPreview(editor, name)` in `ImageView` on `(editor, name)`. A preview registered after the node mounted was never read. vitest does not run the compiler, and the tests stub the editor, so this only showed in the app.
- Fix: `ImageView` reads through a new `useLocalPreview` hook, which subscribes with `useSyncExternalStore`.
- In dev, `setLocalPreview` also threw `editor.storage.wikiHost.setPreview` undefined when the handle pointed at a destroyed editor, because tiptap resets storage to `{}` on destroy. It now returns `false`. `useDraftResume` and `CreateEpicDialog` retry each frame until a live editor takes the preview. A regression test was added, and it fails against the old code.

**2. [Rule 1 - Bug] Stacked sidebar stayed 240px wide below 720px.** Commit 0ae2fc19.
- The `@max-[900px]` container query outranked the `max-[720px]` media query.
- The 240px width is now `min-[721px]:@max-[900px]:` only.

**3. [User feedback] Modal header looked broken.** Commit 0ae2fc19.
- `IssueTypeSelector` rendered a visible "Issue Type" label above the select, which split the header row. Its read-only variant was also 36px tall against the select's 32px, a 4px jump between fresh and resumed modals.
- The user tried a quiet pill beside the title and a "Create Story" title. They then chose to move the type into the sidebar. The header is now just "Create issue" and close. "Issue type" is the first sidebar field, with type icons, and is read-only when the opener fixes the type.

## Notes for later

- **Version mismatch warning:** `tauri dev` warns that `tauri-plugin-fs` 2.4.5 (Cargo.lock) does not match `@tauri-apps/plugin-fs` 2.7.1 (npm). The same warning already existed for `tauri` against `@tauri-apps/api`. It is non-blocking; a `cargo update -p tauri-plugin-fs` would align them.
- **Create Epic dialog size:** the user wants it as large as the issue modal. That is already planned as Phase 102 / UI-05, not a gap here.
- **Discard while undo is pending:** while an undo is pending on the last draft, the chip shows "Drafts 0" and stays mounted, so Undo stays reachable. This was a deliberate 101-07 deviation from UI-SPEC ("chip unmounts").

## Self-Check: PASSED

- The summary records the user's instruction to skip Jira writes. Steps 2, 3 and 6 are recorded as not run, not as passing.
- Commits fe5f4d38 and 0ae2fc19 exist. The full suite passed after both (6733 tests).
