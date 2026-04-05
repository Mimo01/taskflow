---
phase: quick-260405-usp
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/app-icon-source.svg
  - taskflow/public/app-icon.svg
  - taskflow/src/components/app/AppIcon.tsx
  - taskflow/index.html
  - taskflow/src-tauri/icons/icon.icns
  - taskflow/src-tauri/icons/icon.ico
  - taskflow/src-tauri/icons/icon.png
  - taskflow/src-tauri/icons/32x32.png
  - taskflow/src-tauri/icons/64x64.png
  - taskflow/src-tauri/icons/128x128.png
  - taskflow/src-tauri/icons/128x128@2x.png
autonomous: false
requirements: [LOGO-01]

must_haves:
  truths:
    - "App icon in sidebar shows new flow motif logo at 32x32"
    - "Favicon in browser tab shows new logo"
    - "macOS app icon (.icns) shows new logo with squircle mask"
    - "Logo uses blue (#0ea5e9), orange (#f97316), white (#ffffff) brand colors"
    - "Logo features curved wave/swoosh flow elements as abstract symbol"
  artifacts:
    - path: "taskflow/app-icon-source.svg"
      provides: "1024x1024 source SVG with flow motif"
      contains: "viewBox.*1024"
    - path: "taskflow/src/components/app/AppIcon.tsx"
      provides: "Inline JSX SVG component for sidebar"
      exports: ["default"]
    - path: "taskflow/public/app-icon.svg"
      provides: "Public SVG copy for favicon"
    - path: "taskflow/src-tauri/icons/icon.icns"
      provides: "macOS app icon"
  key_links:
    - from: "taskflow/src/components/app/AppIcon.tsx"
      to: "sidebar"
      via: "React component import"
      pattern: "AppIcon"
    - from: "taskflow/index.html"
      to: "taskflow/public/app-icon.svg"
      via: "link rel=icon href"
      pattern: "app-icon\\.svg"
---

<objective>
Create a new Taskflow logo featuring abstract flow motif with curved wave/swoosh elements in blue, orange, and white. Replace the current geometric squares icon across all app surfaces: sidebar, favicon, and platform icons.

Purpose: Give the app a distinctive visual identity that conveys "flow" -- the core concept of Taskflow.
Output: New SVG source, updated AppIcon.tsx, favicon reference, and all generated platform icons.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260405-usp-new-taskflow-logo-with-flow-motif-in-whi/260405-usp-CONTEXT.md
@.planning/quick/260405-usp-new-taskflow-logo-with-flow-motif-in-whi/260405-usp-RESEARCH.md
@taskflow/src/components/app/AppIcon.tsx
@taskflow/index.html

<interfaces>
<!-- Current AppIcon.tsx pattern to follow -->
From taskflow/src/components/app/AppIcon.tsx:
```typescript
/** Inline SVG app icon — renders crisp at any size unlike <img> which rasterizes filters. */
export default function AppIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" className={className}>
      <defs>
        <clipPath id="app-sq">
          <rect x="100" y="100" width="824" height="824" rx="185" ry="185" />
        </clipPath>
        <!-- filters, paths, etc. -->
      </defs>
      <g clipPath="url(#app-sq)">
        <!-- content clipped to macOS squircle -->
      </g>
    </svg>
  );
}
```

Key patterns:
- viewBox="0 0 1024 1024" always
- macOS squircle clipPath: rect x=100 y=100 w=824 h=824 rx=185
- className prop for external sizing
- All IDs prefixed with `app-` for uniqueness
- kebab-case SVG attrs become camelCase in JSX (stroke-width -> strokeWidth, clip-path -> clipPath, flood-color -> floodColor)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Design flow motif SVG variants and update all icon files</name>
  <files>taskflow/app-icon-source.svg, taskflow/public/app-icon.svg, taskflow/src/components/app/AppIcon.tsx, taskflow/index.html</files>
  <action>
