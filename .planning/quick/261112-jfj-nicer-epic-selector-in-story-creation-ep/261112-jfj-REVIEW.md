---
quick_id: 261112-jfj
depth: quick
reviewed_range: 6b29db60..1f6fc321
critical: 0
warnings: 6
info: 3
---

# Code Review — 261112-jfj

## Critical
None.

## Warnings
- **WR-01** Search failures render as "No open epics match" and are cached for 60s (`services/jira/epics.ts:81-101`, `components/ui/use-epic-search.ts:36-45`). Fix: throw on failure (keep the withKey fallback), `retry: 1`, render an error row on `isError`.
- **WR-02** The selected epic's pill can flash the raw key: `onSearchResults` resets `results` on every key change, and the create modal never seeds `['jira-issue-name', …]` (`epic-picker.tsx:62-73,220-229`). Fix: `placeholderData: keepPreviousData`, and keep the picked option / seed the cache inside the picker.
- **WR-03** Keyboard/a11y gaps (`epic-picker.tsx:59-119`):
  - `activeIndex` is not reset when the results change.
  - The active row is not scrolled into view.
  - The input has no combobox, `aria-activedescendant` or `aria-controls` attributes.
  - Enter with no highlighted row does not pick the top hit.
- **WR-04** The optimistic `jira-issue-name` seed is not rolled back, and the base URL in its key comes from a different source than the picker's query key (`FieldsSection.tsx:848-858`). Fix: a shared key helper.
- **WR-05** `fetchEpicSummary` puts the key and field ids into the URL unencoded (`epics.ts:112`).
- **WR-06** An epic-link change does not invalidate `['jira-epic-search']` or the old/new epics' lightweight entries (`useFieldMutation.ts:92-97`).

## Info
- **IN-01** The `epicIssue` prop and its query in `IssueDetailSidebar` are dead; check whether the `epicColorToTailwind` import is still used.
- **IN-02** JQL token/stopword behaviour is worth documenting in a comment.
- **IN-03** Missing tests: escaping edge cases, the withKey fallback, arrow-key + Enter.

## Sound
- **JQL escaping:** OK; the key term is regex-validated.
- **Effect loops:** none found; `EMPTY` is stable.
- **Optimistic mounting:** the picker is always mounted, and a test covers it.
- **React Compiler:** no module-level reads in render.
