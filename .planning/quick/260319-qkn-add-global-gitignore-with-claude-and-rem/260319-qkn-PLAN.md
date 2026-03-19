---
phase: quick
plan: 260319-qkn
type: execute
wave: 1
depends_on: []
files_modified:
  - ~/.gitignore_global
  - .gitignore
autonomous: true
requirements: [QUICK]

must_haves:
  truths:
    - ".claude directory is not tracked by git in this repo"
    - "Global gitignore is configured and excludes .claude"
    - "Local .gitignore exists with .claude entry as fallback"
  artifacts:
    - path: "~/.gitignore_global"
      provides: "Global git ignore rules"
      contains: ".claude"
    - path: ".gitignore"
      provides: "Project-level git ignore rules"
      contains: ".claude"
  key_links:
    - from: "~/.gitignore_global"
      to: "git config --global core.excludesfile"
      via: "git global config"
      pattern: "core.excludesfile"
---

<objective>
Set up a global gitignore with `.claude` excluded, remove `.claude` from git tracking in this repo, and add a local `.gitignore` as well.

Purpose: Stop tracking Claude Code config/agent files that are machine-specific and should not be in version control.
Output: Global gitignore configured, .claude removed from git index, local .gitignore created.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
No prior plans needed. Self-contained task.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create global gitignore and configure git</name>
  <files>~/.gitignore_global</files>
  <action>
    1. Create `~/.gitignore_global` with these entries:
       ```
       # Claude Code
       .claude/
       ```
    2. Configure git to use it: `git config --global core.excludesfile ~/.gitignore_global`
    3. Verify the config is set: `git config --global core.excludesfile`

    NOTE: If ~/.gitignore_global already exists, APPEND to it rather than overwriting. Check first.
  </action>
  <verify>
    <automated>git config --global core.excludesfile | grep -q gitignore_global && echo "PASS" || echo "FAIL"</automated>
  </verify>
  <done>Global gitignore exists at ~/.gitignore_global with .claude/ entry, git config points to it.</done>
</task>

<task type="auto">
  <name>Task 2: Remove .claude from git tracking and create local .gitignore</name>
  <files>.gitignore</files>
  <action>
    1. Create `.gitignore` in the project root with:
       ```
       # Claude Code
       .claude/
       ```
    2. Remove .claude from git index (keep files on disk): `git rm -r --cached .claude/`
    3. Commit the changes: the .gitignore addition and the removal of .claude from tracking.
       Commit message: "chore: add gitignore and remove .claude from git tracking"

    IMPORTANT: Use `git rm --cached` (NOT `git rm`). The --cached flag only removes from the index, keeping files on disk.
  </action>
  <verify>
    <automated>git ls-files --cached .claude | wc -l | tr -d ' ' | grep -q '^0$' && echo "PASS: .claude not tracked" || echo "FAIL: .claude still tracked"</automated>
  </verify>
  <done>.claude directory is no longer tracked by git. .gitignore exists with .claude/ entry. All 146 previously tracked .claude files are removed from the index but still exist on disk.</done>
</task>

</tasks>

<verification>
- `git config --global core.excludesfile` returns path to ~/.gitignore_global
- `cat ~/.gitignore_global` contains `.claude/`
- `cat .gitignore` contains `.claude/`
- `git ls-files --cached .claude | wc -l` returns 0
- `ls .claude/` still shows files (not deleted from disk)
</verification>

<success_criteria>
- Global gitignore is configured and active
- .claude is listed in both global and local gitignore
- .claude files are removed from git tracking but remain on disk
- Changes are committed
</success_criteria>

<output>
After completion, create `.planning/quick/260319-qkn-add-global-gitignore-with-claude-and-rem/260319-qkn-SUMMARY.md`
</output>
