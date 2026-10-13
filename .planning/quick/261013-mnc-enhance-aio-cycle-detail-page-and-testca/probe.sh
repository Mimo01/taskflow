#!/usr/bin/env bash
# Quick 261013-mnc — AIO field probe (run ONCE against live Jira/AIO). READ-ONLY.
# Only GETs, plus the read-style POST testcasewithrun/paged + summary/paged the app already sends.
# Requires: curl, jq. Paste the whole output back into the chat.
#
# Usage:
#   JIRA_BASE_URL="https://jira.orange.sk" JIRA_PAT="xxxx" PROJECT_KEY="ESHOP" CYCLE_KEY="ESHOP-CY-1011" ./probe.sh
#
set -uo pipefail
: "${JIRA_BASE_URL:?set JIRA_BASE_URL (no trailing slash)}"
: "${JIRA_PAT:?set JIRA_PAT (same PAT as the app jira-pat)}"
: "${PROJECT_KEY:?set PROJECT_KEY, e.g. ESHOP}"
: "${CYCLE_KEY:?set CYCLE_KEY, e.g. ESHOP-CY-1011 (pick one with failures + defects)}"

BASE="${JIRA_BASE_URL%/}"
API="${BASE}/rest/aio-tcms-api/1.0"
INT="${BASE}/rest/aio-tcms/1.0"
AUTH=(-H "Authorization: Bearer ${JIRA_PAT}" -H "Content-Type: application/json")
TZ_NAME="Europe/Bratislava"

# Print every key path with a short sample value (strings cut to 60 chars, arrays -> first element).
shape() {
  jq -r '
    def short: if type=="string" then (.[0:60]) else . end;
    [paths(scalars) as $p | {path: ($p|map(if type=="number" then "[]" else . end)|join(".")), v: (getpath($p)|short)}]
    | unique_by(.path) | .[] | "\(.path) = \(.v|tojson)"' 2>/dev/null
}
# Keys whose value is null / [] / {} (present but empty) — shows fields that exist but are unused here.
empties() {
  jq -r '[paths as $p | select((getpath($p)==null) or (getpath($p)==[]) or (getpath($p)=={})) | $p|map(if type=="number" then "[]" else . end)|join(".")] | unique | .[]' 2>/dev/null
}

echo "==================== 261013-mnc PROBE ===================="
echo "base=${BASE} project=${PROJECT_KEY} cycle=${CYCLE_KEY}"; echo

echo "----- P1: GET cycle /detail -----"
DETAIL=$(curl -sS --max-time 30 "${AUTH[@]}" "${API}/project/${PROJECT_KEY}/testcycle/${CYCLE_KEY}/detail")
echo "$DETAIL" | shape
echo "(present-but-empty:)"; echo "$DETAIL" | empties
CID=$(echo "$DETAIL" | jq -r '.ID // empty')
PID=$(echo "$DETAIL" | jq -r '.jiraProjectID // empty')
echo "cycleID=${CID} jiraProjectID=${PID}"; echo
[ -z "$CID" ] || [ -z "$PID" ] && { echo "ABORT: no ID/jiraProjectID in detail"; exit 1; }

echo "----- P2: POST testcasewithrun/paged (same body as the app, maxResults 5) -----"
BODY=$(jq -nc --argjson cid "$CID" --arg tz "$TZ_NAME" '{startAt:0,maxResults:5,
  columns:["rank","key","title","testRunStatusID","defectCount"],customFields:[],runCustomFields:[],
  cycleID:{comparisonType:"IN",list:[$cid]},testCycleCases:true,groupByFolder:false,groupBySet:false,
  filteredFromSegment:false,includeComments:false,includeAttachments:false,
  sortingData:{sortColumn:"rank",sortOrder:"ASC",jiraComponents:[],jiraReleases:[],customFieldID:null,customFieldType:null},
  timeZone:$tz}')
TCR=$(curl -sS --max-time 30 "${AUTH[@]}" -X POST -d "$BODY" "${INT}/project/${PID}/testcycle/${CID}/testcasewithrun/paged?c_pId=${PID}&t=$(date +%s000)")
echo "$TCR" | shape
echo "(present-but-empty:)"; echo "$TCR" | empties
RUN_ID=$(echo "$TCR" | jq -r '[.items[]? | select(.latestTestRun.ID != null)][0].latestTestRun.ID // empty')
TC_KEY=$(echo "$TCR" | jq -r '.items[0].test.detail.key // empty')
echo "items without latestTestRun: $(echo "$TCR" | jq '[.items[]? | select(.latestTestRun == null or .latestTestRun.ID == null)] | length')"
echo "sample runId=${RUN_ID} testCaseKey=${TC_KEY}"; echo

echo "----- P2b: same request, extra columns (does 'columns' gate test.detail fields?) -----"
BODY_B=$(echo "$BODY" | jq -c '.columns += ["priority","precondition","description","ownedByID","estimatedEffort","executedByID","assignedToID","updatedDate"]')
curl -sS --max-time 30 "${AUTH[@]}" -X POST -d "$BODY_B" "${INT}/project/${PID}/testcycle/${CID}/testcasewithrun/paged?c_pId=${PID}&t=$(date +%s000)" \
  | jq '.items[0].test.detail // {} | keys' 2>/dev/null; echo

echo "----- P3: GET run detail ?assignSteps=true -----"
if [ -n "$RUN_ID" ]; then
  RUN=$(curl -sS --max-time 30 "${AUTH[@]}" "${API}/project/${PROJECT_KEY}/testcycle/${CYCLE_KEY}/testrun/${RUN_ID}?assignSteps=true")
  echo "$RUN" | shape
  echo "(present-but-empty:)"; echo "$RUN" | empties
fi; echo

echo "----- P4: GET test case detail (optional — may 404 on this AIO build) -----"
if [ -n "$TC_KEY" ]; then
  for u in "${API}/project/${PROJECT_KEY}/testcase/${TC_KEY}/detail" "${API}/project/${PROJECT_KEY}/testcase/${TC_KEY}"; do
    code=$(curl -sS -o /tmp/aio_tc.json -w '%{http_code}' --max-time 30 "${AUTH[@]}" "$u")
    echo "GET ${u#${BASE}} -> ${code}"
    [ "$code" = "200" ] && { shape < /tmp/aio_tc.json; break; }
  done
  rm -f /tmp/aio_tc.json
fi; echo

echo "----- P5: POST summary/paged for this cycle (effort/assignees populated?) -----"
curl -sS --max-time 30 "${AUTH[@]}" -X POST -d "[${CID}]" "${INT}/project/${PID}/testcycle/summary/paged?c_pId=${PID}&t=$(date +%s000)" | shape
echo "==================== END ===================="
