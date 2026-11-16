---
status: partial
phase: 97-round-trip-engine
source: [97-VERIFICATION.md]
started: 2026-11-16T21:55:02Z
updated: 2026-11-16T21:55:02Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Jira honours the emitter's backslash escapes
Paste into a Jira test issue: `a \*b\* c`, `ping \[~admin] now`, `a \{code}x\{code} b`, and the bare URL `http://a.com/\_a\_`.
expected: Jira shows the literal characters with no bold, mention or code block. For the URL, note whether Jira keeps the backslashes in the link (this decides whether WR-01 is a TaskFlow-only defect).
result: [pending]

### 2. Jira parity for nesting, tables and panels (deferred 97-03 Task 3)
Compare Jira and WikiRenderer for mixed *# list nesting (D-01), header-less tables (D-02), and panels containing lists (D-12).
expected: WikiRenderer matches Jira for each.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
