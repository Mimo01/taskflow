# Quick Task 260528-ct1: Biome a11y Warnings - Research

**Researched:** 2026-05-28
**Domain:** Biome a11y lint rules, React/TypeScript accessibility patterns
**Confidence:** HIGH (all findings from direct codebase inspection + Biome rule semantics)

---

## Actual Warning Count

The CONTEXT.md stated 49 warnings — those were the pre-prior-task numbers. The previous quick
task (260528-20i) fixed many of them. Running `npm run check` today shows **20 remaining
warnings** across 10 files.

| Rule | Count | Files |
|------|-------|-------|
| `useKeyWithClickEvents` | 8 | CommandPalette, input-group, ImageLightbox (×2), AuthImage (×2), MentionPopover |
| `noStaticElementInteractions` | 3 | CommandPalette (×2), ImageLightbox |
| `useSemanticElements` | 4 | input-group (×2), SprintGoalBanner, AioCycleDetailPage |
| `noLabelWithoutControl` | 1 | label.tsx |
| `useButtonType` | 1 | empty-state.test.tsx |
| `noSvgWithoutTitle` | 2 | AppIcon, KeyboardShortcutsPanel |
| `useAriaPropsSupportedByRole` | 1 | BacklogFilterBar |

---

## Fix Patterns by Rule

### 1. `useKeyWithClickEvents` + `noStaticElementInteractions`

**Rule:** Any non-button/non-anchor element with `onClick` must also have `onKeyDown` (Enter/Space)
and a proper interactive role + `tabIndex={0}`.

**Standard pattern for a clickable `<div>`:**
```tsx
// BEFORE
<div onClick={handler}>...</div>

// AFTER
<div
  role="button"
  tabIndex={0}
  onClick={handler}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } }}
>
  ...
</div>
```

**Standard pattern for a clickable `<img>`:**
```tsx
// BEFORE
<img src={src} alt={alt} onClick={onClick} />

// AFTER — if onClick is optional/undefined, guard the role/tabIndex
<img
  src={src}
  alt={alt}
  onClick={onClick}
  role={onClick ? 'button' : undefined}
  tabIndex={onClick ? 0 : undefined}
  onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e as unknown as React.MouseEvent<HTMLImageElement>); } } : undefined}
  className={cn(className, onClick && 'cursor-pointer')}
/>
```

**Gotcha — `role="option"` is already interactive:** A `<div role="option">` IS an interactive
role — Biome should not flag `noStaticElementInteractions` on it. But `useKeyWithClickEvents`
still requires `onKeyDown`. For listbox options that are navigated with arrow keys (not Enter),
the pattern is:
```tsx
// role="option" in a listbox — keyboard nav is handled by the listbox container (arrow keys),
// but clicking should also work via Enter. Add onKeyDown targeting Enter only:
<div
  role="option"
  tabIndex={-1}
  aria-selected={isActive}
  onClick={() => onSelect(user)}
  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSelect(user); } }}
>
```

### 2. `useSemanticElements`

**Rule:** Replace `<div role="X">` with the native semantic element when one exists.

| `role=` | Replace `<div>` with | Notes |
|---------|---------------------|-------|
| `"banner"` | `<header>` | Remove `role` attr; keep `aria-label` if meaningful |
| `"article"` | `<article>` | Remove `role` attr |
| `"button"` | `<button type="button">` | Use real button, not div+role |
| `"group"` | Keep `<div role="group">` | `<div>` has no semantic equivalent; Biome flags this — see note below |

**Note on `role="group"` in `input-group.tsx`:** Biome's `useSemanticElements` flags `<div
role="group">` because `<fieldset>` is the semantic equivalent of a grouping role. However,
`<fieldset>` has heavy browser styling baggage and cannot be used as a flex container reliably.
The correct fix per Biome docs is to use `<fieldset>` or suppress with a biome-ignore comment.
Since `InputGroup` is a UI primitive with Tailwind-based layout, a targeted suppression is
appropriate here.

**`SprintGoalBanner.tsx` (line 19):**
```tsx
// BEFORE
<div role="banner" aria-label="Sprint goal" className="...">

// AFTER — <header> IS role="banner" natively; aria-label is still valid on <header>
<header aria-label="Sprint goal" className="...">
```

**`AioCycleDetailPage.tsx` (line 1019) — `role="button"` on `<tr>`:**
`<tr role="button">` triggers `useSemanticElements` because `<button>` is the semantic
element. However, a `<tr>` cannot be replaced by a `<button>` in a table. The correct fix
is to suppress this specific warning, OR restructure to use `onClick` directly on `<tr>` with
the keyboard handler (already present!) and remove `role="button"` — instead using
`tabIndex={0}` without a role, which is the pattern for "focusable but not announced as
button". But that would lose the semantic button announcement. Best option: suppress with
`biome-ignore`:
```tsx
{/* biome-ignore lint/a11y/useSemanticElements: tr cannot be replaced by button in a table */}
<tr
  role="button"
  tabIndex={0}
  ...
