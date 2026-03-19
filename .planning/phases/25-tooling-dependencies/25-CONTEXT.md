# Phase 25: Tooling & Dependencies - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Set up Biome as the project's linter and formatter, add CI-ready check scripts, and update all npm dependencies to latest compatible versions. No new user-facing features. No test fixes (Phase 26), no refactoring (Phase 27), no a11y fixes (Phase 28).

</domain>

<decisions>
## Implementation Decisions

### Biome Rule Strictness
- Claude's discretion on overall strictness level (recommended vs strict) — pick what minimizes noise while catching real bugs
- Suppress `noExplicitAny` and double-cast rules now — enable in Phase 27 when types are cleaned up
- Enable React-specific lint rules (no array index as key, exhaustive hook deps, etc.)
- Enable accessibility lint rules now — surfaces issues before Phase 28 a11y work
- Enforce naming conventions (camelCase variables, PascalCase components)
- Auto-sort and organize imports on format
- Auto-fix unused imports/variables on format (remove automatically, don't just flag)
- No specific rule preferences from user — trust Claude's judgment on full rule config

### Formatting Style
- Claude's discretion — pick the style that minimizes diff churn against existing codebase conventions
- Existing codebase uses 2-space indent, likely double quotes, semicolons — scan and match

### Dependency Updates
- Update ALL packages including major version jumps: vite 7→8, @vitejs/plugin-react 4→6, jsdom 28→29, typescript 5.8→5.9
- Keep semver ^ ranges in package.json (don't pin exact versions)
- Claude's discretion on `npm audit fix` vs `--force` — resolve all high/critical vulns safely
- Claude's discretion on verification approach (build + tests minimum)

### CI Script Design
- CI-ready check script includes both `biome check` (lint+format) and `tsc --noEmit` (type check)
- Separate npm scripts: `lint` (biome lint), `format` (biome format --write), `check` (CI gate), `format:check` (biome format without write)
- Claude's discretion on pre-commit hooks (QUAL-03 is a future requirement — may skip or add basic hook)

### Claude's Discretion
- Overall Biome strictness level (recommended vs strict)
- Formatting style (indent, quotes, semicolons) — minimize churn
- Complexity rules (max function length, nesting depth)
- File exclusion patterns (node_modules, dist, src-tauri/target, generated code)
- Build pipeline integration (tsc + biome alongside)
- Migration approach (all-at-once vs incremental auto-fix)
- Commit structure (separate vs combined for Biome setup, auto-fix, dep updates)
- Handling of non-auto-fixable violations (manual fix vs biome-ignore, except Phase 27 scope items which get suppressed)
- Audit fix strategy (safe fix vs force)
- Verification approach after dep updates
- Pre-commit hook decision

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — TOOL-01 (Biome config + CI script), TOOL-02 (all source passes Biome), DEPS-01 (deps updated)

### Phase interdependencies
- `.planning/ROADMAP.md` — Phase 25 success criteria (biome check zero errors, CI script, deps updated, no audit vulns)
- Phase 27 will enable suppressed type rules (noExplicitAny, double-casts) — suppressions added here are temporary

### Project conventions
- `.planning/PROJECT.md` — Tech stack (Tailwind v4 with @tailwindcss/vite only, no postcss.config), key decisions table

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- No existing linter/formatter config — clean slate for Biome setup
- `package.json` has 4 scripts (dev, build, preview, tauri) — new lint/format/check scripts will be added

### Established Patterns
- Build: `tsc && vite build` — Biome check will run alongside, not replace tsc
- Tailwind v4 with `@tailwindcss/vite` only — no postcss.config.js or tailwind.config.js
- TypeScript ~5.8.3 with strict mode via tsconfig.json

### Integration Points
- `package.json` scripts section — new lint/format/check scripts
- `biome.json` — new config file at project root (taskflow/)
- `tsconfig.json` — may need minor adjustments for TS 5.9 compatibility
- `vite.config.ts` — may need updates for vite 8 / @vitejs/plugin-react 6

### Current Dependency State (12 outdated)
- Major jumps: @vitejs/plugin-react 4→6, vite 7→8, jsdom 28→29, typescript 5.8→5.9
- Minor/patch: @base-ui/react, @tailwindcss/vite, @tanstack/react-query, @types/node, shadcn, tailwindcss, vitest, zustand
- 1 high-severity vulnerability: undici (fixable via npm audit fix)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 25-tooling-dependencies*
*Context gathered: 2026-03-19*
