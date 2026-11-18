---
status: resolved
trigger: "when comment opens it auto moves the page to accommodate the bigger height. that works but on the first open it doesnt fully, some content is hidden behind the input"
created: 2026-11-18
updated: 2026-11-18
---

## Resolution

root_cause: On the first expand, WikiEditorLazy shows a Suspense skeleton (138px), then swaps it for the real editor. During that swap the editor area briefly has zero height (skeleton gone, TipTap DOM not yet attached). WebKit flushes layout at that moment and clamps the bottom-scrolled scroller's scrollTop by about 138px. The strip's net height barely changes (199 to 191), so useKeepContentAboveSticky's ResizeObserver never compensates. Later opens skip the skeleton because the chunk is cached. Chromium doesn't clamp, so it only shows in the app.
evidence: Playwright WebKit repro, scrolled to bottom. First open scrollTop 1057 to 1199 (correct) to 1061 (clamp) with strip 199 to 191. Second open 1057 to 1191. Chromium correct both times.
fix: preloadWikiEditor() (module-level cached import) is called on CommentComposer mount. WikiEditorLazy renders the loaded component synchronously, with no skeleton, once the chunk has loaded. The component is fixed per mount so it never remounts.
verification: user approved in app 2026-11-18. WebKit repro first open now 1057 to 1191, the same as second open. Regression test in WikiEditorLazy.test.tsx fails before the fix.
residual: if the composer is clicked before the chunk finishes loading (within ms of the page opening), the skeleton path, and so the clamp, can still occur.
files_changed: [WikiEditorLazy.tsx, WikiEditorLazy.test.tsx, CommentComposer.tsx, test/wiki-editor-stub.tsx]
