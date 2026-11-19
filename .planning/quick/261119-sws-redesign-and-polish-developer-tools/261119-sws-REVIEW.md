# Quick Task 261119-sws: Code Review (quick depth)

Reviewed range 6b54d35c..9c4d6f34. Fixes landed in 56449247.

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| CR-01 | Blocker | Copy as cURL put `$JIRA_TOKEN` inside single quotes, so the shell never expanded it; every non-GitLab source got `$JIRA_TOKEN` | **Fixed**: double-quoted per-source vars (JIRA/GITLAB/AIO/TEMPO_TOKEN); test failed before the fix and passes after |
| WR-05 | Warning | A facet selection survives Clear and eviction; once its value drops out of the options it can't be deselected | **Fixed**: per-tab Clear and Clear all call `resetFacets` |
| WR-01 | Warning | Header redaction in apiFetch only handles plain-object headers; request bodies and Copy URL keep token-like params | Open. The app's own fetchers all pass plain objects (verified for jira/gitlab/aio/tempo), so this is low risk |
| WR-02 | Warning | CacheInspector "ago" times are memoized by the React Compiler and can freeze; it reads the mutable `query` object | Open. Check at UAT |
| WR-03 | Warning | Stale flag uses only the client default staleTime and ignores per-query staleTime | Open |
| WR-04 | Warning | Large bodies are formatted and stringified unmemoized on each render; filter lowercases full bodies | Open. Perf only, check at UAT with big responses |
| WR-06 | Warning | Overlay-button rows have no visible focus ring, every row is a tab stop, `aria-pressed` is used instead of `aria-current`, and the resize handle has no keyboard support | Open |
| WR-07 | Warning | Cache snapshot notifies every 1s tick even when nothing changed | Open; the re-render is partly intentional (stale-by-time) |
| IN-01..05 | Info | Tooltip under pointer-events-none; capText chars vs bytes; useListKeyboard memo defeated; Escape bubbling; DebugModeSection duplicates popover toggles | Open |
