---
phase: quick-261113-ifs
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/issue-detail/AttachmentsSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/AttachmentsSection.test.tsx
autonomous: true
requirements: [QUICK-261113-ifs]

must_haves:
  truths:
    - "With zero attachments the section body is a slim dashed strip reading 'No attachments' + 'Drop files here or browse' (no italic 'No attachments' line, no tall EmptyState icon)"
    - "With attachments the same strip (just 'Drop files here or browse') renders below the tile grid"
    - "Clicking the strip opens a file picker; the picked file uploads via the section's single upload mutation with the existing progress/error UI"
    - "Dragging a file over the section highlights the strip itself ('Drop file to attach', primary tint); the separate 'Drop file here to attach' overlay div no longer exists"
    - "Header 'Attach file' button (AttachmentUpload) is unchanged"
  artifacts:
    - path: "taskflow/src/routes/dashboard/issue-detail/AttachmentsSection.tsx"
      provides: "Always-present drop strip + hidden file input wired to uploadMutation"
      contains: "Drop files here or"
    - path: "taskflow/src/routes/dashboard/issue-detail/AttachmentsSection.test.tsx"
      provides: "Empty/populated strip, click→file input, drop→upload tests"
  key_links:
    - from: "drop strip <button>"
      to: "hidden <input type=file> in AttachmentsSection"
      via: "fileInputRef.current?.click()"
      pattern: "fileInputRef"
    - from: "file input onChange + section onDrop"
      to: "uploadMutation.mutate"
      via: "shared startUpload(file) helper"
      pattern: "uploadMutation\\.mutate"
---

<objective>
Replace the bare italic "No attachments" line in the issue-detail Attachments section with a compact, always-present dashed drop strip that doubles as the empty state and as the drag-over affordance — one consistent drop target in both empty and populated states.

Purpose: nicer empty state without an empty-only drop zone (user explicitly rejected that inconsistency).
Output: updated AttachmentsSection.tsx + tests, one commit.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@taskflow/CLAUDE.md
@taskflow/src/routes/dashboard/issue-detail/AttachmentsSection.tsx
@taskflow/src/routes/dashboard/issue-detail/AttachmentUpload.tsx
@taskflow/src/routes/dashboard/issue-detail/AttachmentsSection.test.tsx