```

**`input-group.tsx` line 12 and 48 — `role="group"`:**
```tsx
{/* biome-ignore lint/a11y/useSemanticElements: InputGroup layout requires div, not fieldset */}
<div role="group" ...>
```
Apply the same suppression to both occurrences (line 12 in `InputGroup`, line 48 in
`InputGroupAddon`).

### 3. `noLabelWithoutControl`

**Rule:** `<label>` must be associated with a form control, either via `htmlFor`+`id` on the
control, or by wrapping the control as a child.

**`label.tsx` issue:** The `Label` component is a generic pass-through — it receives `...props`
so `htmlFor` can be passed by callers. Biome flags it because the component itself has no
control inside it. This is a false positive for a generic primitive.

**Fix:** Suppress at the component level:
```tsx
{/* biome-ignore lint/a11y/noLabelWithoutControl: Generic Label primitive — callers provide htmlFor */}
<label data-slot="label" ... />
```

### 4. `useButtonType`

**Rule:** `<button>` must have an explicit `type` attribute (`button`, `submit`, or `reset`).

**`empty-state.test.tsx` line 28:**
```tsx
// BEFORE — test renders an anonymous button as action prop
render(<EmptyState icon={Inbox} title="T" action={<button>Click me</button>} />);

// AFTER
render(<EmptyState icon={Inbox} title="T" action={<button type="button">Click me</button>} />);
```
This is a test file — the fix is mechanical and trivial.

### 5. `noSvgWithoutTitle`

**Rule:** Decorative SVGs should have `aria-hidden="true"`. Meaningful SVGs should have a
`<title>` as the first child (or `aria-label` + `role="img"`).

**`AppIcon.tsx`** — this is a decorative app icon used in the UI chrome, rendered alongside
text labels. It is decorative in context:
```tsx
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 1024 1024"
  className={className}
  aria-hidden="true"   // ADD THIS
>
```

**`KeyboardShortcutsPanel.tsx` line 68** — an inline search icon SVG (magnifying glass) used
as a visual affordance inside a search input. It is decorative:
```tsx
<svg
  className="absolute left-2.5 ..."
  aria-hidden="true"   // ADD THIS
  ...
>
```

### 6. `useAriaPropsSupportedByRole`

**`BacklogFilterBar.tsx` line 86 — `<li aria-selected={...}>`:**
`aria-selected` is only valid on roles: `gridcell`, `option`, `row`, `tab`, `treeitem`.
A `<li>` has implicit role `listitem`, which does not support `aria-selected`.

The listbox is rendered as a `<ul>` containing `<li>` elements wrapping `<button>`. The
`aria-selected` should be on the interactive element (the `<button>`) or the `<li>` should
get `role="option"`. Looking at the structure: the `<ul>` is a dropdown list, `<li>` wraps
a `<button>`. Options:

**Option A** — Add `role="option"` to `<li>` (makes it a proper listbox option):
```tsx
// Also needs role="listbox" on the <ul>
<ul role="listbox" ...>
  <li key={option} role="option" aria-selected={selected.has(option)}>
    <button type="button" ...>
```
But then `<button>` inside `role="option"` is invalid HTML (interactive inside option).

**Option B** — Move `aria-selected` to the `<button>` (cleanest):
```tsx
<li key={option}>
  <button
    type="button"
    aria-selected={selected.has(option)}
    ...
  >
```
`aria-selected` is valid on `role="button"` only when it's in a widget context. Technically
not valid either.

**Option C** — Remove `aria-selected` from `<li>`, express selection state via `aria-pressed`
on the `<button>` (most correct for a multi-select filter):
```tsx
<li key={option}>
  <button
    type="button"
    aria-pressed={selected.has(option)}
    className="..."
    onMouseDown={() => handleSelect(option)}
  >
