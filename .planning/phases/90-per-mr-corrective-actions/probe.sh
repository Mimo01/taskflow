#!/usr/bin/env bash
# Phase 90 — MR-approval / protected-branch probe (roadmap-mandated, D-16), run ONCE against live GitLab.
# Documentation only per D-16: the outcome changes NO UI (no confirm dialog, no warning, no tooltip
# line) regardless of result. Also captures one real failing-PUT error body as ground truth for
# RESEARCH Open Question A1 (the `flattenGitLabError` shape).
# Requires: curl, jq. Read-only except PROBE D, which is a deliberately-invalid PUT that cannot
# mutate the target MR (see PROBE D comment below). Paste the SUMMARY block back into the chat.
#
# Usage:
#   GITLAB_BASE_URL="https://git.devel.sun.orange.sk" GITLAB_PAT="xxxx" PROJECT_ID="455" \
#     SAMPLE_MR_IID="123" SCRATCH_MR_IID="456" ./probe.sh
#
set -uo pipefail

: "${GITLAB_BASE_URL:?set GITLAB_BASE_URL (no trailing slash)}"
: "${GITLAB_PAT:?set GITLAB_PAT (PRIVATE-TOKEN personal access token)}"
: "${PROJECT_ID:?set PROJECT_ID (numeric GitLab project id — activeGitlabProject)}"

BASE="${GITLAB_BASE_URL%/}"
AUTH=(-H "PRIVATE-TOKEN: ${GITLAB_PAT}" -H "Content-Type: application/json")

echo "==================== PHASE 90 PROBE RESULTS ===================="
echo "base=${BASE}  project=${PROJECT_ID}"
echo

# --- PROBE A: project-level approval configuration ---
echo "----- PROBE A: project approval configuration -----"
PROBE_A=$(curl -sS --max-time 30 "${AUTH[@]}" "${BASE}/api/v4/projects/${PROJECT_ID}/approvals")
echo "$PROBE_A"
RESET_ON_PUSH=$(echo "$PROBE_A" | jq -r '.reset_approvals_on_push' 2>/dev/null)
if [ -z "${RESET_ON_PUSH}" ] || [ "${RESET_ON_PUSH}" = "null" ]; then
  echo "reset_approvals_on_push: ABSENT"
else
  echo "reset_approvals_on_push: ${RESET_ON_PUSH}"
fi
echo

# --- PROBE B: a real MR's approval state ---
echo "----- PROBE B: sample MR approval state -----"
if [ -z "${SAMPLE_MR_IID:-}" ]; then
  echo "PROBE B: SKIPPED (SAMPLE_MR_IID unset)"
else
  PROBE_B=$(curl -sS --max-time 30 "${AUTH[@]}" "${BASE}/api/v4/projects/${PROJECT_ID}/merge_requests/${SAMPLE_MR_IID}/approvals")
  echo "$PROBE_B"
  echo "approvals_required: $(echo "$PROBE_B" | jq -r '.approvals_required' 2>/dev/null)"
  echo "approvals_left: $(echo "$PROBE_B" | jq -r '.approvals_left' 2>/dev/null)"
  echo "approved_by_count: $(echo "$PROBE_B" | jq -r '.approved_by | length' 2>/dev/null)"
fi
echo

# --- PROBE C: fully paginated protected branches ---
echo "----- PROBE C: protected branches -----"
PROTECTED_JSON="[]"
PAGE=1
while :; do
  PAGE_JSON=$(curl -sS --max-time 30 "${AUTH[@]}" "${BASE}/api/v4/projects/${PROJECT_ID}/protected_branches?per_page=100&page=${PAGE}")
  COUNT=$(echo "$PAGE_JSON" | jq -r 'length' 2>/dev/null || echo 0)
  [ "${COUNT:-0}" -eq 0 ] && break
  PROTECTED_JSON=$(jq -s '.[0] + .[1]' <(echo "$PROTECTED_JSON") <(echo "$PAGE_JSON"))
  [ "${COUNT}" -lt 100 ] && break
  PAGE=$((PAGE + 1))
done
echo "protected_branches found: $(echo "$PROTECTED_JSON" | jq -r 'length')"
echo "$PROTECTED_JSON" | jq -r '.[].name'
RELEASE_PROTECTED="NO"
if echo "$PROTECTED_JSON" | jq -e '.[] | select(.name == "release/*" or (.name | startswith("release/")))' >/dev/null 2>&1; then
  RELEASE_PROTECTED="YES"
fi
echo "release_pattern_protected: ${RELEASE_PROTECTED}"
echo

# --- PROBE D: deliberately-invalid PUT — RESEARCH Open Question A1 ground-truth capture.
# The target branch below cannot exist on any real project, so GitLab MUST reject this PUT
# with a 4xx and the MR is never modified. This is the only non-read-only call in this probe,
# and it is safe precisely because the write can never succeed. No valid write is ever issued
# by this script.
echo "----- PROBE D: deliberately-invalid PUT (RESEARCH A1 ground truth) -----"
if [ -z "${SCRATCH_MR_IID:-}" ]; then
  echo "PROBE D: SKIPPED (SCRATCH_MR_IID unset)"
else
  HTTP_STATUS=$(curl -sS --max-time 30 -o /tmp/phase90-put-body.txt -w '%{http_code}' \
    -X PUT "${AUTH[@]}" \
    -d '{"target_branch":"__taskflow-probe-nonexistent-branch__"}' \
    "${BASE}/api/v4/projects/${PROJECT_ID}/merge_requests/${SCRATCH_MR_IID}")
  echo "http_status: ${HTTP_STATUS}"
  echo "response_body:"
  cat /tmp/phase90-put-body.txt
  echo
  if [ "${HTTP_STATUS}" -ge 200 ] && [ "${HTTP_STATUS}" -lt 300 ]; then
    echo "WARNING: PROBE D returned 2xx — the scratch MR's target branch may have been changed. Revert manually in GitLab."
  fi
fi
echo

echo "==================== END — paste everything above ===================="
