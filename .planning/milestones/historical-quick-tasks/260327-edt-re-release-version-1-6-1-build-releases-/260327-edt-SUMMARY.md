---
phase: quick-260327-edt
status: complete
date: 2026-03-27
---

# Quick Task Summary: Re-release v1.6.1

## What was done
- Built Taskflow v1.6.1 macOS universal binary locally (Intel + ARM)
- Uploaded 4 artifacts to GitHub release at Mimo01/taskflow-releases

## Artifacts published
| Asset | Size |
|-------|------|
| Taskflow_1.6.1_universal.dmg | 15.5 MB |
| Taskflow.app.tar.gz | 15.5 MB |
| Taskflow.app.tar.gz.sig | 408 B |
| latest.json | 1.8 KB |

## Release URL
https://github.com/Mimo01/taskflow-releases/releases/tag/v1.6.1

## Notes
- Only macOS artifacts — GitHub Actions minutes exhausted, no Windows/Linux builds
- Tauri signing key from ~/.tauri/taskflow.key (empty password)
- latest.json includes darwin-universal, darwin-x86_64, darwin-aarch64 platforms
