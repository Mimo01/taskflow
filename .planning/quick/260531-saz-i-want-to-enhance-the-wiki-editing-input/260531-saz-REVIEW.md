---
phase: 260531-saz
reviewed: 2026-05-31T00:00:00Z
depth: quick
files_reviewed: 14
files_reviewed_list:
  - taskflow/src/components/wiki-editor/SourceView.tsx
  - taskflow/src/components/wiki-editor/WikiEditor.tsx
  - taskflow/src/components/wiki-editor/extensions/JiraCalloutNode.ts
  - taskflow/src/components/wiki-editor/extensions/JiraColorMark.ts
  - taskflow/src/components/wiki-editor/extensions/RawJiraNode.ts
  - taskflow/src/components/wiki-editor/extensions/mentionConfig.tsx
  - taskflow/src/components/wiki-editor/index.ts
  - taskflow/src/components/wiki-editor/jiraToTiptap.ts
  - taskflow/src/components/wiki-editor/jiraWikiSerializer.ts
  - taskflow/src/components/wiki-editor/wikiEditorExtensions.ts
  - taskflow/src/routes/dashboard/CommentComposer.tsx
  - taskflow/src/routes/dashboard/DescriptionEditor.tsx
  - taskflow/src/routes/dashboard/InlineComment.tsx
  - taskflow/src/routes/dashboard/IssueDetailPage.tsx
findings:
  critical: 4
  warning: 5
  info: 2
  total: 11
status: issues_found
---

# Phase 260531-saz: Code Review Report

**Reviewed:** 2026-05-31
**Depth:** quick
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed a new TipTap v3-based WYSIWYG wiki editor that replaces four existing textarea editors. The implementation is architecturally sound and the dirty-flag toggle logic is mostly correct, but there are four blockers: two data-loss bugs in the serializer, a CSS injection vector in the color mark renderer, and a DOM leak in the mention popup's Escape-key path. Five additional warnings cover a broken `buildExtensions` call outside the React rules-of-hooks, a single `menuRef` shared across all rendered comment menus, a dangerous `{panel:title=}` injection point, an unchecked `removeChild` crash path, and a missing `onChange` call when the user edits in source mode then switches back to WYSIWYG without re-editing.

---

## Critical Issues

### CR-01: CSS injection via unvalidated `color` attribute in JiraColorMark renderer

**File:** `taskflow/src/components/wiki-editor/extensions/JiraColorMark.ts:23`

**Issue:** The `renderHTML` function interpolates the `color` attribute directly into an inline `style` string: `style: \`color:${attributes.color}\`` — no validation, no escaping. The attribute value comes from `parseHTML`, which reads it from `data-color` or `element.style.color`. If Jira content delivers a malicious value such as `red; background-image: url(javascript:...)` or a `</style><script>` fragment, that string is injected verbatim into the DOM style attribute of a `<span>`. While modern browsers block `javascript:` in `style`, expression injection (IE legacy) and `url()` exfiltration remain viable, and the pattern is wrong regardless of current browser mitigations.

**Fix:** Validate that the color value is a safe hex or named color before emitting it in `style`:
```typescript
renderHTML: (attributes) => {
  const color = attributes.color as string | null;
  if (!color) return {};
  // Allow only #rrggbb, #rgb, or CSS named colors (letters only)
  const safe = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)$/.test(color);
  return safe
    ? { 'data-color': color, style: `color:${color}` }
    : { 'data-color': color }; // display without inline style if untrusted
},
```

---

### CR-02: `buildExtensions()` called outside a hook — recreates TipTap extensions on every render, causing editor remounts

**File:** `taskflow/src/components/wiki-editor/WikiEditor.tsx:117-126`

**Issue:** `buildExtensions(...)` is called directly in the function body of `WikiEditor` — not inside `useMemo` or `useCallback`. This means a brand-new `Extensions` array is created on every render. `useEditor` has `[disabled]` as its dependency array (line 158) and does NOT re-run on every render, but TipTap v3's `useEditor` watches the `extensions` reference for changes via an internal effect. When the extensions array reference changes (every render), TipTap destroys and recreates the editor. The practical effect is the editor loses focus and selection on any state change in the parent (e.g., toggling `isSource` back to WYSIWYG calls `setIsSource(false)`, triggers a re-render, new extensions reference, editor destruction). Confirmed: `initialContent` on line 129 has the same problem — it calls `jiraToTiptap` on every render.

**Fix:**
```typescript
const extensions = useMemo(
  () =>
    buildExtensions(
      mention
        ? { mention: createMentionExtension({ projectKey: mention.projectKey, jiraBaseUrl: mention.jiraBaseUrl }) }
        : {},
    ),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [mention?.projectKey, mention?.jiraBaseUrl],
);

const initialContent = useMemo(
  () => jiraToTiptap(value, { attachments, users }),
  // Intentionally only on mount — later value changes go through the sync effect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [],
);
```

---

