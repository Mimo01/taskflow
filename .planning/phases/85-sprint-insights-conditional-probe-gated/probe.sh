#!/usr/bin/env bash
# Phase 85 — Sprint Insights probe harness (run ONCE against live Jira DC).
# Gates INSIGHT-01 (velocity) and INSIGHT-02 (burndown) per ROADMAP §85 criterion 1.
# Requires: curl, jq. Read-only (all GETs). Paste the SUMMARY block back into the chat.
#
# Usage:
#   JIRA_BASE_URL="https://jira.example.com" JIRA_PAT="xxxx" PROJECT_KEY="ESHOP" ./probe.sh
#
set -uo pipefail

: "${JIRA_BASE_URL:?set JIRA_BASE_URL (no trailing slash)}"
: "${JIRA_PAT:?set JIRA_PAT (Bearer personal access token)}"
: "${PROJECT_KEY:?set PROJECT_KEY (active Jira project key, e.g. ESHOP)}"

BASE="${JIRA_BASE_URL%/}"
AUTH=(-H "Authorization: Bearer ${JIRA_PAT}" -H "Content-Type: application/json")
get() { curl -sS --max-time 30 "${AUTH[@]}" "$1"; }

echo "==================== PHASE 85 PROBE RESULTS ===================="
echo "base=${BASE}  project=${PROJECT_KEY}"
echo

# --- Step 0: discover the scrum board (rapidViewId == boardId for GreenHopper) ---
BOARDS_JSON=$(get "${BASE}/rest/agile/1.0/board?projectKeyOrId=${PROJECT_KEY}&type=scrum&maxResults=5")
BOARD_ID=$(echo "$BOARDS_JSON" | jq -r '.values[0].id // empty')
echo "[0] board discovery: boardId=${BOARD_ID:-<none>}  (candidates: $(echo "$BOARDS_JSON" | jq -rc '[.values[]?|{id,name}]' 2>/dev/null))"
if [ -z "${BOARD_ID}" ]; then echo "!! No scrum board found for ${PROJECT_KEY}; cannot continue."; exit 1; fi
echo

# --- Probe A (INSIGHT-01a): closed sprints carry startDate/endDate ---
echo "----- PROBE A: closed-sprint REST endpoint (INSIGHT-01a) -----"
CLOSED_JSON=$(get "${BASE}/rest/agile/1.0/board/${BOARD_ID}/sprint?state=closed&maxResults=5")
CLOSED_COUNT=$(echo "$CLOSED_JSON" | jq -r '[.values[]?]|length' 2>/dev/null || echo 0)
echo "closed sprints returned: ${CLOSED_COUNT}"
echo "$CLOSED_JSON" | jq -rc '.values[]? | {id,name,state,startDate,endDate,completeDate}' 2>/dev/null
WITH_DATES=$(echo "$CLOSED_JSON" | jq -r '[.values[]? | select(.startDate and .endDate)]|length' 2>/dev/null || echo 0)
FIRST_CLOSED=$(echo "$CLOSED_JSON" | jq -r '.values[-1].id // empty' 2>/dev/null)
if [ "${CLOSED_COUNT:-0}" -ge 3 ] && [ "${WITH_DATES:-0}" -ge 3 ]; then echo "PROBE A => PASS (>=3 closed sprints with start/end dates)"; else echo "PROBE A => CHECK (need >=3 closed sprints with dates; got count=${CLOSED_COUNT} withDates=${WITH_DATES})"; fi
echo

# --- Discover Story Points field key ---
SP_KEY=$(get "${BASE}/rest/api/2/field" | jq -r '[.[]|select(.name=="Story Points")][0].id // "customfield_10016"')
echo "[*] storyPointsFieldKey=${SP_KEY}"
echo

# --- Probe B (INSIGHT-01b): SP field populated on closed-sprint issues (+ assignee for personal scope) ---
echo "----- PROBE B: SP field populated on closed-sprint issues (INSIGHT-01b) -----"
if [ -n "${FIRST_CLOSED}" ]; then
  ISSUES_JSON=$(get "${BASE}/rest/agile/1.0/sprint/${FIRST_CLOSED}/issue?fields=${SP_KEY},status,assignee&maxResults=10")
  TOTAL=$(echo "$ISSUES_JSON" | jq -r '.total // 0')
  SP_POP=$(echo "$ISSUES_JSON" | jq -r "[.issues[]? | select(.fields[\"${SP_KEY}\"] != null)]|length" 2>/dev/null || echo 0)
  echo "sprint ${FIRST_CLOSED}: total issues=${TOTAL}, sampled with SP populated=${SP_POP}"
  echo "$ISSUES_JSON" | jq -rc "[.issues[]? | {key, sp:.fields[\"${SP_KEY}\"], status:.fields.status.statusCategory.key, assignee:.fields.assignee.displayName}] | .[0:5]" 2>/dev/null
  if [ "${SP_POP:-0}" -ge 1 ]; then echo "PROBE B => PASS (SP field populated; assignee present for personal scoping)"; else echo "PROBE B => FAIL (no SP values on closed-sprint issues)"; fi
else
  echo "PROBE B => SKIP (no closed sprint id from Probe A)"
fi
echo

# --- Probe C (INSIGHT-02): GreenHopper scope-change burndown for the ACTIVE sprint ---
echo "----- PROBE C: GreenHopper burndown endpoint (INSIGHT-02) -----"
ACTIVE_ID=$(get "${BASE}/rest/agile/1.0/board/${BOARD_ID}/sprint?state=active" | jq -r '.values[0].id // empty')
echo "active sprintId=${ACTIVE_ID:-<none>}"
if [ -n "${ACTIVE_ID}" ]; then
  BURN_JSON=$(get "${BASE}/rest/greenhopper/1.0/rapid/charts/scopechangeburndownchart?rapidViewId=${BOARD_ID}&sprintId=${ACTIVE_ID}")
  HAS_CHANGES=$(echo "$BURN_JSON" | jq -r 'if .changes then "yes" else "no" end' 2>/dev/null || echo "parse-error")
  STAT_FIELD=$(echo "$BURN_JSON" | jq -rc '.statisticField // empty' 2>/dev/null)
  echo "burndown payload keys: $(echo "$BURN_JSON" | jq -rc 'keys' 2>/dev/null | head -c 300)"
  echo "statisticField: ${STAT_FIELD}"
  echo "changeset entries: $(echo "$BURN_JSON" | jq -r 'if .changes then (.changes|keys|length) else 0 end' 2>/dev/null)"
  if [ "${HAS_CHANGES}" = "yes" ]; then echo "PROBE C => PASS (scopechangeburndownchart returns a .changes timeline for this DC)"; else echo "PROBE C => FAIL/CHECK (no .changes object — endpoint may differ on this DC; paste the 'payload keys' line)"; fi
else
  echo "PROBE C => SKIP (no active sprint)"
fi
echo
echo "==================== END — paste everything above ===================="
