---
status: resolved
trigger: "In the new editors when i open the popup menu it can be behind things like section headers. this is especially visible in the comments"
created: 2026-11-18
updated: 2026-11-18
---

## Resolution
root_cause: Editor floating surfaces had no effective z-index. The suggestion popover (slash/mention/key/emoticon) wrapper is positioned by @tiptap/suggestion's mount (position:absolute, left/top) but carried no z-index; the BubbleToolbar's `z-50` sat on the inner, non-positioned div (ignored) while Tiptap's positioned BubbleMenu wrapper had none. Sticky SectionHeader (z-20) and other stacked chrome painted over them.
fix: `z-50` on the positioned wrappers — `r.element.classList.add('z-50')` in create-suggestion.ts; `className="z-50"` on <BubbleMenu> (forwarded to its menu element), inner z-50 dropped.
verification: new lifecycle.test.tsx case fails pre-fix, passes post-fix; wiki-editor suite 654/654.
files_changed: src/components/wiki-editor/suggestion/create-suggestion.ts, src/components/wiki-editor/toolbar/BubbleToolbar.tsx, src/components/wiki-editor/suggestion/lifecycle.test.tsx
