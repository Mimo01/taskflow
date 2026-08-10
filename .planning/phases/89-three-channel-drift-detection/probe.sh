#!/usr/bin/env bash
# Phase 89 — Channel C pagination-completeness probe (run ONCE against live GitLab).
# Gates DRIFT-03's "fully paginated, no page cap" claim per ROADMAP §89 probe note.
# Requires: curl, jq. Read-only (all GETs). Paste the SUMMARY block back into the chat.
#
# Usage:
#   GITLAB_BASE_URL="https://git.devel.sun.orange.sk" GITLAB_PAT="xxxx" PROJECT_ID="455" ./probe.sh
#
set -uo pipefail

: "${GITLAB_BASE_URL:?set GITLAB_BASE_URL (no trailing slash)}"
: "${GITLAB_PAT:?set GITLAB_PAT (PRIVATE-TOKEN personal access token)}"
: "${PROJECT_ID:?set PROJECT_ID (numeric GitLab project id — activeGitlabProject)}"

BASE="${GITLAB_BASE_URL%/}"
AUTH=(-H "PRIVATE-TOKEN: ${GITLAB_PAT}" -H "Content-Type: application/json")

echo "==================== PHASE 89 PROBE RESULTS ===================="
echo "base=${BASE}  project=${PROJECT_ID}"
echo

# --- Probe A: confirm target_branch and draft fields exist on the LIST endpoint (A1/A2) ---
echo "----- PROBE A: list-endpoint field shape (target_branch, draft) -----"
FIRST_PAGE=$(curl -sS --max-time 30 "${AUTH[@]}" "${BASE}/api/v4/projects/${PROJECT_ID}/merge_requests?state=all&per_page=1&page=1")
echo "$FIRST_PAGE" | jq -r '.[0] | keys' 2>/dev/null
if echo "$FIRST_PAGE" | jq -e '.[0] | has("target_branch")' >/dev/null 2>&1; then
  echo "target_branch: PRESENT"
else
  echo "target_branch: ABSENT (A2 assumption FAILS — investigate GitLab version/edition before implementing)"
fi
if echo "$FIRST_PAGE" | jq -e '.[0] | has("draft")' >/dev/null 2>&1; then
  echo "draft: PRESENT"
else
  echo "draft: ABSENT (A2 assumption FAILS)"
fi
echo

# --- Probe B: find all release/* branches, count MRs targeting each ---
echo "----- PROBE B: release branches + MR counts targeting each (DRIFT-03 core) -----"
BRANCHES_JSON="[]"
PAGE=1
while :; do
  PAGE_JSON=$(curl -sS --max-time 30 "${AUTH[@]}" "${BASE}/api/v4/projects/${PROJECT_ID}/repository/branches?per_page=100&page=${PAGE}&search=release/")
  COUNT=$(echo "$PAGE_JSON" | jq -r 'length' 2>/dev/null || echo 0)
  [ "${COUNT:-0}" -eq 0 ] && break
  BRANCHES_JSON=$(jq -s '.[0] + .[1]' <(echo "$BRANCHES_JSON") <(echo "$PAGE_JSON"))
  [ "${COUNT}" -lt 100 ] && break
  PAGE=$((PAGE + 1))
done
echo "release/* branches found: $(echo "$BRANCHES_JSON" | jq -r 'length')"
echo "$BRANCHES_JSON" | jq -r '.[].name'
echo

echo "$BRANCHES_JSON" | jq -r '.[].name' | while read -r BRANCH; do
  # Fully paginate target_branch MRs; report both the header-reported total (if present)
  # and the actual accumulated count — the two SHOULD match; a mismatch or a header total
  # exceeding 100 is exactly the completeness failure this probe exists to catch.
  TOTAL_MRS=0
  P=1
  HEADER_TOTAL=""
  while :; do
    RESP=$(curl -sS --max-time 30 -D /tmp/phase89-headers.txt "${AUTH[@]}" \
      "${BASE}/api/v4/projects/${PROJECT_ID}/merge_requests?target_branch=$(printf '%s' "$BRANCH" | jq -sRr @uri)&state=all&per_page=100&page=${P}")
    if [ "$P" -eq 1 ]; then
      HEADER_TOTAL=$(grep -i '^x-total:' /tmp/phase89-headers.txt | tr -d '\r' | awk '{print $2}')
    fi
    N=$(echo "$RESP" | jq -r 'length' 2>/dev/null || echo 0)
    TOTAL_MRS=$((TOTAL_MRS + N))
    [ "${N:-0}" -lt 100 ] && break
    P=$((P + 1))
  done
  FLAG=""
  [ "$TOTAL_MRS" -gt 100 ] && FLAG=" <== EXCEEDS SINGLE PAGE (100) — proves multi-page fetch is REQUIRED, not optional"
  echo "  ${BRANCH}: ${TOTAL_MRS} MRs (X-Total header: ${HEADER_TOTAL:-none})${FLAG}"
done
echo

# --- Probe C: if NO real branch exceeds 100, note the fixture-building fallback ---
echo "----- PROBE C: synthetic fixture note -----"
echo "If Probe B shows no release/* branch with >100 targeting MRs, the roadmap's"
echo "alternative instruction applies: build a synthetic >100-MR fixture in the unit"
echo "test suite (driftDetection.test.ts / gitlab pagination test) to prove the LOOP"
echo "MECHANISM is correct, since live data cannot prove it empirically. This is a"
echo "unit-test-level proof (mock apiFetch returning >1 page), not a live-data proof —"
echo "record which path was taken in the phase's VERIFICATION.md."
echo

echo "==================== END — paste everything above ===================="
