---
status: resolved
trigger: "In jira issue sidebar, if it gets too narrow, the avatars get squished"
created: 2026-05-31
updated: 2026-05-31
---

# Debug: Jira issue sidebar avatars squished when narrow

## Symptoms
- Expected: assignee/reporter avatars stay circular at a fixed size as the issue detail sidebar narrows.
- Actual: avatars compress horizontally (round → oval) when the sidebar gets too narrow.
- Repro: narrow the right-hand issue detail sidebar; observe avatar rows (assignee, reporter).

## Root Cause
`CachedAvatar` root `<div>` (src/components/ui/cached-avatar.tsx:66) sets a fixed
`size-N` (width + height) but no `shrink-0`. The avatar rows in the sidebar are
`inline-flex items-center gap-1.5` containers (FieldsSection.tsx:456, :529) that also
hold a long display name. Flex items default to `flex-shrink: 1`, so when horizontal
space runs out the avatar's fixed width collapses below its set size while height stays
fixed — distorting the circular image into an oval.

## Fix
Added `shrink-0` to the shared `CachedAvatar` root div so the avatar never shrinks in
any flex context (sidebar, dropdown lists, inline rows).

- src/components/ui/cached-avatar.tsx:66 — `cn('relative', ...)` → `cn('relative shrink-0', ...)`

## Verification
- `biome check src/components/ui/cached-avatar.tsx` → clean.
- Single-line className change; no type/behavior impact beyond preventing horizontal compression.

## Files Changed
- taskflow/src/components/ui/cached-avatar.tsx
