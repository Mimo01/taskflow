# Phase 25: Tooling & Dependencies - Research

**Researched:** 2026-03-19
**Domain:** Linting/formatting tooling (Biome), dependency management (npm)
**Confidence:** HIGH

## Summary

Phase 25 introduces Biome as the project's linter and formatter, creates CI-ready check scripts, and updates all npm dependencies to their latest compatible versions. The codebase is a clean slate for tooling -- no existing ESLint, Prettier, or Biome configuration exists. There are 162 TypeScript source files (~32K lines) to process.

The existing code style is consistent: 2-space indentation, single quotes (796 single-quote imports vs 57 double-quote imports from shadcn/ui generated code), semicolons used extensively (6,251 lines ending with semicolons). Biome configuration should match these conventions to minimize diff churn.

**Primary recommendation:** Install Biome 2.4.x, configure to match existing code style (single quotes, 2-space indent, semicolons), run `biome check --write` to auto-fix the entire codebase in one pass, then update dependencies starting with safe minor/patch updates before tackling the four major version jumps (vite 7->8, @vitejs/plugin-react 4->6, typescript 5.8->5.9, jsdom 28->29).

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Biome is the linter/formatter (not ESLint/Prettier)
- Suppress `noExplicitAny` and double-cast rules now -- enable in Phase 27 when types are cleaned up
- Enable React-specific lint rules (no array index as key, exhaustive hook deps, etc.)
- Enable accessibility lint rules now -- surfaces issues before Phase 28 a11y work
- Enforce naming conventions (camelCase variables, PascalCase components)
- Auto-sort and organize imports on format
- Auto-fix unused imports/variables on format (remove automatically, don't just flag)
- CI-ready check script includes both `biome check` (lint+format) and `tsc --noEmit` (type check)
- Separate npm scripts: `lint` (biome lint), `format` (biome format --write), `check` (CI gate), `format:check` (biome format without write)
- Update ALL packages including major version jumps: vite 7->8, @vitejs/plugin-react 4->6, jsdom 28->29, typescript 5.8->5.9
- Keep semver ^ ranges in package.json (don't pin exact versions)

### Claude's Discretion
- Overall Biome strictness level (recommended vs strict)
- Formatting style (indent, quotes, semicolons) -- minimize churn
- Complexity rules (max function length, nesting depth)
- File exclusion patterns (node_modules, dist, src-tauri/target, generated code)
- Build pipeline integration (tsc + biome alongside)
- Migration approach (all-at-once vs incremental auto-fix)
- Commit structure (separate vs combined for Biome setup, auto-fix, dep updates)
- Handling of non-auto-fixable violations (manual fix vs biome-ignore, except Phase 27 scope items which get suppressed)
- Audit fix strategy (safe fix vs force)
- Verification approach after dep updates
- Pre-commit hook decision

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TOOL-01 | Biome configured for linting and formatting with CI-ready check script | Biome 2.4.x config structure documented; npm scripts defined; file exclusion patterns identified |
| TOOL-02 | All existing source files pass Biome lint and format checks | Auto-fix strategy via `biome check --write`; suppression strategy for noExplicitAny; 162 source files scoped |
| DEPS-01 | All dependencies updated to latest compatible versions with no regressions | 12 outdated packages identified; 4 major version jumps researched; 1 high vuln (undici) fixable via npm audit fix |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @biomejs/biome | 2.4.8 | Linting + formatting + import sorting | Single tool replaces ESLint + Prettier + import-sort; 10-100x faster |

### Major Dependency Updates
| Package | Current | Target | Type |
|---------|---------|--------|------|
| vite | 7.3.1 | ^8.0.1 | Major -- Rolldown bundler, CJS interop changes |
| @vitejs/plugin-react | 4.7.0 | ^6.0.1 | Major -- Babel removed as dependency |
| typescript | ~5.8.3 | ~5.9.3 | Major -- strict null check changes, deprecated utility types |
| jsdom | 28.1.0 | ^29.0.0 | Major -- test environment |

### Minor/Patch Updates
| Package | Current | Target |
|---------|---------|--------|
| @base-ui/react | 1.2.0 | ^1.3.0 |
| @tailwindcss/vite | 4.2.1 | ^4.2.2 |
| @tanstack/react-query | 5.90.21 | ^5.91.2 |
| @types/node | 25.4.0 | ^25.5.0 |
| shadcn | 4.0.5 | ^4.1.0 |
| tailwindcss | 4.2.1 | ^4.2.2 |
| vitest | 4.0.18 | ^4.1.0 |
| zustand | 5.0.11 | ^5.0.12 |

### Packages to Remove
| Package | Reason |
|---------|--------|
| autoprefixer | Not used -- Tailwind v4 uses @tailwindcss/vite, no postcss pipeline |
| postcss | Not used -- same reason as above |

### Vulnerability Fix
| Package | Issue | Fix |
|---------|-------|-----|
| undici | 6 high-severity CVEs (7.0.0-7.23.0) | `npm audit fix` (safe, no --force needed) |

**Installation:**
```bash
cd taskflow
npm install --save-dev @biomejs/biome
npx biome init
```

## Architecture Patterns

### Biome Configuration (biome.json)

Place at `taskflow/biome.json` (project root). Recommended configuration:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.8/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true,
    "defaultBranch": "main"
  },
  "files": {
    "ignoreUnknown": true
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "jsxQuoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "all",
      "arrowParentheses": "always"
    },
    "globals": []
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "off",
        "noArrayIndexKey": "error"
      },
      "correctness": {
        "useExhaustiveDependencies": "warn"
      },
      "a11y": {
        "recommended": true
      },
      "style": {
        "useNamingConvention": {
          "level": "warn",
          "options": {
            "strictCase": false,
            "conventions": [
              { "selector": { "kind": "variable" }, "formats": ["camelCase", "PascalCase", "CONSTANT_CASE"] },
              { "selector": { "kind": "function" }, "formats": ["camelCase", "PascalCase"] },
              { "selector": { "kind": "typeLike" }, "formats": ["PascalCase"] }
            ]
          }
        }
      }
    }
  },
  "assist": {
    "actions": {
      "source": {
        "organizeImports": {
          "level": "error"
        }
      }
    }
  },
  "overrides": [
    {
      "includes": ["**/*.test.*", "**/*.spec.*", "**/test/**"],
      "linter": {
        "rules": {
          "suspicious": {
            "noExplicitAny": "off"
          }
        }
      }
    }
  ]
}
```

**Key design decisions in this config:**
- `"recommended": true` enables all recommended rules across all groups -- good baseline
- `noExplicitAny: "off"` -- suppressed per user decision; Phase 27 will enable
- `a11y.recommended: true` -- surfaces a11y issues for Phase 28
- `organizeImports` in assist actions -- auto-sorts imports on `biome check --write`
- `lineWidth: 100` -- wider than default 80 to avoid excessive line wrapping in JSX-heavy code
- Single quotes match 93% of existing codebase (796 vs 57 imports)
- File exclusion via `.gitignore` (vcs.useIgnoreFile: true) handles node_modules, dist, src-tauri/target

### npm Scripts Structure

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "lint": "biome lint ./src",
    "format": "biome format --write ./src",
    "format:check": "biome format ./src",
    "check": "biome check ./src && tsc --noEmit",
    "fix": "biome check --write ./src"
  }
}
```

