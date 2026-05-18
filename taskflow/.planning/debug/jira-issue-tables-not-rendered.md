---
status: investigating
trigger: "On jira issue detail page tables are not rendered correctly"
created: 2026-05-15
updated: 2026-05-15
---

## Symptoms

- **Expected:** Pipe-delimited Jira table markup rendered as HTML table with rows and columns
- **Actual:** Raw pipe text shown with no conversion or styling (e.g., `|0905473496|Go Biznis 22 eur|...|`)
- **Timeline:** Uncertain; may work on some AIO pages but those may use a different format
- **Errors:** No console errors visible
- **Reproduction:** View a Jira issue detail page where the description contains pipe-delimited table markup

**Example table content from issue:**
```
B2B Voice rýchla výmena nebeží pre GoBiznis Tarif, nastava exception error
|0905473496|Go Biznis 22 eur|[url1|url2]|
|0908807289|Go Biznis 22 eur|[url1|url2]|
|0907742782|Go Biznis 22 eur|[url1|url2]|
```

Note: cells contain Jira-style named links `[display|url]` with pipe inside brackets — this may interfere with table parsing.

## Current Focus

hypothesis: ""
test: ""
expecting: ""
next_action: "gather initial evidence"
reasoning_checkpoint: ""

## Evidence

## Eliminated

## Resolution

root_cause: ""
fix: ""
verification: ""
files_changed: ""
