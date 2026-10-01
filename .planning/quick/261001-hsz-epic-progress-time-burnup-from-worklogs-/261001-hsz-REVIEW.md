---
status: fixed
reviewed: d3e71dd6..c653997e
fixed_in: f4af948a
depth: quick
---

# 261001-hsz Code Review

Critical 0 · Warning 5 · Info 3. Findings verified against the code before fixing; regression tests proven to fail pre-fix.

| ID | Finding | Disposition |
|----|---------|-------------|
| WR-01 | Worklog top-up fails open (non-ok → keeps 20 embedded, silent understatement) | Fixed via WR-03 reconcile instead of strict mode: a strict top-up would turn one 500 into a whole-chart Retry and broke the intentional keep-embedded test. Shortfall vs `aggregatetimespent` now lands on today, so totals stay correct. |
| WR-02 | Worklog query key omits story set; disabled query = endless skeleton | Fixed: key includes sorted story keys; `isLoading` + "No worklog data" fallback |
| WR-03 | Chart Logged (worklog sum) can diverge from tiles (`aggregatetimespent`) | Fixed: per-story unattributed remainder added on today; test asserts final gap == Remaining |
| WR-04 | Bar tooltip triggers not exposed to assistive tech | Fixed: `role="img"` + `aria-label` on quick-peek and story time bars (no tabIndex — both sit in clickable rows) |
| WR-05 | Unvalidated keys interpolated into JQL / URL | Fixed: issue-key regex filter + `encodeURIComponent` |
| IN-01 | Search results not deduped | Fixed: dedupe by key |
| IN-02 | Empty/disabled query stays pending | Fixed with WR-02 |
| IN-03 | Docstring says local day; it's author offset | Fixed docstring (clamp to today already prevents axis breakage) |
