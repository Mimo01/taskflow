---
phase: quick-261111-ezr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/notifications/NotificationRow.tsx
  - taskflow/src/routes/notifications/NotificationAvatar.tsx
  - taskflow/src/routes/notifications/NotificationRow.test.tsx
autonomous: false
requirements: [QUICK-261111-ezr]

must_haves:
  truths:
    - "Unread notification cards have a faint blue-tinted surface and a blue-500/30 ring; read cards stay plain bg-card ring-foreground/10"
    - "No unread dot exists on any card; left padding equals right padding at default, compact and comfortable density"
    - "Hovering/focusing an unread card keeps the tint (accent mixed into the tinted surface) and the hover tray + its fade have no seam against the hovered card"
    - "The event badge cut-out ring matches the card surface in both states (tinted when unread)"
    - "Read vs unread changes only class strings / aria prefix, never the DOM tree"
  artifacts:
    - path: "taskflow/src/routes/notifications/NotificationRow.tsx"
      provides: "Tinted unread card, dot removed, symmetric padding, updated STYLE CONTRACT A + H"
      contains: "--card-bg"
    - path: "taskflow/src/routes/notifications/NotificationAvatar.tsx"
      provides: "Badge ring follows the card surface variable"
      contains: "ring-(--card-bg)"
    - path: "taskflow/src/routes/notifications/NotificationRow.test.tsx"
      provides: "Assertions moved from data-unread dot to data-unread-card styling"
  key_links:
    - from: "NotificationRow card div"
      to: "--card-hover / tray background"
      via: "--card-hover defined as color-mix(accent, var(--card-bg)), so hover bg and tray bg both derive from the state's surface"
      pattern: "card-hover:color-mix\\(in_oklab,var\\(--color-accent\\)_50%,var\\(--card-bg\\)\\)"
---

<objective>
Make unread notifications clearly distinguishable via a tinted card (per CONTEXT "Chosen direction: Tinted card"), remove the 6px unread dot and the extra left padding that existed only for its slot.

Purpose: today's ring-foreground/20 vs /10 + 6px dot is too subtle and the dot looks off.
Output: restyled NotificationRow card, badge ring tracking the surface, updated tests, updated STYLE CONTRACT.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261111-ezr-better-design-for-unread-notifications/261111-ezr-CONTEXT.md
@taskflow/src/routes/notifications/NotificationRow.tsx
@taskflow/src/routes/notifications/NotificationRow.test.tsx
@taskflow/src/lib/peek-highlight.ts

Paths: .planning and git are at the outer repo root (/Users/mimo/Documents/Projects/taskflow); npm, vitest, biome run in the inner app dir (/Users/mimo/Documents/Projects/taskflow/taskflow). The pre-commit hook runs the full vitest suite, so code + test changes land in ONE commit.