**Note:** `biome check` runs lint + format + organize imports. The `check` script combines Biome and TypeScript checks for CI gating. The `fix` script is a convenience to auto-fix everything at once.

### Anti-Patterns to Avoid
- **Running biome on node_modules or dist:** Always scope to `./src` or let `.gitignore` exclude them
- **Using `biome format` for import sorting:** Import organization only runs via `biome check`, not `biome format`
- **Mixing ESLint and Biome:** Clean slate -- no ESLint config should exist

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Import sorting | Custom sort script | Biome organizeImports | Handles groups, aliases, side-effect imports |
| Format checking in CI | Custom diff script | `biome check --ci` or `biome format --check` | Proper exit codes, fast execution |
| Unused import removal | Manual cleanup | `biome check --write` with lint/correctness/noUnusedImports | Auto-removes on save/format |
| Dep vulnerability scanning | Manual review | `npm audit` | Standard tooling, machine-readable output |

## Common Pitfalls

### Pitfall 1: Vite 8 CJS Interop Breaking Existing Imports
**What goes wrong:** Vite 8 changed how CJS default exports are resolved. Libraries like `jira2md` that use CJS may have different import behavior.
**Why it happens:** Vite 8 ships Rolldown which handles CJS imports differently from esbuild.
**How to avoid:** After updating vite, run `npm run build` and check for "default is not a function" or "X is not a function" errors. If hit, use `legacy.inconsistentCjsInterop: true` in vite config temporarily, or update the import style.
**Warning signs:** Build succeeds but runtime errors on CJS library calls.

