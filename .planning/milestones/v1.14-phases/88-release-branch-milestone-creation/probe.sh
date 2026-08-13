#!/usr/bin/env bash
# Phase 88 — Milestone title collision probe (run ONCE against live GitLab).
# Gates RELMS-04 (client-side duplicate detection) per ROADMAP §88 probe note.
# Requires: curl, jq. Read-only (all GETs). Paste the SUMMARY block back into the chat.
#
# Usage:
#   GITLAB_BASE_URL="https://gitlab.example.com" GITLAB_PAT="xxxx" PROJECT_ID="123" ./probe.sh
#
set -uo pipefail

: "${GITLAB_BASE_URL:?set GITLAB_BASE_URL (no trailing slash)}"
: "${GITLAB_PAT:?set GITLAB_PAT (PRIVATE-TOKEN personal access token)}"
: "${PROJECT_ID:?set PROJECT_ID (numeric GitLab project id — activeGitlabProject)}"

BASE="${GITLAB_BASE_URL%/}"
AUTH=(-H "PRIVATE-TOKEN: ${GITLAB_PAT}" -H "Content-Type: application/json")
get() { curl -sS --max-time 30 "${AUTH[@]}" "$1"; }

echo "==================== PHASE 88 PROBE RESULTS ===================="
echo "base=${BASE}  project=${PROJECT_ID}"
echo

# --- Probe A: full project milestone list (include_ancestors=true), paginated ---
echo "----- PROBE A: fetch all project milestones (include_ancestors=true) -----"
ALL_JSON="[]"
PAGE=1
while :; do
  PAGE_JSON=$(get "${BASE}/api/v4/projects/${PROJECT_ID}/milestones?per_page=100&page=${PAGE}&include_ancestors=true")
  COUNT=$(echo "$PAGE_JSON" | jq -r 'length' 2>/dev/null || echo 0)
  [ "${COUNT:-0}" -eq 0 ] && break
  ALL_JSON=$(jq -s '.[0] + .[1]' <(echo "$ALL_JSON") <(echo "$PAGE_JSON"))
  [ "${COUNT}" -lt 100 ] && break
  PAGE=$((PAGE + 1))
done
TOTAL=$(echo "$ALL_JSON" | jq -r 'length')
echo "total milestones fetched (project + inherited ancestors): ${TOTAL}"
echo

# --- Probe B (D-07 verification): does each milestone carry project_id/group_id? ---
echo "----- PROBE B: project_id / group_id presence (D-07) -----"
echo "$ALL_JSON" | jq -rc '[.[] | {id, title, project_id, group_id}] | .[0:10]'
WITH_PROJECT_ID=$(echo "$ALL_JSON" | jq -r '[.[] | select(.project_id == '"${PROJECT_ID}"')] | length')
WITH_OTHER=$(echo "$ALL_JSON" | jq -r '[.[] | select(.project_id != '"${PROJECT_ID}"')] | length')
echo "milestones with project_id == ${PROJECT_ID}: ${WITH_PROJECT_ID}"
echo "milestones with project_id != ${PROJECT_ID} (or absent — likely inherited group milestones): ${WITH_OTHER}"
if echo "$ALL_JSON" | jq -e '.[0] | has("project_id")' >/dev/null 2>&1; then
  echo "PROBE B => PASS (project_id field present — D-07 local filter is viable)"
else
  echo "PROBE B => FAIL (project_id field absent — D-07 fallback: dialog-scoped include_ancestors=false fetch required)"
fi
echo

# --- Probe C (RELMS-04): whitespace / near-duplicate / case-variant titles ---
echo "----- PROBE C: whitespace / near-duplicate title scan (RELMS-04) -----"
echo "$ALL_JSON" | jq -rc '[.[] | select(.project_id == '"${PROJECT_ID}"') | {id, title, state, due_date}]' > /tmp/phase88-titles.json 2>/dev/null || \
  echo "$ALL_JSON" | jq -rc '[.[] | {id, title, state, due_date}]' > /tmp/phase88-titles.json
echo "own-project titles:"
jq -r '.[].title' /tmp/phase88-titles.json | sed 's/^/  - "/;s/$/"/'
echo
echo "trimmed-duplicate check (same title after trim+lowercase, different raw string):"
jq -r '
  group_by(.title | ascii_downcase | gsub("^\\s+|\\s+$";"")) |
  map(select(length > 1)) |
  .[] | "COLLISION: " + (map(.title) | tostring)
' /tmp/phase88-titles.json
echo
echo "titles NOT matching the D-01/D-02 real format X.Y.Z (DD.MM.YYYY):"
jq -r '.[] | select(.title | test("^\\d+\\.\\d+\\.\\d+ \\(\\d{2}\\.\\d{2}\\.\\d{4}\\)$") | not) | .title' /tmp/phase88-titles.json
echo
echo "closed vs active state distribution:"
jq -r 'group_by(.state) | map({state: .[0].state, count: length})' /tmp/phase88-titles.json
echo
echo "PROBE C => manual review required — inspect the lists above for whitespace-only"
echo "  or case-only collisions that GitLab's server-side exact-title check may treat"
echo "  as distinct while a naive client trim-and-compare would not (or vice versa)."
echo
echo "==================== END — paste everything above ===================="
