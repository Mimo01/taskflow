# Phase 41: CI Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 41-ci-pipeline
**Areas discussed:** Repo strategy, Code signing, Release workflow, Build matrix

---

## Repo Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| CI pushes to public repo | GitHub Actions on private repo builds, uses deploy key/PAT to create Release on public repo | ✓ |
| Single repo with private code + public releases | One repo, source private, releases public | |
| GitHub Actions artifact + manual publish | CI uploads to workflow run, manual release creation | |

**User's choice:** CI pushes to public repo (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Not created yet | User will set up repos | ✓ (initially) |
| Already created | Share org/repo names | |

**User's choice:** Initially "not created yet", then created public repo at `Mimo01/taskflow-releases`. Private repo confirmed as `Mimo01/taskflow`.

**Notes:** User asked Claude to suggest the public repo name. Claude recommended `Mimo01/taskflow-releases` based on the private repo name `Mimo01/taskflow`. User created it at https://github.com/Mimo01/taskflow-releases.git.

---

## Code Signing

| Option | Description | Selected |
|--------|-------------|----------|
| Skip signing for now | Ship unsigned, users bypass OS warnings. Zero cost. | ✓ |
| macOS only ($99/yr) | Sign + notarize macOS builds | |
| Both platforms | Sign macOS + Windows | |

**User's choice:** Skip signing for now (Recommended)

---

## Release Workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Manual markdown in tag annotation | Write release notes in `git tag -a` message. CI extracts for GitHub Release body. | ✓ |
| Auto-generated from commits | CI generates from conventional commits | |
| CHANGELOG.md file | Maintain changelog file, CI reads matching section | |

**User's choice:** Manual markdown in tag annotation (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| v* semver tags | Tags like v1.6.0, trigger on `v[0-9]*` | ✓ (Claude's discretion) |
| release/* tags | Tags like release/1.6.0 | |

**User's choice:** "You decide" — Claude selected v* semver tags (standard convention)

| Option | Description | Selected |
|--------|-------------|----------|
| Fully automatic | Tag push → build → publish, no manual gate | ✓ |
| Manual approval | GitHub environment approval step before publish | |

**User's choice:** Fully automatic (Recommended)

---

## Build Matrix

| Option | Description | Selected |
|--------|-------------|----------|
| Both aarch64 + x86_64 | Two separate builds for Apple Silicon + Intel | |
| aarch64 only | Apple Silicon only, Intel via Rosetta 2 | |
| Universal binary | Single fat binary for both architectures | ✓ |

**User's choice:** Universal binary

| Option | Description | Selected |
|--------|-------------|----------|
| Tauri defaults | Full set: .dmg + .app.tar.gz, .msi + .nsis + .nsis.zip, .deb + .AppImage + .AppImage.tar.gz | |
| Minimal — updater + one installer | One updater artifact + one installer per platform | ✓ |

**User's choice:** Minimal — updater + one installer

---

## Claude's Discretion

- Tag format: v* semver (user deferred)
- GitHub Actions runner versions
- Cross-repo publish mechanism (deploy key vs PAT)
- Tag annotation extraction method
- Tauri CLI flags for universal binary
- Artifact naming convention
- Whether to run tests before building

## Deferred Ideas

- macOS code signing + notarization — future phase
- Windows code signing — future phase
- Multiple update channels — out of scope per REQUIREMENTS.md
