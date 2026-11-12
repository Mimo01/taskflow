---
depth: quick
critical: 0
warnings: 2
info: 2
---

# Review 261112-cmy (commit 86c11a8a)

## WR-01 — Throw mid-loop drops the dev log — NOT AN ISSUE
`tryDispatchOsNotification` wraps everything in try/catch and returns `'error'`; it cannot throw. No change.

## WR-02 — Group title counts denied/error as "dispatched" — FIXED
`dispatched = entries.length - skipped` overstated what reached the OS (in dev on macOS most sends are `error`). Title now breaks down by outcome.

## IN-01 — Double DEV gate — KEPT (intentional)
Call-site `import.meta.env.DEV` guard lets Vite dead-code-eliminate the call in prod; the in-helper guard keeps the helper safe standalone (per RESEARCH.md).

## IN-02 — Full item logged; dispatchLog allocated in prod — ACCEPTED
Dev-only output; the array allocation in prod is negligible.
