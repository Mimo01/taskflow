<div align="center">

<img src="assets/taskflow-icon.png" alt="Taskflow icon" width="112" height="112">

# Taskflow

**Jira, Tempo, GitLab and AIO Test Management in one fast desktop app.**

[![Release](https://img.shields.io/badge/release-v{{VERSION}}-2563eb?style=flat-square)](https://github.com/Mimo01/taskflow-releases/releases/tag/v{{VERSION}})
![Platforms](https://img.shields.io/badge/platforms-macOS%20%C2%B7%20Windows%20%C2%B7%20Linux-475569?style=flat-square)
[![Released](https://img.shields.io/static/v1?label=released&message={{DATE}}&color=475569&style=flat-square)](https://github.com/Mimo01/taskflow-releases/releases/tag/v{{VERSION}})
![Auto-updates](https://img.shields.io/badge/auto--updates-built%20in-16a34a?style=flat-square)

[Download](#download) · [Installation](#installation) · [Release notes](https://github.com/Mimo01/taskflow-releases/releases/tag/v{{VERSION}}) · [All releases](https://github.com/Mimo01/taskflow-releases/releases)

</div>

---

## Download

Latest version: **v{{VERSION}}** — released {{DATE}}

| Platform | Package | Notes |
| :-- | :-- | :-- |
| **macOS** · Apple silicon & Intel | [Taskflow_{{VERSION}}_universal.dmg](https://github.com/Mimo01/taskflow-releases/releases/download/v{{VERSION}}/Taskflow_{{VERSION}}_universal.dmg) | Universal disk image |
| **Windows** · 64-bit | [Taskflow_{{VERSION}}_x64-setup.exe](https://github.com/Mimo01/taskflow-releases/releases/download/v{{VERSION}}/Taskflow_{{VERSION}}_x64-setup.exe) | Installer — recommended |
| | [Taskflow_{{VERSION}}_x64_en-US.msi](https://github.com/Mimo01/taskflow-releases/releases/download/v{{VERSION}}/Taskflow_{{VERSION}}_x64_en-US.msi) | MSI for managed deployment |
| **Linux** · x86_64 | [Taskflow_{{VERSION}}_amd64.AppImage](https://github.com/Mimo01/taskflow-releases/releases/download/v{{VERSION}}/Taskflow_{{VERSION}}_amd64.AppImage) | Portable, any distribution |
| | [Taskflow_{{VERSION}}_amd64.deb](https://github.com/Mimo01/taskflow-releases/releases/download/v{{VERSION}}/Taskflow_{{VERSION}}_amd64.deb) | Debian / Ubuntu |

## What's inside

- **My Tasks & Standup** — your sprint work, yesterday's worklogs and today's plan in one view
- **Sprint board & Backlog** — drag-to-transition board, filters, quick create
- **Releases** — fix versions matched to GitLab branches, milestones and merge requests, with drift detection and one-click fixes
- **Epics** — portfolio progress, time and forecasts
- **Test cycles** — AIO Test Management execution status and defects
- **Worklogs** — Tempo timesheets for you and your team
- **Search & notifications** — across Jira and GitLab, with desktop alerts

## Installation

### macOS

1. Open the `.dmg` and drag **Taskflow** into **Applications**.
2. Taskflow is not notarized by Apple, so macOS blocks the first launch. Clear the quarantine flag once:

   ```sh
   xattr -dr com.apple.quarantine /Applications/Taskflow.app
   ```

### Windows

Run the installer. If SmartScreen shows *Windows protected your PC*, choose **More info → Run anyway**.

### Linux

**AppImage**

```sh
chmod +x Taskflow_{{VERSION}}_amd64.AppImage
./Taskflow_{{VERSION}}_amd64.AppImage
```

On Ubuntu 22.04 and newer, install `libfuse2` if the AppImage does not start.

**Debian / Ubuntu**

```sh
sudo apt install ./Taskflow_{{VERSION}}_amd64.deb
```

## Getting started

On first launch Taskflow asks for personal access tokens for Jira and GitLab. Tokens are stored in your operating system's keychain and are only sent to the servers you configure.

## Updates

Taskflow checks for new versions and offers to install them in place on macOS, Windows and the AppImage. The `.deb` package does not self-update — install the new package from this page.

---

<div align="center">
<sub>This repository hosts Taskflow release builds. Release notes for every version are on the <a href="https://github.com/Mimo01/taskflow-releases/releases">Releases</a> page.</sub>
</div>