### CR-03: DOM leak — mention popup not removed from `document.body` when closed via Escape

**File:** `taskflow/src/components/wiki-editor/extensions/mentionConfig.tsx:199-201`

**Issue:** The `onKeyDown` handler for `Escape` sets `popupEl.style.display = 'none'` (hides the popup) but does NOT remove the element from `document.body` and does NOT call `component.destroy()`. The suggestion session then stays "open" internally. If the user types `@` again immediately, `onStart` creates a second `div` appended to `body`. The hidden first one is never cleaned up because `onExit` is only called by TipTap when the suggestion session ends normally (via selection or blur), and hiding via CSS does not end the session. Over time this leaks detached `div` elements containing live React trees.

Additionally, `document.body.removeChild(popupEl)` in `onExit` (line 208) will throw if `Escape` was pressed first and the element was already detached or replaced — see CR-04.

**Fix:** In the `Escape` handler, call `onExit` logic directly (or just let the event bubble so TipTap cancels the suggestion session properly):
```typescript
onKeyDown(props: SuggestionKeyDownProps) {
  if (props.event.key === 'Escape') {
    // Do NOT just hide — let TipTap's suggestion plugin handle session cancellation,
    // which will fire onExit. Return false so the keydown propagates to TipTap.
    return false;
  }
  return component.ref?.onKeyDown(props.event) ?? false;
},
```

---

### CR-04: Serializer data-loss — unchecked task items emit `(x)` which is the Jira red-X emoticon, not an unchecked checkbox

**File:** `taskflow/src/components/wiki-editor/jiraWikiSerializer.ts:98, 192`

**Issue:** The serializer maps an unchecked `taskItem` to the string `(x)`. In Jira wiki markup `(x)` is the red-X emoticon (status icon for "error" or "blocked") — it is not a checkbox or task marker. Jira does not have a native wiki syntax for task lists; `(/)` is a green checkmark emoticon, not a checked-box. Serializing TipTap task items as `(/)` / `(x)` will round-trip into the WYSIWYG editor as two emoticon images, not as checkboxes. This is a data mutation: what was an interactive task list becomes static emoticon text on the next load.

This bug affects both `serializeTaskList` (line 192) and the `taskItem` case in `serializeBlock` (line 98).

**Fix:** Either (a) serialize task lists into a `{noformat}` or `rawJira` block to preserve them without mangling, or (b) accept the lossy emoticon convention explicitly in the comment and ensure `jiraToTiptap` re-parses `(/) text` and `(x) text` back into taskItems. If (b), remove the `noformat` entry from `KNOWN_MACROS` in `wrapUnknownMacros` so that `{noformat}` blocks are treated as passthrough. The comment on line 11 of the serializer (`D-OQ1 convention`) suggests this was a deliberate decision — confirm it is consistent with the load path in `preprocessJiraMarkup`.

---

## Warnings

### WR-01: Single `menuRef` shared across all comment items causes outside-click detection to fail for all but the last rendered menu

**File:** `taskflow/src/routes/dashboard/InlineComment.tsx:83, 202`

**Issue:** `menuRef` is a single `useRef` assigned to the open menu's `div` (line 202), but the menu is conditionally rendered with `{openMenuId === c.id && (<div ref={menuRef}>...)}`. When the user opens a menu for comment #2, React assigns `menuRef.current` to comment #2's menu div. If the user then opens the menu for comment #3, the div for #2 unmounts (condition becomes false), `menuRef.current` becomes `null`, then the div for #3 mounts and `menuRef.current` is set to #3's div. This works correctly in the happy path. However, the outside-click handler reads `menuRef.current` and if `menuRef.current` is null (between unmount and remount) the click check skips, leaving the menu open. More subtly: if two menus render simultaneously (possible during a rapid double-click or in React 18 concurrent transitions), only the last `ref` assignment wins and the first menu becomes undetectable.

**Fix:** Move the menu state and ref into a sub-component per comment item, or track the `openMenuId` and use a callback ref that captures the actual open element.

---

### WR-02: `{panel:title=VALUE}` serialization injects unescaped title value, breaking the macro if title contains `}`

**File:** `taskflow/src/components/wiki-editor/jiraWikiSerializer.ts:290`

**Issue:** The panel header is emitted as `` `{panel:title=${title}}` `` with no sanitization. If the panel title contains a `}` character (valid in text, e.g., "Config {map}"), the generated macro becomes `{panel:title=Config {map}}` which Jira's parser splits at the first `}`, resulting in `{panel:title=Config {map}` as the macro header — broken and truncated. Similarly a `|` character in the title would be parsed as a macro parameter separator.

**Fix:**
```typescript
const safeTitle = title.replace(/[|}]/g, (c) => (c === '}' ? '\\}' : '\\|'));
const header = title ? `{panel:title=${safeTitle}}` : '{panel}';
```

---

### WR-03: `document.body.removeChild(popupEl)` in `onExit` will throw `NotFoundError` if popup was removed earlier

