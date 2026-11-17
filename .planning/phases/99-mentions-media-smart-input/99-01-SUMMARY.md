---
phase: 99-mentions-media-smart-input
plan: 01
subsystem: wiki-editor
tags: [tiptap, host-contract, deps]
requires: []
provides:
  - "WikiEditorHost type and optional host prop on WikiEditor"
  - "WikiHostBridge per-editor reactive host store (getHost/useHost/previews)"
  - "@tiptap/suggestion, @tiptap/extension-bubble-menu, @floating-ui/dom installed"
affects: [99-02, later phase 99 plans, phase 100 hosts]
tech-stack:
  added: ["@tiptap/suggestion@3.34.0", "@tiptap/extension-bubble-menu@3.34.0", "@floating-ui/dom@^1.7.6"]
  patterns: ["editor.storage store read via useSyncExternalStore", "state in closures, not storage properties"]
key-files:
  created:
    - taskflow/src/components/wiki-editor/host.ts
    - taskflow/src/components/wiki-editor/host.test.ts
  modified:
    - taskflow/package.json
    - taskflow/package-lock.json
    - taskflow/src/components/wiki-editor/types.ts
    - taskflow/src/components/wiki-editor/extensions.ts
    - taskflow/src/components/wiki-editor/WikiEditor.tsx
key-decisions:
  - "Host store keeps mutable state in closure variables because tiptap copies the storage object; the editor is bound through a plugin view"
requirements-completed: [INPUT-01, INPUT-02, INPUT-03, INPUT-05]
duration: ~15min
completed: 2026-11-17
---

# Phase 99 Plan 01: Host contract and deps Summary

Optional `host` prop and a per-editor reactive host store (`WikiHostBridge`) reachable from module-scope extensions and node views, plus the three approved editor-input packages.

## Tasks

1. Package legitimacy gate: approved by the user for all three packages (verified on npm by the orchestrator). No commit.
2. Deps installed: commit bdf2a23e. bundle-guard and wiki-editor suite green.
3. Host contract + bridge + WikiEditor effect: commit 8a34803e. host.test.ts covers all six behaviors; schema-parity, compiler-compat, bundle-guard, tsc, biome clean.

## Deviations from Plan

**1. [Rule 3 - Blocking] npm saved caret ranges and bumped floating-ui**
- `npm install` wrote `^3.34.0` for the two tiptap packages and `@floating-ui/dom ^1.8.0`. Rewrote package.json to the planned exact pins and `^1.7.6`, re-ran install.
- The lockfile still moves `@floating-ui/dom`/`core`/`utils` 1.7.x to 1.8.0 / 0.2.12 (already-present transitive deps of the approved package, within caret range). No unrelated packages changed.

**2. [Rule 1 - Bug] Plan's storage design (`this.storage` mutable properties) does not work**
- Tiptap hands extensions a copy of the storage object, so properties set on one copy were invisible to the store's methods. State (`bound editor`, current host, version) lives in closure variables; the bridge binds the editor from a ProseMirror plugin view and uses `this.editor.storage.wikiHost`.
- Files: host.ts. Commit 8a34803e.

## Known Stubs
None.

## Threat Flags
None. Store holds only keys, attachment metadata and callbacks; blob URLs revoked on destroy.

## Self-Check: PASSED
- host.ts, host.test.ts exist; commits bdf2a23e and 8a34803e exist.