Facts gathered during planning (do not re-derive):
- Card root is the div with data-card / data-unread-card (~line 540). Its base class string currently holds `[--card-hover:color-mix(in_oklab,var(--color-accent)_50%,var(--color-card))]`, `pr-3 pl-4`, `density-compact:pr-2.5 density-compact:pl-3.5`, `density-comfortable:pr-3.5 density-comfortable:pl-5`, `hover:bg-(--card-hover) focus-within:bg-(--card-hover)`. State string: unread `bg-card ring-1 ring-foreground/20`, read `bg-card ring-1 ring-foreground/10`. `peeked && PEEKED_ROW_CLASS` comes after (bg-primary/10 — cn/tailwind-merge lets it win; keep it last).
- The dot is the `<span data-unread=...>` right after the overlay button (~lines 558-564). It is the only data-unread consumer in src (non-test).
- Hover tray (data-tray, ~line 607) uses bg-(--card-hover) and before:from-(--card-hover) — it follows automatically once --card-hover derives from the surface.
- NotificationAvatar.tsx badge (~line 71) uses `ring-2 ring-card group-hover/row:ring-(--card-hover) group-focus-within/row:ring-(--card-hover)`; `ring-card` would show a white/plain cut-out on a tinted unread card.
- Theme: --primary is achromatic (light oklch 0.205, dark 0.922); --card light 1 / dark 0.205; --accent light 0.97 / dark 0.269. So (USER DECISION: tint is blue-500, NOT --primary — see CONTEXT amendment); also in LIGHT mode accent (0.97) mixed into a ~0.96 tinted surface barely changes it — hover on unread must be checked visually.
- List rows' pl-[1.125rem] (~lines 413, 474) are relative to the content column, not the card — leave them alone.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Tinted unread card, remove dot, symmetric padding (code + tests, one commit)</name>
  <files>taskflow/src/routes/notifications/NotificationRow.tsx, taskflow/src/routes/notifications/NotificationAvatar.tsx, taskflow/src/routes/notifications/NotificationRow.test.tsx</files>
  <behavior>
    - Unread card (data-unread-card="true") className contains `ring-blue-500/30` and `bg-(--card-bg)` and a `[--card-bg:color-mix(in_oklab,var(--color-blue-500)_N%,var(--color-card))]` declaration; does NOT contain `ring-foreground/20`.
    - Read card className contains `bg-card`, `ring-1`, `ring-foreground/10`; no blue tint declaration.
    - Both states: card className contains `--card-hover:color-mix(in_oklab,var(--color-accent)_50%,var(--card-bg))` and `hover:bg-(--card-hover)`; tray still uses `before:from-(--card-hover)`.
    - No element with a `data-unread` attribute renders (querySelector('[data-unread]') is null) in either state; aria "Unread. " prefix behaviour unchanged.
    - Padding parity: card className contains `px-3`, `density-compact:px-2.5`, `density-comfortable:px-3.5` and no `pl-4` / `pl-3.5` / `pl-5` / `pr-` tokens.
    - Badge className contains `ring-(--card-bg)` (not `ring-card`) plus the existing group-hover/focus `ring-(--card-hover)` tokens.
    - Read vs unread DOM parity test: after stripping state tokens (bg-card, bg-(--card-bg), [--card-bg:…], ring-*, font-*, text-foreground, text-muted-foreground), card classes and detail outerHTML are identical.
  </behavior>
  <action>