**File:** `taskflow/src/components/wiki-editor/extensions/mentionConfig.tsx:208`

**Issue:** `onExit` calls `document.body.removeChild(popupEl)` unconditionally (guarded only by `if (popupEl)`). If the popup was already removed from the DOM for any reason (e.g., a parent component unmounts and removes its subtree, or the Escape path is fixed to detach the element), this throws a `NotFoundError: Node was not found`. This is an unhandled exception in an editor extension callback.

**Fix:**
```typescript
onExit() {
  if (popupEl) {
    if (popupEl.parentNode === document.body) {
      document.body.removeChild(popupEl);
    }
    popupEl = null;
  }
  component.destroy();
},
```

---

### WR-04: Source→WYSIWYG toggle silently drops the `onChange` emission when `sourceDirtyRef` is false

**File:** `taskflow/src/components/wiki-editor/WikiEditor.tsx:196-198`

**Issue:** `handleToggleToWysiwyg` returns early without calling `onChange` when `sourceDirtyRef.current` is false. This is intentional for the no-op case, but there is a gap: a consumer may set `value` to a new string while the editor is in Source mode. The sync effect at line 162 skips the `setSourceText` update when `isSource` is true (line 171: `if (!isSource)`), so `sourceText` diverges from `value`. When the user toggles back to WYSIWYG without touching the source textarea, `sourceDirtyRef` is false, the early return fires, and `editor.commands.setContent` is NOT called — the editor retains stale content from before the external update. This means an externally-pushed `value` change (e.g., optimistic rollback on failed save) is silently ignored when the user is in Source mode.

**Fix:** In `handleToggleToWysiwyg`, also reload from `value` if `sourceText !== value` and `sourceDirtyRef.current` is false:
```typescript
const handleToggleToWysiwyg = useCallback(() => {
  setIsSource(false);
  const textToLoad = sourceDirtyRef.current ? sourceText : value;
  if (!sourceDirtyRef.current && sourceText === value) {
    // True no-op: neither source nor value changed
    return;
  }
  const json = jiraToTiptap(textToLoad, { attachments, users });
  if (editor && !editor.isDestroyed) {
    editor.commands.setContent(json);
  }
  lastLoadedValueRef.current = textToLoad;
  wysiwygDirtyRef.current = false;
}, [editor, sourceText, value, attachments, users]);
```

---

### WR-05: `useEditor` dependency array `[disabled]` causes full editor re-creation when `disabled` changes, losing content

**File:** `taskflow/src/components/wiki-editor/WikiEditor.tsx:158`

**Issue:** `useEditor({ ... }, [disabled])` instructs TipTap to destroy and recreate the full editor instance whenever `disabled` changes. While this is listed in the TipTap docs as an acceptable pattern, in practice `DescriptionEditor` toggles `disabled` based on its own save-pending state (passed from `IssueDetailPage`). A transition from `disabled=false` to `disabled=true` (e.g., while saving) destroys the editor. Any text the user typed in the instant between the last `onChange` and the next `disabled` flip is permanently lost since `editor.commands.setContent(initialContent)` reinstalls the `value` from before those keystrokes. TipTap v3 supports `editor.setOptions({ editable })` to change editability without full recreation.

**Fix:**
```typescript
// Remove disabled from useEditor deps — handle editability via a separate effect
const editor = useEditor({ extensions, content: initialContent, ... }, []);

useEffect(() => {
  if (editor && !editor.isDestroyed) {
    editor.setEditable(!disabled);
  }
}, [editor, disabled]);
```

---

## Info

### IN-01: Jira link mark serialization does not escape `|` in link text, breaking the link macro

**File:** `taskflow/src/components/wiki-editor/jiraWikiSerializer.ts:367`

**Issue:** Link text is emitted verbatim: `[${text}|${href}]`. If the link display text contains a `|` (e.g., "A | B"), Jira parses `[A ` as the display text and `B|${href}]` as a malformed URL. The round-trip emits broken markup.

**Fix:**
```typescript
const safeText = text.replace(/\|/g, '\\|');
text = `[${safeText}|${href}]`;
```

---

### IN-02: `buildExtensions` is called inside `jiraToTiptap` on every invocation — creates a fresh extension set per parse call

**File:** `taskflow/src/components/wiki-editor/jiraToTiptap.ts:121`

**Issue:** Each call to `jiraToTiptap` calls `buildExtensions()` which instantiates a new set of TipTap extension objects. `generateJSON` only uses the schema derived from extensions, so this is not a correctness bug, but it does allocate ~10 extension objects on every keystroke when the WYSIWYG `onUpdate` serializes. This is flagged as info only (per review scope: performance is out of v1 scope), but the redundancy is also a maintainability signal — callers that need a stable schema should pass a cached instance.

**Fix:** Memoize the extension set at module level for the load-path case (no mention UI needed), or accept an `extensions` parameter so callers can pass a cached set.

---

_Reviewed: 2026-05-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
