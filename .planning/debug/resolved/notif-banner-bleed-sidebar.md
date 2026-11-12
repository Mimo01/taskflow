---
status: resolved
trigger: "When a new notification in app arrives and i have sidebar open, it can bleed through and not be on top of content"
created: 2026-11-12
updated: 2026-11-12
---

## Symptoms
- expected: in-app notification banner is an opaque card floating over the page
- actual: with the peek sidebar open, the banner looks see-through; page content bleeds through it

## Resolution
- root_cause: NotificationRow (variant="banner") still applied PEEKED_ROW_CLASS (`bg-primary/10`) when the
  banner's issue was the one open in the peek sidebar, and the read-state 82% color-mix fill for read items.
  `cn` (tailwind-merge) keeps the last bg-* class, so the banner's opaque `bg-card` was dropped and the
  floating card rendered at 10% (or 82%) opacity. Stacking was fine (portal to body, z-[70]).
- fix: banner variant gets only `bg-card`; read translucency + peek tint apply to list rows only.
- verification: new NotificationBanners tests (peeked / read → only `bg-card`) failed pre-fix, pass after;
  src/routes/notifications 290/290, biome + tsc clean.
- files_changed: src/routes/notifications/NotificationRow.tsx, src/routes/notifications/NotificationBanners.test.tsx