### Pitfall 2: @vitejs/plugin-react v6 Removes Babel
**What goes wrong:** If the project were using Babel plugins (e.g., decorators, macros), they would break with v6.
**Why it happens:** v6 removes Babel as a dependency, using Oxc for React Refresh instead.
**How to avoid:** This project does NOT use Babel (no .babelrc, no babel config in vite.config.ts). Safe to upgrade directly. No action needed.
**Warning signs:** N/A -- this project is safe.

### Pitfall 3: TypeScript 5.9 Strict Null Check Changes
**What goes wrong:** Generic constraint patterns that were previously inferred may now require explicit type parameters.
**Why it happens:** TS 5.9 tightened strict null checks in generic constraints.
**How to avoid:** After updating TypeScript, run `tsc --noEmit` and fix any new errors. Expect 0-10 errors in a project this size.
**Warning signs:** Type errors in generic utility functions or store factories.

### Pitfall 4: Biome Formatting Conflicts with shadcn Generated Code
**What goes wrong:** shadcn/ui components use double quotes (57 files). Biome will reformat them to single quotes.
**Why it happens:** shadcn generates code with its own style preferences.
**How to avoid:** This is fine -- let Biome normalize everything to single quotes. Consistent style is the goal. Future shadcn additions will be auto-formatted on next `biome check --write`.

### Pitfall 5: organizeImports Only Runs in `biome check`
**What goes wrong:** Running `biome format --write` does NOT sort imports. Developer expects imports to be sorted but they aren't.
**Why it happens:** Import organization is an assist action, not a formatter action.
**How to avoid:** Use `biome check --write` (the `fix` script) instead of `biome format --write` when you want everything including import sorting. Document this in the README or scripts.

### Pitfall 6: Removing postcss/autoprefixer May Affect Build
**What goes wrong:** Removing unused postcss/autoprefixer packages could theoretically break some transitive dependency.
**Why it happens:** Even though the project doesn't use them directly, some package might expect them.
**How to avoid:** Remove them, run `npm run build`, verify the build succeeds. Tailwind v4 with @tailwindcss/vite does not need postcss.

## Code Examples

### Biome Init and First Run
```bash
# Install
npm install --save-dev @biomejs/biome

# Create config (then customize)
npx biome init

# Auto-fix entire codebase
npx biome check --write ./src

# Verify zero errors remain
npx biome check ./src
```

### Suppressing Rules Per-File (for Phase 27 deferred items)
```typescript
// biome-ignore lint/suspicious/noExplicitAny: deferred to Phase 27 type cleanup
const value = response.data as any;
```

### CI Check Script
```bash
#!/bin/bash
# ci-check.sh -- fails on any lint, format, or type error
set -e
npx biome check ./src
npx tsc --noEmit
echo "All checks passed"
```

