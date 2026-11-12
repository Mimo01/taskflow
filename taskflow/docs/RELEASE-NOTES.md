# Writing release notes

Release notes are short: a headline sentence, then a few titled bullets. Claude writes them for each release from the git log and pipes them into `scripts/release.sh`.

The same text goes everywhere: `CHANGELOG.md`, the git tag annotation, the GitHub release body and the in-app "Update available", "What's new" and Settings → Updates views. There is no separate long version.

## Format

```
One headline sentence.

### New
- Notification panel with stacks and quick actions
- Change a story's epic from its sidebar

### Improved
- Attachments show as a tile grid

### Fixed
- Duplicate notifications
- Peek panel scrolling into blank space
```

- One headline sentence first (plain paragraph). It is also the one-line summary in Settings → Updates.
- Then `### New`, `### Improved`, `### Fixed`. Use `### Removed` or `### Security` when needed. New notes must use these names (the lint rejects `Added` / `Changed`); the app still reads older notes that used them.
- Every bullet is ONE plain, short, complete phrase written from the user's view: what they can now do or what now works. Sentence case, no trailing period, no bold, no `Title — fragment` split.
- One change per bullet: no comma-joined lists. Each fix is its own line; list only the fixes a user would notice (at most 5).
- Prefer under 60 characters; the lint stops at 70.

## Lint

`release.sh` and `bump-version.mjs` lint the notes before anything is written; with `--skip-bump` the committed CHANGELOG section is linted the same way. A failure leaves the tree untouched. Limits live in `src/lib/release-notes/lint.ts` (`LIMITS`, `ALLOWED_HEADINGS`):

| Rule | Limit |
|---|---|
| Headline | present, one sentence, at most 65 chars (measured: widest glyph rate 7.15px/char fits the narrowest summary column, 471px) |
| Bullet | one plain sentence, at most 70 chars, no bold / no `Title — detail` |
| Headings | `### New`, `### Improved`, `### Fixed`, `### Removed`, `### Security` only |
| Bullets per section | at most 6 |
| Fixed bullets | at most 5 |
| Bullets in total | at most 14 |

Override with `--allow-wordy-notes` (errors become warnings) only when the user asks:

```
printf '...' | ./scripts/release.sh 1.15.0 --allow-wordy-notes
```

Check notes by hand: `printf '...' | node scripts/lint-release-notes.mjs`.

## Compatibility

`CHANGELOG.md` is bundled into the app (`src/lib/release-notes/bundled.ts`). For every X.Y.Z version it contains, the in-app history, the skipped-version roll-up and What's new show the CHANGELOG text instead of the GitHub release body. The CHANGELOG history was rewritten in this format on 2026-11-12 (version headers and dates unchanged), and the published GitHub release bodies plus the 1.14.20 `latest.json` notes were updated to match the same day (backup of the previous bodies kept outside the repo). Git tag annotations keep the original text. Releases newer than an installed build fall back to their GitHub body, so keep new notes short there too. A test lints every shipped CHANGELOG section.

The notes are plain GitHub markdown (paragraph, `###` headings, bullets), so older installed clients render them with their markdown view as before. The tag is created with `--cleanup=verbatim` so the `###` lines survive. Never lose that flag.

## Deriving notes from the git log

1. `git log --oneline <last-tag>..HEAD` (user-facing commits only).
2. Group by what a user notices: New, Improved, Fixed.
3. Write the headline last: one sentence describing the release theme.
4. Write each item as one short plain phrase (what the user can now do / what now works).
5. One fix per line; keep the 5 most noticeable.
6. Pipe it to `release.sh` and fix whatever the lint reports.
