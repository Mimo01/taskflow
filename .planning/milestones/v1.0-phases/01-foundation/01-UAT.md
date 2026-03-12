---
status: complete
phase: 01-foundation
source: 01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md, 01-04-SUMMARY.md, 01-05-SUMMARY.md, 01-06-SUMMARY.md
started: 2026-03-11T11:20:00Z
updated: 2026-03-11T11:20:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 15
name: Re-Auth Banner
expected: |
  If your Jira token has expired (or simulate by clearing jira connected state), a non-dismissible amber banner appears at the top of the app with a link to Settings to re-authenticate. The banner cannot be closed — it stays until credentials are valid.
completed: true

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Start the app fresh with `npm run tauri dev` from taskflow/. The Tauri window opens without errors or crashes. The app is fully styled — buttons, inputs, and layout use shadcn/Tailwind styles (not bare unstyled HTML). The onboarding wizard appears (Welcome step) if this is a fresh install. No console errors in the webview. The app is interactive.
result: pass

### 2. Onboarding Wizard: Full Flow
expected: The wizard shows 5 steps: Welcome → Jira → GitLab → Role → Done. Clicking "Get Started" on Welcome moves to the Jira step. A step indicator at the top shows progress. Completing all steps lands you on the Dashboard.
result: pass
note: Issues fixed (selector width, TLS settings, dangerous-settings feature) — passed on retry

### 3. Jira PAT Validation — Success & Project Dropdown
expected: On the Jira step, enter your Jira base URL and PAT. Click Validate. A spinner appears and the button disables during validation. On success, a project dropdown appears inline letting you pick your active project. The step indicator shows a green checkmark for the Jira step.
result: pass

### 4. Jira PAT Validation — Error Messages
expected: On the Jira step, test with a bad token. An invalid/expired token shows: "Invalid token or token has expired". A token without permissions shows: "Token valid but lacks required permissions". A wrong/unreachable URL shows: "Cannot reach [URL] — check the base URL". Each error appears below the Validate button.
result: pass

### 5. Back Navigation Preserves Values
expected: On the Jira step, enter a URL and PAT. Navigate back to Welcome then forward to Jira again. The URL and PAT fields still contain what you typed — values are not cleared on navigation.
result: pass

### 6. GitLab PAT Validation
expected: On the GitLab step, enter your GitLab base URL and PAT. Validation works the same as Jira: spinner while validating, group dropdown on success, same error messages for 401/403/network failures.
result: pass

### 7. Role Picker Step
expected: After GitLab validation, the Role step shows two options: Developer and PM. Selecting one enables the Continue button. The selection is required to proceed. Clicking Continue moves to the Done step.
result: pass

### 8. Done Step → Dashboard Navigation
expected: The Done step shows a confirmation screen. After completing it (clicking the final button), the app navigates to /dashboard. The sidebar appears for the first time, showing Dashboard nav, a theme toggle, and a gear icon.
result: pass

### 9. Sidebar Visibility
expected: During the onboarding wizard, no sidebar is visible — the wizard takes the full window. After completing onboarding and arriving at the dashboard, the vertical sidebar is visible on the left with: Dashboard nav link, a theme toggle at the bottom, and a gear icon linking to Settings.
result: pass

### 10. Settings: Masked Token Display & Eye-Toggle Reveal
expected: Navigate to Settings (gear icon in sidebar). The Credentials section shows your Jira and GitLab tokens as "••••••••" by default — never as plaintext. Clicking the eye icon next to a token reveals the actual token value. Navigating away and back hides it again.
result: pass

### 11. Settings: Update Token
expected: In Settings > Credentials, enter a new token in the update field and click "Update Token". Validation runs (spinner + disabled), and on success the token is stored. An error message appears on failure (same messages as onboarding).
result: pass
note: Added success confirmation message and input clear on success during UAT

### 12. Settings: Role Switch
expected: In Settings > Role, switch between Developer and PM. The change takes effect immediately — no save button needed. Returning to the dashboard reflects the new role.
result: pass

### 13. Settings: Theme Toggle (Light/Dark/System)
expected: In Settings > Appearance, three options are available: Light, Dark, System. Selecting one applies the theme instantly — the UI switches without reload. "System" follows your OS preference. The selected theme persists if you close and reopen the app.
result: pass

### 14. Settings: Jira Project Select
expected: In Settings > Credentials, an "Active Project" dropdown appears below the Jira URL showing your available Jira projects. Selecting a different project switches the active context.
result: pass

### 15. Re-Auth Banner
expected: If your Jira token has expired (or simulate by clearing jira connected state), a non-dismissible amber banner appears at the top of the app with a link to Settings to re-authenticate. The banner cannot be closed — it stays until credentials are valid.
result: pass
note: Simulated by deleting auth.json. Stronghold tokens persist independently (correct — Stronghold is the OS keychain, separate from auth state).

## Summary

total: 15
passed: 15
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
