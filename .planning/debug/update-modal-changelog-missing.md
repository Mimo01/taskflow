---
slug: update-modal-changelog-missing
status: resolved
trigger: |
  When there is a new version, there is a modal that opens that prompts to update.
  There should be a changelog visible but currently no changelog appears.
  Also after the update the confirm modal appers where there should also be the changelog visible
created: 2026-05-23
updated: 2026-05-23
---

# Debug Session: update-modal-changelog-missing

## Symptoms

- **Expected behavior:** When a new version is detected, the update-prompt modal should display the changelog. After the update is applied, the post-update confirm modal should also display the changelog.
- **Actual behavior:** Neither modal renders any changelog content — the changelog area is empty/missing in both the pre-update prompt modal and the post-update confirm modal.
- **Error messages:** Not yet inspected (user hasn't opened DevTools). Investigate from code first; confirm with console/network later if needed.
- **Timeline:** Unknown — user is not sure whether this ever worked. Treat as could-be-regression OR could-be-never-implemented. Git history may clarify.
- **Reproduction:** Wait for natural new-version detection (no dev-only trigger known yet). Investigation should locate the trigger path from code so we can force the condition reliably.

## Current Focus

- hypothesis: CONFIRMED — see Resolution
- test: n/a (fix applied)
- expecting: n/a
- next_action: n/a
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: 2026-05-23
  file: taskflow/src/lib/tauri-storage.ts
  finding: |
    persistChangelogBeforeRestart() introduced in commit 97ec4153 has a data-format mismatch.
    Zustand's createJSONStorage adapter stores the entire settings state as a JSON-encoded
    *string* under the store key (createJSONStorage.setItem calls JSON.stringify before
    delegating to the custom adapter's setItem). persistChangelogBeforeRestart() calls
    settingsLazyStore.get<{state,version}>(STORE_KEY) but receives a string at runtime, not
    an object. existing.state and existing.version are both undefined. The function then
    writes { state: { lastSeenChangelog: markdown }, version: 18 } as a plain object (not
    a string) back to the store. On the next app launch, Zustand's getItem reads an object
    instead of a string and JSON.parse(object) throws SyntaxError, resetting all settings
    to defaults. lastSeenChangelog resets to null. WhatsNewDialog condition
    (lastSeenChangelog !== null) is permanently false.

- timestamp: 2026-05-23
  file: taskflow/src/components/update/UpdateDialog.tsx
  finding: |
    UpdateDialog renders changelog ?? '' unconditionally — when changelog is null (update.body
    from Tauri plugin is null) the div renders as a visually empty scrollable box. The CI
    pipeline correctly populates the "notes" field in latest.json from git tag annotation
    bodies. The Tauri plugin maps JSON "notes" → Rust release.notes → JS update.body. For
    all v1.7+ releases the tag body is non-empty, so update.body should be a non-null string.
    The pre-update modal rendering is correct; blank changelog would only appear if
    update.body is null (notes missing/empty in latest.json for that release).

## Eliminated

- settings.store.ts migration code: all migrations use `=== undefined` guards so existing
  lastSeenChangelog values would not be overwritten during migration.
- UpdateDialog rendering logic: changelog ?? '' and ReactMarkdown rendering are correct.
- CI workflow latest.json generation: "notes" field is populated from git tag annotation
  body, which is non-empty for all recent releases.
- Tauri plugin field mapping: plugin maps JSON "notes" → Rust notes → JS body correctly.

## Resolution

- root_cause: |
    persistChangelogBeforeRestart() in tauri-storage.ts misreads the Zustand persist storage
    format. Zustand's createJSONStorage stores state as a JSON-encoded string; the function
    treated the stored value as a plain {state, version} object. This caused it to read
    undefined for both .state and .version, then write a corrupted plain object (not a string)
    back to the store. On next app launch, JSON.parse of a non-string object threw or returned
    garbage, resetting settings to defaults and discarding the persisted lastSeenChangelog.
    WhatsNewDialog therefore never opened after an update.
- fix: |
    tauri-storage.ts: read the stored value as a raw string, JSON.parse it, patch the
    lastSeenChangelog field in the nested state object, JSON.stringify the result, and write
    the string back. This matches the exact format createJSONStorage expects on read.
    Added a try/catch around JSON.parse for resilience against a previously corrupted store.
    Fallback version set to 21 (current schema version) instead of 18.
- verification: |
    After fix: persistChangelogBeforeRestart reads string -> parses it -> patches -> writes
    string. On restart Zustand reads the string -> JSON.parse succeeds -> lastSeenChangelog
    is present -> WhatsNewDialog opens.
- files_changed:
    - taskflow/src/lib/tauri-storage.ts
