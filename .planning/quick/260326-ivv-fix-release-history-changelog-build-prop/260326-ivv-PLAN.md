---
phase: quick
plan: 260326-ivv
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/scripts/release.sh
  - taskflow/scripts/generate-changelog.sh
autonomous: true
requirements: []
must_haves:
  truths:
    - "Running release.sh auto-generates a formatted markdown changelog from conventional commits between tags"
    - "The GitHub Release body shows categorized changes (features, fixes, etc.) not raw commit text"
    - "The app's Release History and WhatsNew dialog display properly formatted changelogs"
  artifacts:
    - path: "taskflow/scripts/generate-changelog.sh"
      provides: "Changelog generation from git log between tags"
    - path: "taskflow/scripts/release.sh"
      provides: "Updated release script that calls changelog generator"
  key_links:
    - from: "taskflow/scripts/release.sh"
      to: "taskflow/scripts/generate-changelog.sh"
      via: "shell invocation to build tag message body"
    - from: "taskflow/scripts/release.sh"
      to: "git tag -a with multi-line changelog"
      via: "tag annotation body flows to CI tag_body step then to releaseBody"
---

<objective>
Fix release changelog generation so GitHub Releases (and thus the app's Release History / WhatsNew dialog) show properly formatted, categorized changelogs instead of single-line commit text.

Purpose: Currently `release.sh` accepts a freeform message string that becomes the entire tag annotation. For v1.6, this resulted in "Fix updater ACL permission and dev build update prompts" as the only release body text. The app's VersionHistoryList and WhatsNewDialog render this body via ReactMarkdown, so a well-structured markdown changelog will display correctly with no frontend changes needed.

Output: Updated release script + changelog generator script that auto-builds categorized markdown from conventional commits between the previous tag and the new tag.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/scripts/release.sh
@.github/workflows/release.yml
@taskflow/src/routes/settings/UpdatesSection.tsx (VersionHistoryList reads release.body via GitHub API)
@taskflow/src/components/update/WhatsNewDialog.tsx (renders lastSeenChangelog as markdown)

The data flow is:
1. `release.sh` creates annotated git tag with `-m` message
2. CI extracts tag body via `git tag -l --format='%(contents:body)'`
3. CI passes body as `releaseBody` to tauri-action which creates GitHub Release
4. App fetches GitHub Releases API, displays `release.body` as markdown
5. On update, `changelog` from Tauri updater (sourced from release notes) is stored and shown in WhatsNewDialog

So the ONLY change needed is in step 1: make the tag message contain proper markdown changelog.
No frontend changes required.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create changelog generator script</name>
  <files>taskflow/scripts/generate-changelog.sh</files>
  <action>
    Create `taskflow/scripts/generate-changelog.sh` — a standalone bash script that generates a categorized markdown changelog from conventional commits.

    Input: Takes two optional args: `$1` = new tag (default: HEAD), `$2` = previous tag (default: auto-detect via `git describe --tags --abbrev=0 HEAD~1` or latest tag before $1).

    Logic:
    1. Get the commit range: `$PREV_TAG..$NEW_REF`
    2. Parse `git log --format='%s' $RANGE` for conventional commit prefixes
    3. Categorize commits into sections:
       - `feat(` or `feat:` -> "Features"
       - `fix(` or `fix:` -> "Bug Fixes"
       - `refactor(` or `refactor:` -> "Improvements"
       - `test(` or `test:` -> skip (not user-facing)
       - `docs(` or `docs:` -> skip (not user-facing)
       - `ci(` or `ci:` -> skip (not user-facing)
       - `chore(` or `chore:` -> skip (not user-facing)
       - anything else without a conventional prefix -> "Other Changes"
    4. For each commit, extract the description part (strip the `type(scope): ` prefix), capitalize first letter
    5. Output markdown to stdout in this format:
       ```
       ### Features
       - Description of feature 1
       - Description of feature 2

       ### Bug Fixes
       - Description of fix 1
       ```
    6. If no user-facing commits found (all docs/test/ci/chore), output a single line: "Internal improvements and maintenance."
    7. Make the script executable (`chmod +x`).

    Keep it pure bash — no node/npm dependencies. Use `sed` and `grep` for parsing.
    The script outputs to stdout only (no file writing) so release.sh can capture it.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && bash scripts/generate-changelog.sh v1.6 v1.5 | head -30</automated>
  </verify>
  <done>Script exists, is executable, and produces categorized markdown changelog from commits between two tags. Output includes section headers (### Features, ### Bug Fixes, etc.) with bullet-pointed descriptions.</done>
</task>

<task type="auto">
  <name>Task 2: Update release.sh to auto-generate changelog</name>
  <files>taskflow/scripts/release.sh</files>
  <action>
    Update `taskflow/scripts/release.sh` to auto-generate the changelog when no custom message is provided.

    Changes:
    1. Keep the existing usage pattern: `./scripts/release.sh <tag> [message]`
    2. When `$2` is NOT provided (no custom message):
       - Auto-detect the previous tag: `PREV_TAG=$(git describe --tags --abbrev=0 HEAD 2>/dev/null || echo "")`
       - Call `bash "$(dirname "$0")/generate-changelog.sh" "$TAG" "$PREV_TAG"` to generate changelog body
       - Construct the tag message as: first line is tag name, blank line, then changelog body
       - Use `git tag -a "$TAG" -F -` with a heredoc/pipe to pass multi-line message (since `-m` doesn't handle multi-line well for tag body extraction)
    3. When `$2` IS provided: use it as-is (backward compatible), but still pass via `-F -` for consistency
    4. Print the generated changelog to the terminal before tagging so the user can see what will be published

    The key insight: `git tag -l --format='%(contents:body)'` extracts everything AFTER the first line (subject) and blank line. So the tag message format must be:
    ```
    v1.7

    ### Features
    - Something new

    ### Bug Fixes
    - Something fixed
    ```

    This way `%(contents:subject)` = "v1.7" and `%(contents:body)` = the changelog markdown.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && bash -n scripts/release.sh && echo "Syntax OK"</automated>
  </verify>
  <done>release.sh auto-generates categorized markdown changelog when run without a message argument. The tag annotation body contains properly formatted markdown that will flow through CI to GitHub Releases to the app display.</done>
</task>

</tasks>

<verification>
1. `bash -n taskflow/scripts/generate-changelog.sh` — no syntax errors
2. `bash -n taskflow/scripts/release.sh` — no syntax errors
3. `cd taskflow && bash scripts/generate-changelog.sh v1.6 v1.5` — produces markdown with section headers
4. Verify the output contains `### Features` or `### Bug Fixes` sections (v1.5..v1.6 has both feat and fix commits)
</verification>

<success_criteria>
- generate-changelog.sh produces categorized markdown from conventional commits between two tags
- release.sh auto-generates changelog when no message argument given
- release.sh remains backward-compatible (custom message still works)
- The generated markdown will render correctly in the app's ReactMarkdown components (VersionHistoryList and WhatsNewDialog) with no frontend changes
</success_criteria>

<output>
After completion, create `.planning/quick/260326-ivv-fix-release-history-changelog-build-prop/260326-ivv-SUMMARY.md`
</output>
