# Quick Task 260329-k5y: Implement Changelog and Versioning Process - Research

**Researched:** 2026-03-29
**Domain:** git-cliff changelog generation, Tauri version bumping, release automation
**Confidence:** HIGH

## Summary

The task replaces Tasker's custom shell-based changelog generation (`generate-changelog.sh`) and manual release flow (`release.sh`) with git-cliff and a unified Node.js bump script modeled on pmkar's `bump-version.mjs`. git-cliff is available via npx (v2.12.0) and works retroactively against all existing tags (v0.1.0 through v1.6.1). The pmkar cliff.toml already handles GSD commit filtering and conventional commit categorization -- it needs minimal adaptation for Tasker.

**Primary recommendation:** Adapt pmkar's bump-version.mjs to auto-commit + tag + push, place cliff.toml in `taskflow/`, and update release.sh to be a thin wrapper that runs checks then calls the bump script.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use **git-cliff** with a `cliff.toml` config file (same approach as pmkar)
- Configure conventional commit parsing with proper categorization (Features, Bug Fixes, Refactoring, etc.)
- Skip GSD planning docs commits (`docs(quick`, `docs(gsd`) and version bump commits from changelog
- Place `cliff.toml` in the `taskflow/` directory alongside existing build config
- **Both file + tag annotations**: Generate `CHANGELOG.md` AND keep tag annotations
- CHANGELOG.md regenerated on each version bump (full history)
- Tag annotations used for GitHub Release notes via release workflow
- **Single bump script with auto-commit**: Replace current `release.sh` + `generate-changelog.sh` with unified script
- One command: updates 3 version files, regenerates CHANGELOG.md, auto-commits, creates git tag, and pushes
- Keep `inject-version.cjs` for build-time version injection

### Claude's Discretion
- cliff.toml configuration details (commit groups, skip patterns, template format)
- Whether to keep old generate-changelog.sh as a fallback or remove it entirely
- npm script naming conventions for the new workflow

### Deferred Ideas (OUT OF SCOPE)
None specified.
</user_constraints>

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| git-cliff | 2.12.0 | Changelog generation from conventional commits | Verified available via `npx git-cliff` -- no global install needed |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| inject-version.cjs | Build-time version injection from git tag | CI builds -- unchanged, keep as-is |

## Architecture: What to Build

### Files to Create/Modify

```
taskflow/
  cliff.toml              # NEW - git-cliff config (adapted from pmkar)
  CHANGELOG.md            # NEW - generated, full history
  scripts/
    bump-version.mjs      # NEW - unified bump script
    release.sh            # MODIFY - thin wrapper calling bump script
    generate-changelog.sh # DELETE - replaced by git-cliff
    inject-version.cjs    # KEEP - unchanged
  package.json            # MODIFY - add npm scripts
```

### bump-version.mjs Design

Based on pmkar's script with these additions for auto-commit + tag + push:

1. **Validate** semver format (`/^\d+\.\d+\.\d+$/`)
2. **Update 3 files**: package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml (same logic as pmkar)
3. **Run git-cliff** to regenerate CHANGELOG.md: `npx git-cliff --config cliff.toml --tag v{version} -o CHANGELOG.md`
4. **Generate tag body** (just this version's notes): `npx git-cliff --config cliff.toml --tag v{version} --unreleased --strip header`
5. **Git commit**: `git add -A && git commit -m "chore: bump version to {version}"`
6. **Git tag** with annotation body from step 4: `git tag -a v{version} -F -` (pipe tag body)
7. **Git push**: `git push origin main && git push origin v{version}`

Key difference from pmkar: pmkar prints the git commands for the user to run manually. Tasker's script auto-executes them (matching current release.sh behavior).

### cliff.toml Configuration

Use pmkar's config nearly verbatim. It already handles:
- Skipping `docs(quick` and `docs(gsd` commits
- Skipping `chore: bump version` commits
- Grouping: Features, Bug Fixes, Refactoring, Performance, Testing, Documentation, Miscellaneous, CI/CD
- Tag pattern: `v[0-9]*`
- Sort: newest first

**One addition to consider:** Also skip `chore(quick` pattern if any quick-task commits use that prefix (checking existing history: current GSD commits use `docs(quick-...` so pmkar's pattern is sufficient).

### Tag Annotation for Release Notes

The release workflow extracts tag body via `git tag -l --format='%(contents:body)'`. The bump script must produce tag annotations where:
- **Subject line**: `v{version}` (the tag name)
- **Body**: The changelog for just this version (not full history)

To generate just-this-version notes for the tag body:
```bash
npx git-cliff --config cliff.toml --tag v{version} --unreleased --strip header
```

This outputs only the unreleased commits grouped under the new tag, without the `## [version]` header -- suitable for the tag annotation body.

### npm Scripts

```json
{
  "bump": "node scripts/bump-version.mjs",
  "release": "bash scripts/release.sh"
}
```

**Recommendation:** Keep `release` as the primary user-facing script (runs tests + lint first, then calls bump). Add `bump` as a direct shortcut for when checks have already been run.

### Updated release.sh

Slim down to:
1. Accept version arg (not tag -- e.g., `1.7.0` not `v1.7`)
2. Run tests: `npx vitest run`
3. Run lint+typecheck: `npm run check`
4. Call bump script: `node scripts/bump-version.mjs $VERSION`

The bump script handles everything from file updates through push.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Changelog from commits | Custom bash parsing (generate-changelog.sh) | git-cliff with cliff.toml |
| Conventional commit categorization | Regex in shell script | git-cliff commit_parsers |
| Full changelog regeneration | Concatenating per-version changelogs | `git-cliff -o CHANGELOG.md` (regenerates all history) |

## Common Pitfalls

### Pitfall 1: git-cliff --unreleased with --tag
**What goes wrong:** Without `--tag`, unreleased commits show under `[Unreleased]` header. With `--tag v1.7.0`, they show under `[1.7.0]` -- but the tag doesn't exist yet in git.
**How to avoid:** This is correct behavior. git-cliff's `--tag` flag is a "pretend this tag exists" flag for pre-tag generation. Always pass `--tag v{version}` when generating both CHANGELOG.md and tag body.

### Pitfall 2: Retroactive CHANGELOG.md has non-conventional commits
**What goes wrong:** 18 commits in Tasker history don't follow conventional format and get skipped (verified: git-cliff warns about parse errors).
**How to avoid:** This is expected. `filter_unconventional = true` skips them cleanly. The changelog will be incomplete for older versions but accurate going forward.

### Pitfall 3: CWD matters for git-cliff
**What goes wrong:** git-cliff must run from the git root (or wherever tags are visible), but `cliff.toml` is in `taskflow/`.
**How to avoid:** In bump-version.mjs, use `--config cliff.toml` and set `cwd` to `taskflow/` for the file output, but git operations need the repo root. Solution: run git-cliff from repo root with `--config taskflow/cliff.toml -o taskflow/CHANGELOG.md`.

**Actually -- important correction:** The bump script runs from `taskflow/` (like pmkar's runs from its root). Since `taskflow/` is NOT the git root (git root is `Tasker/`), the script must either:
- Run git-cliff from `Tasker/` (repo root): `execSync('npx git-cliff --config taskflow/cliff.toml -o taskflow/CHANGELOG.md', { cwd: REPO_ROOT })`
- Or use `--repository` flag to point git-cliff at the repo root

**Recommendation:** Set the script's working concept around REPO_ROOT (one level up from `taskflow/`), similar to how inject-version.cjs uses `path.join(__dirname, '..')` but then going one more level up for git operations.

### Pitfall 4: release.yml tag_body extraction still works
**What goes wrong:** If the tag annotation format changes, CI won't get release notes.
**How to avoid:** The bump script must create tags with the same format release.yml expects: `printf "%s\n\n%s\n" "v{version}" "$TAG_BODY" | git tag -a v{version} -F -`. This matches the current release.sh pattern exactly.

## Discretion Recommendations

### Remove generate-changelog.sh
**Recommendation: Remove it.** git-cliff is strictly superior and the old script is now redundant. No fallback needed -- if git-cliff fails, the bump script fails loudly.

### Script naming
**Recommendation:**
- `npm run release` -- full flow with tests (user-facing)
- `npm run bump` -- just version bump, no tests (for quick re-runs after test failure)

## Sources

### Primary (HIGH confidence)
- pmkar `bump-version.mjs` and `cliff.toml` -- read directly from local filesystem
- Current Tasker scripts (release.sh, generate-changelog.sh, inject-version.cjs) -- read from local filesystem
- git-cliff v2.12.0 verified working via `npx git-cliff` against Tasker repo with retroactive tag generation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- git-cliff verified working locally
- Architecture: HIGH -- pmkar pattern proven, adaptation straightforward
- Pitfalls: HIGH -- tested retroactive generation, identified CWD issue empirically

**Research date:** 2026-03-29
**Valid until:** 2026-04-28