NotificationRow.tsx (per CONTEXT "Chosen direction: Tinted card"):
1. Introduce a per-state surface variable `--card-bg`. In the state class string: unread = `[--card-bg:color-mix(in_oklab,var(--color-blue-500)_6%,var(--color-card))] bg-(--card-bg) ring-1 ring-blue-500/30`; read = `[--card-bg:var(--color-card)] bg-card ring-1 ring-foreground/10` (read stays visually unchanged; it still carries literal bg-card). 6% is the starting tint (Claude's discretion; tune in Task 2 within 5-8%).
2. In the base class string change the hover var to `[--card-hover:color-mix(in_oklab,var(--color-accent)_50%,var(--card-bg))]` so hover/focus = accent mixed into the TINTED surface for unread (and into card for read), and the tray (bg-(--card-hover), before:from-(--card-hover)) follows with no seam. Keep hover:bg-(--card-hover) focus-within:bg-(--card-hover) as is.
3. Replace `pr-3 pl-4` with `px-3`, `density-compact:pr-2.5 density-compact:pl-3.5` with `density-compact:px-2.5`, `density-comfortable:pr-3.5 density-comfortable:pl-5` with `density-comfortable:px-3.5`. Edit these tokens by hand in this one class string — no bulk find/replace across the file.
4. Delete the whole `<span data-unread ...>` dot element. Keep data-unread-card on the root. Title weight/colour logic stays (semibold foreground unread / normal muted read).
5. Update the STYLE CONTRACT header: A — skeleton starts with the 36px lead directly (no unread-dot slot); padding is symmetric left/right at every density. H — card surface = shared Card look; read = bg-card ring-foreground/10; unread = faint blue tint (--card-bg, color-mix blue-500 ~6% into card) + ring-blue-500/30; hover = accent 50% mixed into --card-bg (tray uses the same --card-hover); read vs unread changes ONLY surface tint, ring, title weight/colour. Nothing moves. Also keep the D-05 bullet.

NotificationAvatar.tsx: in the badge class swap `ring-card` for `ring-(--card-bg)` (only that token) so the cut-out matches the tinted surface; hover/focus tokens unchanged. --card-bg is always defined by the parent card in both states; check NotificationAvatar has no other render context (grep its usages) — if it is rendered outside a NotificationRow card, use `ring-(--card-bg,var(--color-card))` fallback form instead.

NotificationRow.test.tsx — update, don't just delete:
- 'marks unread via aria prefix and dot' (~line 199): rename to aria prefix + card-level styling; assert `[data-unread-card="true"]` / `"false"` and that `[data-unread]` is null in both.
- 'uses the shared Card surface…' (~line 368): keep read assertions; add padding assertions (px-3, density-compact:px-2.5, density-comfortable:px-3.5).
- 'unread cards get a stronger ring…' (~line 379): unread expects ring-blue-500/30 and bg-(--card-bg) and the color-mix primary declaration (match `/var\(--color-blue-500\)_\d+%/`), not ring-foreground/20; read expects bg-card + ring-foreground/10 and no `--color-blue-500` in its class.
- 'keeps the unread dot inside the card padding' (~line 806): replace with 'has no unread dot and symmetric padding' — no [data-unread], card has px-3 and no pl-4.
- 'read vs unread only toggles…' (~line 814): drop the dot comparison; extend the strip regex to also drop `bg-\(--card-bg\)` and `\[--card-bg:` tokens.
- Add an assertion that the card's --card-hover declaration references var(--card-bg); add a badge assertion for ring-(--card-bg).
Also grep NotificationPopover.test.tsx / NotificationList.test.tsx (and all of src) for `data-unread"`/`[data-unread` usages without `-card` and update any found.

Run tests, biome check on the three files only (never biome --write on all of src), tsc. Commit code + tests together from the outer repo with explicit paths (`git commit -- <paths>`), then confirm with `git log -1 --stat`.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/notifications && npx biome check src/routes/notifications/NotificationRow.tsx src/routes/notifications/NotificationAvatar.tsx src/routes/notifications/NotificationRow.test.tsx && npx tsc --noEmit -p . && test "$(grep -rn 'data-unread[^-]' src | grep -c .)" = "0"</automated>
  </verify>
  <done>All notification tests pass; no data-unread dot anywhere in src; unread card tinted + ring-blue-500/30; read card unchanged; padding symmetric; STYLE CONTRACT A/H updated; one commit containing code + tests.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Visual check of tint, ring and hover in light and dark</name>
  <what-built>Tinted unread notification cards (blue-500 ~6% surface + ring-blue-500/30), no dot, symmetric padding, hover tint that keeps the unread surface and a seamless hover tray.</what-built>
  <how-to-verify>
    Before handing over, the executor renders screenshots itself (throwaway vite preview page importing NotificationRow with one unread + one read card, cached Chromium; preview vite needs `@source '../src'`), in light AND dark, normal and hovered (force hover via a class/state), at default/compact/comfortable density. Check: unread reads clearly vs read in both themes; hover on unread is visibly different from unread rest (the light-theme risk: accent 0.97 into ~0.96 tint is near-identical — if indistinguishable, raise the accent share or tint % and note the chosen values in SUMMARY); tray fade has no seam; badge cut-out matches the tinted surface; left gap equals right gap. Then the user:
    1. Run the app, open Notifications page and the tray popover.
    2. Compare unread vs read cards in light and dark theme.
    3. Hover an unread card: tint stays, tray has no seam.
    4. Switch density (compact/comfortable): left and right padding look equal, nothing shifts when marking read/unread.
  </how-to-verify>
  <resume-signal>Type "approved" or describe what to adjust (tint %, ring strength, hover)</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none | Pure presentational class-string change; no new input, data flow or dependency |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-ezr-01 | Information disclosure | NotificationRow styling | accept | No data handling changes; screenshots/fixtures use placeholder data only (no customer data in repo) |
</threat_model>

<verification>
- vitest src/routes/notifications green; biome clean on touched files; tsc clean.
- `grep -rn 'data-unread[^-]' taskflow/src` returns nothing.
- Screenshots in light/dark confirm unread distinction and hover tint.
</verification>

<success_criteria>
Unread cards are clearly identifiable in both themes by surface tint + blue ring, the dot is gone, padding is symmetric at all densities, hover/tray stay seamless, and the user approves the look.
</success_criteria>

<output>
Create `.planning/quick/261111-ezr-better-design-for-unread-notifications/261111-ezr-SUMMARY.md` when done (commit it; do not leave it untracked).
</output>