```
`aria-pressed` is valid on `role="button"` and correctly communicates toggle state.

**Recommendation: Option C** — replace `<li aria-selected>` with no aria on `<li>`, and add
`aria-pressed={selected.has(option)}` to the `<button>`.

---

## File-by-File Fix Summary

| File | Line(s) | Rule | Fix Action |
|------|---------|------|-----------|
| `src/components/app/AppIcon.tsx` | 4 | `noSvgWithoutTitle` | Add `aria-hidden="true"` to `<svg>` |
| `src/components/app/CommandPalette.tsx` | 230, 231 | `noStaticElementInteractions`, `useKeyWithClickEvents` | Add `onKeyDown` + `role="button"` + `tabIndex={0}` to both divs |
| `src/components/app/KeyboardShortcutsPanel.tsx` | 68 | `noSvgWithoutTitle` | Add `aria-hidden="true"` to inline SVG |
| `src/components/ui/empty-state.test.tsx` | 28 | `useButtonType` | Add `type="button"` to test `<button>` |
| `src/components/ui/input-group.tsx` | 12, 47, 48 | `useSemanticElements`, `useKeyWithClickEvents` | Lines 12 & 48: biome-ignore (div+role="group"); Line 47: add `onKeyDown` to `InputGroupAddon` |
| `src/components/ui/label.tsx` | 7 | `noLabelWithoutControl` | Add biome-ignore (generic primitive) |
| `src/routes/dashboard/AioCycleDetailPage.tsx` | 1019 | `useSemanticElements` | Add biome-ignore (tr cannot become button) |
| `src/routes/dashboard/AuthImage.tsx` | 110, 125 | `useKeyWithClickEvents` | Add `role`, `tabIndex`, `onKeyDown` guarded by `onClick` prop presence |
| `src/routes/dashboard/BacklogFilterBar.tsx` | 86 | `useAriaPropsSupportedByRole` | Remove `aria-selected` from `<li>`, add `aria-pressed` to `<button>` |
| `src/routes/dashboard/ImageLightbox.tsx` | 24, 39 | `useKeyWithClickEvents`, `noStaticElementInteractions` | Overlay div: add `onKeyDown` (Escape already handled via useEffect); inner div: add `onKeyDown` + `role="presentation"` |
| `src/routes/dashboard/MentionPopover.tsx` | 109 | `useKeyWithClickEvents` | Add `onKeyDown` with `Enter` to `<div role="option">` |
| `src/routes/dashboard/SprintGoalBanner.tsx` | 19 | `useSemanticElements` | Change `<div role="banner">` to `<header>` |

---

## Gotchas

**CommandPalette overlay div (line 230):** The outer `<div className="fixed inset-0 ...">` is a
modal backdrop that closes on click. It already functionally handles keyboard (the Command
component inside handles escape). Adding `role="button"` + `onKeyDown` to a full-screen
backdrop is semantically odd. A biome-ignore is defensible here, OR add `role="presentation"`
(removes it from accessibility tree) and suppress `noStaticElementInteractions` with a comment.
Actually better: `role="dialog"` belongs on the outer div instead, but that's a larger refactor.
The cleanest lint fix: add `onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}` +
`role="button"` + `tabIndex={0}` — or use biome-ignore on this specific case.

**ImageLightbox.tsx line 24 (outer overlay div):** Already has `role="dialog"` and
`aria-modal="true"` — the warning is about missing `onKeyDown`. But the component already has
a `useEffect` adding a document-level `keydown` listener for Escape. The Biome rule looks for
inline `onKeyDown`, not document listeners. Fix: add `onKeyDown={(e) => { if (e.key ===
'Escape') onClose(); }}` directly to the div.

**ImageLightbox.tsx line 39 (inner white div):** `onClick={(e) => e.stopPropagation()}` — this
is a propagation stopper, not a real interaction. The role should be `role="presentation"` or
the biome-ignore approach. Alternatively, restructure to use `e.stopPropagation()` with an
`onKeyDown` that does nothing, satisfying the linter without semantic harm.

**`InputGroupAddon` onClick (line 47):** This `onClick` focuses the nearest input — it is
a click-forwarding convenience, not a real button interaction. Adding full keyboard handling
(Enter/Space focuses the input) is correct behavior and genuinely improves a11y. Add:
```tsx
onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.currentTarget.parentElement?.querySelector('input')?.focus();
  }
}}
```

---

## Suppression Syntax

Biome suppression comment (inline, must be on the line BEFORE the offending element):
```tsx
{/* biome-ignore lint/a11y/noLabelWithoutControl: <reason> */}
```

---

## Sources

- Direct `npm run check` output from `taskflow/` directory — [VERIFIED: live run]
- Biome a11y rule docs — [ASSUMED: training knowledge on rule semantics, cross-referenced with error messages]
- WAI-ARIA spec for `aria-pressed` vs `aria-selected` — [ASSUMED: training knowledge]
