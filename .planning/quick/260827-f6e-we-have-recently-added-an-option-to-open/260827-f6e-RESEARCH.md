# Quick Task 260827-f6e: Right-click "open in browser" / "copy link" context menu — Research

**Researched:** 2026-08-27
**Domain:** Tauri v2 + React desktop app, base-ui `ContextMenu`, external-link browser selection
**Confidence:** HIGH (verified against local code + official base-ui docs)

## Summary

This is an additive feature on top of a working system (`openExternal.ts`, `list_browsers` Tauri command, `LinksSection.tsx`). The main risks are not "will it work" but three concrete integration traps: (1) base-ui's `ContextMenu.Trigger` renders a `<div>` by default, which will produce invalid/broken inline layout if wrapped directly around WikiRenderer's inline `<a>` elements inside `<p>` prose; (2) `list_browsers()` does filesystem-existence checks on every invocation and must be cached once per session, not re-fetched per right-click; (3) `navigator.clipboard.writeText()` can throw `NotAllowedError: Document is not focused` when called after a menu-close focus-return animation — a known Chromium/WebKit clipboard-API gotcha, not specific to Tauri, but real given base-ui's `ContextMenu.Item` closes the menu and returns focus to the trigger on click.

**Primary recommendation:** Build one shared `<LinkContextMenu href={url}>{children}</LinkContextMenu>` component. Fetch browsers once via a TanStack Query hook (`staleTime: Infinity`), pass `render={<span />}` (or the caller's own element) to `ContextMenuTrigger` so it never injects a block-level wrapper, add a new `openExternalWith(url, browserPath)` function to `openExternal.ts` for browser-specific opens (leaving `openExternal(url)` untouched for existing left-click call sites), and fire the clipboard write synchronously inside the `onClick` handler (not deferred) with a try/catch fallback that just silently no-ops per the existing "fail quietly, no toast" convention.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Browser detection (filesystem existence checks) | Rust/Tauri backend (`list_browsers`) | — | Already implemented; renderer has no filesystem access |
| Browser list caching for the session | Frontend (React/TanStack Query) | — | Avoid re-invoking a Tauri command with FS I/O on every right-click |
| Context menu UI + item list | Frontend (React, base-ui) | — | Pure presentation, no new backend surface needed |
| "Open in X" launch | Frontend → Tauri (`@tauri-apps/plugin-opener` `openUrl`) | — | Existing `openExternal.ts` boundary; extend, don't bypass |
| "Copy link" | Frontend (`navigator.clipboard`) | — | Existing precedent in `IssueDetailContent.tsx`; no plugin needed |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Browser detection | New Tauri command or renderer-side FS probing | Existing `list_browsers` (`src-tauri/src/lib.rs:96`) | Already implemented, cross-platform, filesystem-check-only (no subprocess), returns `[]` on failure never errors |
| Browser launch | New `Command::new(path).spawn()` per browser | `openUrl(url, browserPath)` from `@tauri-apps/plugin-opener`, via a new `openExternalWith` wrapper | `openExternal.ts` already owns this boundary; a second launch path would fork the fallback logic |
| Copy-to-clipboard | `@tauri-apps/plugin-clipboard-manager` (not installed) | `navigator.clipboard.writeText()` | Confirmed **no** clipboard plugin dependency exists in `package.json`/`Cargo.toml`/`tauri.conf.json` (grepped, zero hits); `IssueDetailContent.tsx`'s `handleCopyJiraLink` already proves the Web Clipboard API works reliably in this webview. Adding the plugin now would be an unnecessary new dependency for a capability that already works. |
| Copy feedback | New toast component | Reuse `copiedLink` boolean + `setTimeout` flash pattern from `IssueDetailContent.tsx:200-224` | Locked decision in CONTEXT.md; app has no toast library and `openExternal.ts` documents a "fail quietly, no toast" convention |

## Architecture Patterns

### Recommended shared component shape

```tsx
// src/components/ui/link-context-menu.tsx  (new file)
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent,
  ContextMenuItem, ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { useDetectedBrowsers } from '@/lib/useDetectedBrowsers'; // new, TanStack Query wrapper
import { openExternalWith } from '@/lib/openExternal';

export function LinkContextMenu({
  href,
  children,
  render, // optional: lets WikiRenderer pass render={<a href={href} onClick={...} {...rest} />}
}: {
  href: string;
  children?: React.ReactNode;
  render?: React.ReactElement;
}) {
  const { data: browsers = [] } = useDetectedBrowsers();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    // Fire synchronously inside the click handler — see Pitfall 3.
    navigator.clipboard.writeText(href).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 2000); },
      () => {}, // fail quietly, no toast
    );
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger render={render ?? <span className="contents" />}>
        {render ? undefined : children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => openExternalWith(href, null)}>
          Open in System Default
        </ContextMenuItem>
        {browsers.map((b) => (
          <ContextMenuItem key={b.path} onClick={() => openExternalWith(href, b.path)}>
            Open in {b.label}
          </ContextMenuItem>
        ))}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy link'}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
```

**Why a component, not a hook:** Six of the seven call sites (`BacklogPage`, `SubtasksPanel`, `SprintBoardTab`, `UnifiedTaskTable`, `NotificationRow`, `NotificationPopover`) wrap a discrete link-ish element (row, icon-button, or `<a>`) — a wrapper component matches `TaskCard.tsx`'s established `<ContextMenu><ContextMenuTrigger>{content}</ContextMenuTrigger>...</ContextMenu>` pattern with minimal churn. Only `WikiRenderer.tsx`'s `a` override needs the `render` escape hatch (see Pitfall 1) since it must stay a single inline `<a>`, not a wrapping element.

### Browser list caching (module-level via TanStack Query)

```ts
// src/lib/useDetectedBrowsers.ts (new)
import { useQuery } from '@tanstack/react-query';
import { tauriService } from '@/services/tauri';
import type { BrowserInfo } from '@/lib/openExternal';

export function useDetectedBrowsers() {
  return useQuery({
    queryKey: ['detected-browsers'],
    queryFn: () => tauriService.invoke<BrowserInfo[]>('list_browsers'),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false, // list_browsers never throws per its own contract; a rejection means IPC itself failed
  });
}
```
This reuses the app's existing "warm cache, `gcTime: Infinity`" convention (already used for avatar caching, Dashboard data — see PROJECT.md Key Decisions) instead of introducing a bespoke module-level promise cache. `LinksSection.tsx` could later be migrated to the same hook to eliminate its duplicate `useEffect`+`invoke` call, though that's out of scope unless requested — not doing so now means two independent code paths both call `list_browsers`, which is harmless (Tauri IPC + a handful of `Path::exists()` checks, no meaningful cost) but worth noting for the planner.

## Common Pitfalls

### Pitfall 1: `ContextMenuTrigger` defaults to a `<div>` — breaks inline flow in WikiRenderer
**What goes wrong:** `ContextMenu.Trigger` (base-ui) renders a `<div>` by default `[CITED: base-ui.com/react/components/context-menu]`. WikiRenderer's `a` override renders inline `<a>` tags inside markdown-generated `<p>` elements. Wrapping that `<a>` in a default `ContextMenuTrigger` produces `<p><div><a>...</a></div></p>` — a block element nested inside a paragraph, which is invalid HTML, breaks text flow (link drops to its own line), and can trigger hydration/DOM-nesting warnings.
**Why it happens:** base-ui's context menu is designed to wrap arbitrary block content (cards, rows) by default; it does not special-case inline usage.
**How to avoid:** Use the `render` prop on `ContextMenuTrigger` (it is `ContextMenuPrimitive.Trigger.Props`, which supports `render` per base-ui's composition model `[CITED: base-ui.com/react/handbook/composition]`) to render the trigger as the WikiRenderer's own `<a>` element directly — i.e., `<ContextMenuTrigger render={<a href={href} onClick={handleClick} {...rest}>{children}</a>} />` — so no wrapper element is introduced at all. For the six non-WikiRenderer call sites where the existing content is already a block-level row/button/card, the default `<div>` (or `render={<span/>}` if the content is itself already inline, e.g. `NotificationRow`) is fine — mirror whatever `TaskCard.tsx:436-437` already does (bare `<ContextMenuTrigger>{cardContent}</ContextMenuTrigger>`, no `render` override, because `cardContent` there is block-level).
**Warning signs:** Links rendered inside wiki prose dropping to their own line, or React DOM-nesting console warnings (`<div> cannot appear as a descendant of <p>`).

### Pitfall 2: `list_browsers()` does filesystem I/O — don't call it per right-click
**What goes wrong:** `list_browsers` (`src-tauri/src/lib.rs:96-198`) iterates 6-10 candidate paths and calls `Path::exists()` for each, per platform. It's cheap in absolute terms but pointless to repeat on every context-menu open, especially once this is wired into list-heavy views (`BacklogPage`, `UnifiedTaskTable`, `NotificationRow` can render dozens of rows).
**Why it happens:** The naive per-component approach is to call `invoke('list_browsers')` inside `ContextMenuContent`'s render (lazy-mount-on-open), which re-fetches on every single open across every instance.
**How to avoid:** Fetch once via a shared TanStack Query hook keyed `['detected-browsers']` with `staleTime: Infinity` (see Architecture Patterns above) so all `LinkContextMenu` instances share one cached result for the app's session.
**Warning signs:** Multiple `list_browsers` Tauri IPC calls firing in devtools/request-logging (this app has a dev-tools request-logging toggle — `requestLogging` in settings.store.ts — useful for verifying this at UAT time).

### Pitfall 3: `navigator.clipboard.writeText()` can throw after a menu closes
**What goes wrong:** Chromium/WebKit-based webviews (Tauri's underlying engine) require the document to be focused for `navigator.clipboard.writeText()` to resolve; `NotAllowedError: Document is not focused` is a well-documented failure mode when the call races a UI transition that briefly moves focus (e.g., a closing menu returning focus to its trigger) `[CITED: multiple sources — chromium clipboard focus requirement, see Sources]`. base-ui's `ContextMenu.Item onClick` closes the menu and typically returns focus to the trigger element, similar to Radix's menu behavior.
**Why it happens:** The clipboard write is asynchronous relative to the synchronous click-then-close-then-refocus sequence; if the write is deferred (e.g. wrapped in a `setTimeout`, or awaited after some other async step) it can fire during the unfocused transition window.
**How to avoid:** Call `navigator.clipboard.writeText()` synchronously, directly inside the `onClick` handler passed to `ContextMenuItem`, with no `await` or delay before the call itself (the promise resolution/`.then()` for the "Copied!" flash state is fine to be async — only the *call* needs to happen inside the synchronous user-gesture handler). Wrap in `.catch()`/rejected-promise handling that fails silently, consistent with `openExternal.ts`'s documented "fail quietly, no toast" convention and `IssueDetailContent.tsx`'s existing pattern (only flips `copiedLink` on the resolved promise, never on a rejection).
**Warning signs:** Copy-link silently not working (no error surfaced since the app already fails quietly) — flag this explicitly for manual verification during UAT since it will NOT show as a test failure or console error the user notices; a `debug`/request-logging check or manual click-through is the only way to catch a regression here.

### Pitfall 4: `openExternal()`'s current signature always reads the persisted `externalBrowser` setting
**What goes wrong:** `openExternal(url, onFallbackFailed)` (`src/lib/openExternal.ts:29`) unconditionally reads `useSettingsStore.getState().externalBrowser` to pick the browser. There is no way to say "open in Chrome specifically, regardless of what's configured in Settings" — which is exactly what "Open in {browser.label}" context-menu items need to do.
**Why it happens:** The function was designed for the single settings-driven default-browser use case (existing left-click behavior), not per-click browser overrides.
**How to avoid:** Add a new exported function rather than overloading the existing signature/behavior (existing call sites and their tests must stay byte-identical):
```ts
/** Opens `url` with a specific browser, bypassing the persisted `externalBrowser`
 *  setting entirely. `browserPath === null` means System Default (no browser arg
 *  to openUrl). Same fail-quiet contract as openExternal — never throws. */
export async function openExternalWith(url: string, browserPath: string | null): Promise<void> {
  try {
    if (browserPath) {
      await openUrl(url, browserPath);
    } else {
      await openUrl(url);
    }
  } catch {
    // fail quietly — same convention as openExternal()
  }
}
```
This keeps `openExternal(url)` (reads store) completely untouched for existing left-click call sites, and gives the context menu an explicit, independent code path. Do not add a third parameter to `openExternal` itself — a `null` vs `undefined` vs omitted-argument distinction there would be error-prone and conflate two different semantics ("no preference, use default" vs "explicitly force System Default").
**Warning signs:** None yet — this is a design decision, not a bug, but skipping it forces the planner into an awkward overload of the existing function that risks breaking the "fail quietly" contract for the 7 existing call sites.

## Code Examples

### Established ContextMenu usage pattern to mirror (non-inline case)
```tsx
// Source: src/routes/dashboard/TaskCard.tsx:435-488 (existing pattern in this codebase)
return (
  <ContextMenu>
    <ContextMenuTrigger>{cardContent}</ContextMenuTrigger>
    <ContextMenuContent>
      {/* ...ContextMenuGroup / ContextMenuItem... */}
    </ContextMenuContent>
  </ContextMenu>
);
```

### Existing copy-to-clipboard + flash pattern to mirror
```tsx
// Source: src/routes/dashboard/IssueDetailContent.tsx:200-224
const [copiedLink, setCopiedLink] = useState(false);
const copiedLinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
useEffect(() => () => { if (copiedLinkTimer.current) clearTimeout(copiedLinkTimer.current); }, []);

function handleCopyJiraLink() {
  const url = `${jiraBaseUrl.replace(/\/$/, '')}/browse/${issueKey}`;
  navigator.clipboard.writeText(url).then(() => {
    setCopiedLink(true);
    if (copiedLinkTimer.current) clearTimeout(copiedLinkTimer.current);
    copiedLinkTimer.current = setTimeout(() => { setCopiedLink(false); copiedLinkTimer.current = null; }, 2000);
  }).catch(() => { /* fail quietly */ });
}
```
Reuse this timer-cleanup-on-unmount pattern inside `LinkContextMenu` too — a `ContextMenu` that unmounts (e.g. its parent row scrolled out of a virtualized list) while a 2s "Copied!" timer is pending would otherwise leak a `setTimeout` callback trying to `setState` on an unmounted component.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | base-ui's `ContextMenu.Item onClick` returns focus to the trigger on close (Radix-like behavior), which is the mechanism behind Pitfall 3 | Common Pitfalls #3 | Low — even if base-ui's exact focus-return timing differs, the general Chromium "document not focused during transition" risk for clipboard calls inside closing menus is well-documented independent of this specific library; the mitigation (call synchronously in the click handler) is safe regardless |
| A2 | `useDetectedBrowsers` via TanStack Query with `staleTime: Infinity` is the best home for browser-list caching (vs. migrating `LinksSection.tsx` to share it now) | Architecture Patterns | Low — purely an implementation choice; not migrating `LinksSection.tsx` leaves one harmless duplicate `list_browsers` call site, no functional risk |

## Open Questions

1. **Should `LinksSection.tsx` be migrated to the new `useDetectedBrowsers` hook in the same task?**
   - What we know: It currently does its own `useEffect` + `tauriService.invoke('list_browsers')`, independent of whatever the new context-menu feature builds.
   - What's unclear: Whether consolidating is in scope for this quick task or a separate cleanup.
   - Recommendation: Leave `LinksSection.tsx` untouched unless the planner wants a small "also DRY this up" bonus task — not migrating is zero-risk since both paths call the same idempotent, side-effect-free Tauri command.

2. **Should internal-routed links inside WikiRenderer (e.g. Jira issue-key links rendered as `<IssueKeyLink>`, not raw `<a>`) also get the right-click menu?**
   - What we know: CONTEXT.md scopes this to the `WikiRenderer.tsx` `a` override generally, and the existing `a` override only reaches `openExternal` on a "miss" (no internal route match) — internal-route hits render `<IssueKeyLink>` instead of `<a>` entirely (see `WikiRenderer.tsx:1333-1337`).
   - What's unclear: Whether "open in browser" makes sense for an internal in-app link (there's no external URL semantics — it navigates via React Router, not `openUrl`).
   - Recommendation: Scope the `LinkContextMenu` wrap to the `openExternal` fallthrough branch only (the final `return <a href={href} onClick={handleClick} {...rest}>` at `WikiRenderer.tsx:1371-1375`), consistent with "open in browser" only being meaningful for genuinely external URLs. `IssueKeyLink` and internal-nav hits stay as-is.

## Sources

### Primary (HIGH confidence)
- Local codebase reads: `src/lib/openExternal.ts`, `src-tauri/src/lib.rs` (`list_browsers`, `BrowserInfo`), `src/stores/settings.store.ts`, `src/components/ui/context-menu.tsx`, `src/routes/dashboard/TaskCard.tsx`, `src/routes/dashboard/WikiRenderer.tsx`, `src/routes/dashboard/IssueDetailContent.tsx`, `src/routes/settings/LinksSection.tsx`, `package.json`

### Secondary (MEDIUM confidence)
- [Base UI — Context Menu](https://base-ui.com/react/components/context-menu) — confirmed `ContextMenu.Trigger` default element is `<div>`, `render` prop supported, activates on right-click or long-press
- [Base UI — Composition](https://base-ui.com/react/handbook/composition) — `render` prop composition pattern for swapping the underlying element

### Tertiary (LOW confidence, cross-verified across multiple independent reports)
- Chromium/WebKit `NotAllowedError: Document is not focused` clipboard-API behavior — cross-referenced across [Hyprland #9302](https://github.com/hyprwm/Hyprland/issues/9302), [Baserow #3660](https://gitlab.com/baserow/baserow/-/issues/3660), and general MDN/Cypress reports of the same root cause; not Tauri-specific but directly applicable given the click-then-close-then-refocus sequence of any Radix-like context menu

## Metadata

**Confidence breakdown:**
- Standard stack: N/A (no new dependencies) — HIGH, confirmed no clipboard plugin exists and none is needed
- Architecture (shared component shape, caching): HIGH — directly derived from existing in-repo patterns (`TaskCard.tsx`, `IssueDetailContent.tsx`, TanStack Query `gcTime: Infinity` convention)
- Pitfalls: HIGH for #1/#2/#4 (verified against local code + official base-ui docs), MEDIUM for #3 (well-documented general clipboard-API behavior, base-ui's exact focus-return timing not independently verified against its source)

**Research date:** 2026-08-27
**Valid until:** 30 days (stable internal APIs; base-ui `^1.2.0` pinned in package.json)
