# Quick Task 260329-k5y: Implement changelog and versioning process inspired by pmkar project - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Task Boundary

Implement a proper changelog and versioning process for Tasker/Taskflow, inspired by the pmkar project's approach. Replace the custom shell-based changelog generation with git-cliff and add a unified bump/release workflow.

</domain>

<decisions>
## Implementation Decisions

### Changelog Tool
- Use **git-cliff** with a `cliff.toml` config file (same approach as pmkar)
- Configure conventional commit parsing with proper categorization (Features, Bug Fixes, Refactoring, etc.)
- Skip GSD planning docs commits (`docs(quick`, `docs(gsd`) and version bump commits from changelog
- Place `cliff.toml` in the `taskflow/` directory alongside existing build config

### Changelog Storage
- **Both file + tag annotations**: Generate a `CHANGELOG.md` file AND keep tag annotations
- CHANGELOG.md is regenerated on each version bump (full history)
- Tag annotations still used for GitHub Release notes via the release workflow

### Bump Workflow
- **Single bump script with auto-commit**: Replace current `release.sh` + `generate-changelog.sh` with a new unified script
- One command: updates all 3 version files (package.json, Cargo.toml, tauri.conf.json), regenerates CHANGELOG.md, auto-commits, creates git tag, and pushes
- Similar to pmkar's `bump-version.mjs` but with the auto-commit behavior of current `release.sh`
- Keep `inject-version.cjs` for build-time version injection (it serves a different purpose — ensuring build artifacts match the tag)

### Claude's Discretion
- cliff.toml configuration details (commit groups, skip patterns, template format)
- Whether to keep old generate-changelog.sh as a fallback or remove it entirely
- npm script naming conventions for the new workflow

</decisions>

<specifics>
## Specific Ideas

- pmkar's cliff.toml skips `docs(quick` and `docs(gsd` commits — apply same pattern since Tasker uses GSD
- pmkar skips `chore: bump version` commits — apply same pattern
- Current release.yml workflow extracts tag body for GitHub Release notes — keep this working with the new approach
- The bump script should validate semver format like pmkar's does

</specifics>

<canonical_refs>
## Canonical References

- pmkar bump script: `~/Desktop/pmkar/scripts/bump-version.mjs`
- pmkar cliff config: `~/Desktop/pmkar/cliff.toml`
- Current Tasker release script: `taskflow/scripts/release.sh`
- Current Tasker changelog generator: `taskflow/scripts/generate-changelog.sh`
- Current Tasker version injector: `taskflow/scripts/inject-version.cjs`

</canonical_refs>
