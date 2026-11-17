---
phase: 99-mentions-media-smart-input
plan: 06
subsystem: wiki-editor
tags: [tiptap, suggestion, mentions, emoticons, input-rules]
requires: ["99-01", "99-03", "99-04"]
provides:
  - "searchPeople / peopleQueryKey shared server-side people search (rich and source mode)"
  - "WikiMentionSuggestion (@)"
  - "WikiEmoticonSuggestion (:), WikiEmoticonForce, openEmoticonSuggestion, filterEmoticons"
  - "Typed Jira emoticon token input rules in WikiInputRules"
affects: [99-12 registration, 99-13 source mode]
key-files:
  created:
    - taskflow/src/components/wiki-editor/suggestion/search.ts
    - taskflow/src/components/wiki-editor/suggestion/mention-suggestion.ts
    - taskflow/src/components/wiki-editor/suggestion/mention.test.tsx
    - taskflow/src/components/wiki-editor/suggestion/mention-search.test.ts
    - taskflow/src/components/wiki-editor/suggestion/emoticon-suggestion.ts
    - taskflow/src/components/wiki-editor/suggestion/emoticon.test.tsx
  modified:
    - taskflow/src/components/wiki-editor/input-rules.ts
    - taskflow/src/components/wiki-editor/input-rules.test.ts
key-decisions:
  - "WikiEmoticonForce has priority 1000: the suggestion plugin's allow() reads the force state from the partially built new state, so the force plugin must apply first"
requirements-completed: [INPUT-01, INPUT-06]
completed: 2026-11-17
---

# Phase 99 Plan 06: Mentions and emoticon input Summary

`@` mentions search Jira server-side per query (cached by the useAssignableUserSearch key, PAT read only inside queryFn); `:` offers the 16 Jira emoticons; typed `(/)`-style tokens convert on the closing paren.

## Tasks

1. People search and `@` suggestion: commit 2fe7fdf.
2. `:` suggestion, force plugin and token input rules: commit b3d04188 (committed by the orchestrator after the hook kept timing out under load; the same 6 route tests fail on main under that load).

## Deviations from Plan

**1. [Rule 1 - Test expectation] saved text trims the trailing space**
- Plan said saveWiki emits "Hi [~jdoe] "; the serializer trims, so the test asserts "Hi [~jdoe]" and separately asserts the doc keeps the trailing space with the caret after it.

**2. [Rule 3 - Blocking] Test files are .tsx and use a React harness**
- mention.test.ts and emoticon.test.ts became .tsx: headless `makeEditor` cannot mount the ReactRenderer popover, so tests use `useEditor` + `EditorContent` like lifecycle.test.tsx.

**3. [Rule 1 - Bug] Force plugin ordering**
- The force state was invisible to `allow()` until the force extension got priority 1000 (plugin state is applied in order and `allow` receives the new, partially built state).

**4. Pre-commit flakiness under load**: full-suite hook failed on unrelated route tests while sibling agents ran; recommitted without `--no-verify`.

## Known Stubs
None. Extensions are not registered in the live editor (plan 12 does that, by design).

## Threat Flags
None. Mitigations T-99-21..24 in place: PAT only in queryFn, key test asserts no token, mention id comes from Jira `name`, 250ms debounce + AbortSignal + 60s staleTime.

## Self-Check: PASSED (see commits in git log)