### Dependency Update Sequence
```bash
# 1. Safe minor/patch updates first
npm update

# 2. Fix vulnerability
npm audit fix

# 3. Major updates one at a time with verification
npm install typescript@~5.9.3
npx tsc --noEmit  # verify types

npm install vite@^8.0.1 @vitejs/plugin-react@^6.0.1
npm run build  # verify build

npm install --save-dev jsdom@^29.0.0
npx vitest run  # verify tests

# 4. Remove unused deps
npm uninstall autoprefixer postcss

# 5. Final verification
npm run build && npx vitest run
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ESLint + Prettier | Biome | 2024-2025 adoption wave | Single tool, 10-100x faster, unified config |
| Vite with esbuild/Rollup | Vite 8 with Rolldown | March 2026 | 10-30x faster builds, unified bundler |
| @vitejs/plugin-react with Babel | v6 without Babel (uses Oxc) | March 2026 | Smaller install, faster transforms |
| postcss + autoprefixer for Tailwind | @tailwindcss/vite (v4) | 2025 | No postcss config needed |

**Deprecated/outdated:**
- autoprefixer + postcss devDependencies: redundant with Tailwind v4's Vite plugin
- `moduleResolution: "node"` in tsconfig: TS 5.9 warns deprecation (this project uses "bundler" -- safe)

## Open Questions

1. **Naming convention strictness for existing code**
   - What we know: Biome's `useNamingConvention` can enforce camelCase/PascalCase
   - What's unclear: How many existing variables/functions violate conventions (e.g., API response properties, Jira field names like `customfield_10016`)
   - Recommendation: Set to "warn" initially. If too many violations from external API field names, add overrides for specific patterns or use `off` in service files

2. **Biome lineWidth choice**
   - What we know: Default is 80, many React projects use 100-120
   - What's unclear: Current average line length in the codebase
   - Recommendation: Use 100 -- JSX-heavy code often exceeds 80 chars; 100 is a good balance

3. **Pre-commit hooks (QUAL-03 is future requirement)**
   - What we know: QUAL-03 in future requirements asks for pre-commit hooks
   - What's unclear: Whether to add a basic hook now or defer entirely
   - Recommendation: Skip for Phase 25 -- QUAL-03 is explicitly a future requirement. Adding hooks now adds scope without requirement backing

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 (updating to 4.1.x) |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run --reporter=verbose 2>&1 \| tail -20` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TOOL-01 | Biome config exists and check passes | smoke | `cd taskflow && npx biome check ./src` | N/A -- CLI validation |
| TOOL-01 | CI check script runs lint+format+typecheck | smoke | `cd taskflow && npm run check` | N/A -- script validation |
| TOOL-02 | All source files pass Biome | smoke | `cd taskflow && npx biome check ./src` | N/A -- CLI validation |
| DEPS-01 | Build succeeds with updated deps | smoke | `cd taskflow && npm run build` | N/A -- build validation |
| DEPS-01 | Tests pass with updated deps | integration | `cd taskflow && npx vitest run` | Existing test suite |
| DEPS-01 | No high/critical audit vulns | smoke | `cd taskflow && npm audit --audit-level=high` | N/A -- CLI validation |

### Sampling Rate
- **Per task commit:** `npm run check && npx vitest run`
- **Per wave merge:** Full build + test suite + audit
- **Phase gate:** `npm run build && npm run check && npx vitest run && npm audit --audit-level=high`

### Wave 0 Gaps
None -- validation for this phase is entirely through CLI tools (biome check, tsc, npm audit, vitest) and the existing test suite. No new test files needed.

## Sources

### Primary (HIGH confidence)
- [Biome Configuration Reference](https://biomejs.dev/reference/configuration/) -- full config structure
- [Biome Formatter Docs](https://biomejs.dev/formatter/) -- indentWidth, quoteStyle options
- [Biome noExplicitAny Rule](https://biomejs.dev/linter/rules/no-explicit-any/) -- rule path and group
- [Biome Suppressions](https://biomejs.dev/analyzer/suppressions/) -- biome-ignore syntax
- [Biome organizeImports](https://biomejs.dev/assist/actions/organize-imports/) -- import sorting config
- [Vite 8 Migration Guide](https://vite.dev/guide/migration) -- breaking changes from v7
- [Vite 8 Announcement](https://vite.dev/blog/announcing-vite8) -- Rolldown integration
- [@vitejs/plugin-react npm](https://www.npmjs.com/package/@vitejs/plugin-react) -- v6 changelog, Babel removal
- [TypeScript 5.9 Release Notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-9.html) -- breaking changes
- npm registry (`npm view` commands) -- verified current versions
- npm outdated / npm audit -- verified from project

### Secondary (MEDIUM confidence)
- [Vite 8 Rolldown Migration Guide](https://byteiota.com/vite-8-rolldown-migration-guide-10-30x-faster-builds/) -- migration patterns
- [TypeScript 5.9 Developer Guide](https://www.digitalapplied.com/blog/typescript-5-9-new-features-developer-guide-2026) -- migration timeline estimates

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- versions verified via npm registry, configs verified via official docs
- Architecture: HIGH -- Biome config structure verified against official reference
- Pitfalls: HIGH -- Vite 8 and TS 5.9 breaking changes from official migration guides; project-specific analysis (no Babel, no postcss usage) verified by inspecting actual files

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable tooling, 30-day window)
