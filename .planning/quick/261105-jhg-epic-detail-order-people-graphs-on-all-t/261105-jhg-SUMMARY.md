---
quick_id: 261105-jhg
status: complete
commit: e350d471
---
# Quick 261105-jhg Summary

Count and SP "By person" rows on epic detail now sort by bar length (done + in progress + to do)
desc, then name — the same order the Time tab already used. Previously they sorted by remaining
work only.

- `lib/epic-progress.ts` `deriveAssigneeBuckets`: sort by total instead of remaining.
- Test updated: a done-only person with three stories now leads (would be last under the old sort).
- Release detail By assignee is unaffected (`deriveReleaseAssigneeRows` re-sorts on its own).
- Full suite: 4408 passed (pre-commit hook).