Repo root (.planning, git) is /Users/mimo/Documents/Projects/taskflow; npm/vitest/biome run in the inner `taskflow/` dir.
Pre-commit hook runs full vitest + biome + tsc: test and implementation go in ONE commit. Commit with explicit paths (`git commit -- <paths>`) and check `git log -1 --stat` afterwards.
Do NOT run `biome --write` over all of src — only the two touched files.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Always-present drop strip wired to a single upload mutation, with tests</name>
  <files>taskflow/src/routes/dashboard/issue-detail/AttachmentsSection.tsx, taskflow/src/routes/dashboard/issue-detail/AttachmentsSection.test.tsx</files>
  <behavior>
    - Empty (attachments=[]): a button exists whose text contains "No attachments" and "Drop files here or browse"; no element with the old italic-only "No attachments" paragraph (assert there is exactly one "No attachments" text node, inside the strip button).
    - Populated (2 attachments): the strip button with "Drop files here or browse" renders, does NOT contain "No attachments", and is not inside the tile grid (tiles' shared parent does not contain the strip) — existing "one grid" test must keep passing.
    - Click strip: spy `HTMLInputElement.prototype.click` (vi.spyOn) and assert it was called once after clicking the strip button.
    - File input change: `fireEvent.change(screen.getByTestId('attachment-file-input'), { target: { files: [file] } })` with readSecret mocked to resolve 'tok' → `uploadAttachment` called with ('https://example.com', 'tok', 'ABC-1', file) (use waitFor).
    - Drop: `fireEvent.drop(section, { dataTransfer: { files: [file] } })` → uploadAttachment called with the file.
    - DragOver: `fireEvent.dragOver(section)` → strip text becomes "Drop file to attach"; text "Drop file here to attach" never appears anywhere.
  </behavior>
  <action>
    Implementation in AttachmentsSection.tsx (per locked user decisions):
    1. Rename `dropMutation` → `uploadMutation`, `dropUploadName`/`dropUploadError` → `uploadName`/`uploadError` (rename only these local identifiers — no global find-replace). Add a `startUpload(file: File)` helper that clears error, sets name, calls `uploadMutation.mutate(file)`; `handleDrop` uses it. Do NOT add another useMutation; do NOT touch AttachmentUpload.tsx (header "Attach file" stays).
    2. Add `const fileInputRef = useRef<HTMLInputElement>(null)` and a hidden `<input ref={fileInputRef} type="file" className="hidden" tabIndex={-1} data-testid="attachment-file-input" onChange=...>`; onChange takes `e.target.files?.[0]`, calls startUpload, then resets `e.target.value = ''` (same pattern as AttachmentUpload.handleFileSelect).
    3. Delete the `{isDragging && (...)}` "Drop file here to attach" overlay div entirely.
    4. Replace the `attachments.length === 0 ? <p italic> : grid` ternary: render the grid only when attachments exist, then always render the strip as the last child of the existing `space-y-3 density-compact:space-y-2 density-comfortable:space-y-4` wrapper (so spacing above it is density-aware and identical to the grid's rhythm).
    5. Strip = `<button type="button">` full width, `onClick={() => fileInputRef.current?.click()}`, `disabled={uploadMutation.isPending}`. Classes: `flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2.5 density-compact:py-2 density-comfortable:py-3 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60`. Base border uses the default border colour (`border-border`). When `isDragging`: swap to `border-primary/50 bg-primary/5 text-foreground` (use the project's `cn` helper from `@/lib/utils` if the file convention allows; otherwise template-literal conditional).
       Content: a small lucide `Paperclip` icon (`size-3.5 shrink-0`, aria-hidden). Text:
       - isDragging → "Drop file to attach".
       - empty → `<span className="font-medium text-foreground/80">No attachments</span>` followed by a `·`-free separate span "Drop files here or <span className="underline underline-offset-2">browse</span>" (separate with gap, e.g. a muted `—` is NOT needed; just two spans; keep on one line, `truncate` not required at this width but add `min-w-0` on the text wrapper).
       - populated → "Drop files here or <underlined>browse</underlined>".
       Keep it single-line and compact (no tall EmptyState icon). Give the button an accessible name via its text content (no aria-label override, so tests can query by text).
    6. Drag-leave flicker fix (the strip now sits inside the section, so child dragleave events would toggle highlight): in `handleDragLeave`, ignore the event when `e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)`; otherwise setIsDragging(false).
    7. Keep the existing progress bar and error paragraph markup (now reading uploadName/uploadError), positioned where they are today (under the header).

    Tests in AttachmentsSection.test.tsx: add the behaviour cases above in the existing describe; import `fireEvent`, `waitFor`; import the mocked `readSecret` and `uploadAttachment` and set `vi.mocked(readSecret).mockResolvedValue('tok')` / `vi.mocked(uploadAttachment).mockResolvedValue(...)` in those tests. Reuse a small `renderSection(items)` helper wrapping QueryClientProvider (refactor the two existing tests to use it only if trivial). Get the section via `container.querySelector('section')`. Restore spies with `vi.restoreAllMocks()` in afterEach only for the prototype spy (use `spy.mockRestore()` inline to avoid clearing module mocks).
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/issue-detail/AttachmentsSection.test.tsx && npx biome check src/routes/dashboard/issue-detail/AttachmentsSection.tsx src/routes/dashboard/issue-detail/AttachmentsSection.test.tsx && npx tsc --noEmit -p . && ! grep -n "Drop file here to attach\|dropMutation\|italic\">No attachments" src/routes/dashboard/issue-detail/AttachmentsSection.tsx</automated>
  </verify>
  <done>All AttachmentsSection tests (old + new) pass; biome clean on both files; tsc clean; old overlay text, dropMutation, and italic empty line are gone; AttachmentUpload.tsx untouched (`git diff --stat` shows only the two files); committed as one commit (e.g. `feat(quick-261113-ifs): always-present attachments drop strip as empty state`).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| local file → Jira upload | user-picked/dropped file sent to Jira via existing uploadAttachment |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-ifs-01 | Tampering | strip file input | accept | same user-initiated upload path as existing header button/drop; no new endpoint, Jira enforces size/type |
| T-ifs-02 | Information disclosure | PAT read | accept | reuses existing readSecret('jira-pat') flow unchanged |
</threat_model>

<verification>
- Targeted vitest + biome + tsc pass (verify command).
- Pre-commit full suite passes on commit.
- Manual (user UAT): empty issue shows the dashed strip; populated issue shows strip below tiles; dragging a file tints the strip; click opens picker and upload shows progress.
</verification>

<success_criteria>
One consistent dashed drop strip in both states, doubling as the empty state and drag-over target; single upload mutation in the section; header button unchanged; tests cover empty copy, populated strip, click→picker, change/drop→upload.
</success_criteria>

<output>
Create `.planning/quick/261113-ifs-in-issue-detail-when-there-are-no-attach/261113-ifs-SUMMARY.md` when done
</output>
