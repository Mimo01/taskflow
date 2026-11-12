# Writing release notes

Release notes are short: a headline sentence, then a few titled bullets. Claude writes them for each release from the git log and pipes them into `scripts/release.sh`.

The same text goes everywhere: `CHANGELOG.md`, the git tag annotation, the GitHub release body and the in-app "Update available", "What's new" and Settings → Updates views. There is no separate long version.

## Format

```
One headline sentence.

### New
- **Title** — short clause
- **Title only**

### Improved
- **Title**

### Fixed
- Several small fixes, collapsed into one bullet
```

- One headline sentence first (plain paragraph).
- Then `### New`, `### Improved`, `### Fixed`. Use `### Removed` or `### Security` when needed. Older notes used `Added` / `Changed`; the app understands both.
- A bullet is `**Bold title**`, optionally followed by ` — ` and ONE short clause (a few words). No multi-sentence descriptions.
- Collapse fixes into 1-3 bullets. A plain (non-bold) bullet is fine for a comma-joined list of fixes.

## Approved example

```
Notifications got a full redesign.

### New
- **Notification panel** — stacks per issue, quick actions
- **Epic picker on stories**
- **Searchable pickers** in Settings and setup

### Improved
- **Attachment tiles**
- **No active sprint** messaging

### Fixed
- Duplicate notifications, package mismatches, peek over-scroll
```

## Lint

`release.sh` and `bump-version.mjs` lint the notes before anything is written. A failure leaves the tree untouched. Limits live in `src/lib/release-notes/lint.ts` (`LIMITS`):

| Rule | Limit |
|---|---|
| Headline | present, one sentence, at most 120 chars |
| Bold-titled bullet: title | at most 50 chars (applies to bold-titled bullets only) |
| Bold-titled bullet: detail | at most 70 chars, no `. ` or `;` |
| Plain (non-bold) bullet | whole bullet at most 90 chars (no separate title limit) |
| Bullets per section | at most 6 |
| Fixed bullets | at most 3 |
| Bullets in total | at most 14 |
| Sections | at least one `###` section |

An unknown `###` heading only warns.

Override with `--allow-wordy-notes` (errors become warnings):

```
printf '...' | ./scripts/release.sh 1.15.0 --allow-wordy-notes
```

With `--skip-bump` the already-committed CHANGELOG section is only checked in warn-only mode, so a historical entry never blocks.

Check notes by hand: `printf '...' | node scripts/lint-release-notes.mjs`.

## Compatibility

The notes are plain GitHub markdown (paragraph, `###` headings, bullets), so older installed clients render them with their markdown view as before. The tag is created with `--cleanup=verbatim` so the `###` lines survive. Never lose that flag.

## Deriving notes from the git log

1. `git log --oneline <last-tag>..HEAD` (user-facing commits only).
2. Group by what a user notices: New, Improved, Fixed.
3. Write the headline last: one sentence describing the release theme.
4. Reduce each item to a short bold title; add a clause only if the title is unclear.
5. Merge small fixes into 1-3 bullets.
6. Pipe it to `release.sh` and fix whatever the lint reports.