Design 3 SVG logo variants at 1024x1024 featuring abstract flow motifs with curved wave/swoosh elements. All variants must use the brand colors: blue (#0ea5e9), orange (#f97316), white (#ffffff) background.

Design principles (from research):
- Minimum stroke width 40-60px at 1024 scale (becomes ~1.5-2px at 32x32)
- Keep content within safe zone: 824x824 squircle with 60px inner padding (~700x700 effective area)
- Use cubic bezier `C` and smooth cubic `S` path commands for flowing curves
- Use `stroke-linecap="round"` and `stroke-linejoin="round"` on all paths
- No text in the icon (text displayed separately in sidebar)
- Avoid thin details under 30px at 1024 scale

Composition approaches to try (pick 3 varied concepts):
1. Intertwining waves -- two curved strokes (blue + orange) weaving together, suggesting dual flow/collaboration
2. Arrow-wave hybrid -- flowing curve that resolves into forward motion direction
3. Circular flow -- curves forming a cycle/loop suggesting continuous flow
4. Gradient wave -- single bold path transitioning blue-to-orange via linearGradient
5. Stacked flow lanes -- parallel curved paths suggesting kanban/stream lanes

For each variant:
- Save as `taskflow/app-icon-variant-{N}.svg` (N=1,2,3)
- Use the macOS squircle clip path (rect x=100 y=100 w=824 h=824 rx=185)
- Test readability by converting to 32x32 PNG: `cd /Users/mimo/Desktop/Tasker/taskflow && rsvg-convert -w 32 -h 32 app-icon-variant-{N}.svg -o app-icon-variant-{N}-32.png`
- Also convert to 128x128 PNG for mid-size preview: `rsvg-convert -w 128 -h 128 app-icon-variant-{N}.svg -o app-icon-variant-{N}-128.png`

If using filters (feDropShadow etc.), keep stdDeviation <= 4 at 1024 scale to avoid muddy rendering at small sizes. Or skip filters entirely for cleaner small-size rendering.

Do NOT yet update AppIcon.tsx or generate Tauri icons -- that happens after user selects a variant.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && ls -la app-icon-variant-*.svg app-icon-variant-*-32.png app-icon-variant-*-128.png 2>/dev/null | wc -l</automated>
  </verify>
  <done>3 SVG variants exist with corresponding 32px and 128px PNG previews for user review</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: User selects preferred logo variant</name>
  <what-built>3 flow motif logo variants as SVG files with 32px and 128px PNG previews. Each features abstract curved wave/swoosh elements in blue (#0ea5e9) and orange (#f97316) on white background.</what-built>
  <how-to-verify>
    1. Open the 128px PNG previews to see each variant at medium size:
       - `open taskflow/app-icon-variant-1-128.png`
       - `open taskflow/app-icon-variant-2-128.png`
       - `open taskflow/app-icon-variant-3-128.png`
    2. Check the 32px PNGs to confirm they are still readable at sidebar/favicon size:
       - `open taskflow/app-icon-variant-1-32.png`
       - `open taskflow/app-icon-variant-2-32.png`
       - `open taskflow/app-icon-variant-3-32.png`
    3. For full-size review, open the SVGs in a browser:
       - `open taskflow/app-icon-variant-1.svg`
    4. Pick a variant number (1, 2, or 3) or describe changes wanted for another iteration round.
  </how-to-verify>
  <resume-signal>Reply with variant number (e.g., "variant 2") or describe changes for next iteration</resume-signal>
</task>

<task type="auto">
  <name>Task 3: Apply chosen variant to all icon surfaces and generate platform icons</name>
  <files>taskflow/app-icon-source.svg, taskflow/public/app-icon.svg, taskflow/src/components/app/AppIcon.tsx, taskflow/index.html</files>
  <action>
After user selects a variant (or after iteration rounds converge on a final design):

1. Copy the chosen variant SVG to `taskflow/app-icon-source.svg` (overwrite existing)

2. Copy the same SVG to `taskflow/public/app-icon.svg`

3. Update `taskflow/src/components/app/AppIcon.tsx`:
   - Convert the SVG to JSX following the exact existing pattern
   - viewBox="0 0 1024 1024", className prop
   - Convert all kebab-case SVG attributes to camelCase (stroke-width -> strokeWidth, clip-path -> clipPath, flood-color -> floodColor, flood-opacity -> floodOpacity, stop-color -> stopColor, stroke-linecap -> strokeLinecap, stroke-linejoin -> strokeLinejoin)
   - Prefix all `id` attributes with `app-` for uniqueness (e.g., `app-flow-grad`, `app-sq`)
   - Keep the existing component signature: `export default function AppIcon({ className }: { className?: string })`

4. Update `taskflow/index.html`:
   - Change `<link rel="icon" type="image/svg+xml" href="/vite.svg" />` to `<link rel="icon" type="image/svg+xml" href="/app-icon.svg" />`

5. Generate all Tauri platform icons:
   ```bash
   cd /Users/mimo/Desktop/Tasker/taskflow
   npx @tauri-apps/cli icon app-icon-source.svg -o src-tauri/icons
   ```

6. Clean up variant files:
   ```bash
   cd /Users/mimo/Desktop/Tasker/taskflow
   rm -f app-icon-variant-*.svg app-icon-variant-*.png
   ```
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && test -f app-icon-source.svg && test -f public/app-icon.svg && test -f src-tauri/icons/icon.icns && test -f src-tauri/icons/icon.ico && grep -q "app-icon.svg" index.html && grep -q "clipPath" src/components/app/AppIcon.tsx && echo "ALL CHECKS PASSED" || echo "FAILED"</automated>
  </verify>
  <done>New flow motif logo applied to: app-icon-source.svg, public/app-icon.svg, AppIcon.tsx (JSX inline SVG), index.html (favicon). All Tauri platform icons regenerated. Variant temp files cleaned up.</done>
</task>

</tasks>

<verification>
- `taskflow/app-icon-source.svg` contains new flow motif SVG (not the old rotated squares)
- `taskflow/src/components/app/AppIcon.tsx` exports default AppIcon with new SVG paths
- `taskflow/index.html` references `/app-icon.svg` not `/vite.svg`
- `taskflow/src-tauri/icons/icon.icns` was regenerated (file modification time is recent)
- `npm run build` in taskflow/ completes without errors
</verification>

<success_criteria>
- New flow motif logo visible in sidebar at 32x32 (via AppIcon.tsx)
- Favicon shows new logo in browser tab
- macOS app icon shows new logo
- All platform icons regenerated via Tauri CLI
- User approved the chosen variant
</success_criteria>

<output>
After completion, create `.planning/quick/260405-usp-new-taskflow-logo-with-flow-motif-in-whi/260405-usp-SUMMARY.md`
</output>
