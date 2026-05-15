# AIO API Response Examples

Reference data captured from live API calls. Used to understand the schema for the cycles page redesign.
IDs, user IDs, project keys, and names are anonymized.

---

## `count` — Test counts per folder ID

Maps `folderID → testCount`. Key `-1` means "no folder / unassigned".

```json
{"-1":3,"101":1,"102":2,"103":1,"104":1,"105":29,"106":4,"107":2,"108":1,"109":66,"110":3,"111":1,"112":1,"113":1,"114":7,"115":4,"116":1,"117":1,"118":1,"119":4,"120":1,"121":1,"122":1,"123":2,"124":4,"125":5,"126":2,"127":1,"128":1,"129":117,"130":1,"131":1,"132":3,"133":1,"134":11,"135":4,"136":1,"137":1,"138":2,"139":1,"140":1,"141":1,"142":76,"143":1,"144":1,"145":10,"146":1,"147":1,"148":1,"149":1,"150":3,"151":102,"152":19,"153":1,"154":34,"155":33,"156":42,"157":22,"158":15,"159":1,"160":1,"161":1,"162":3,"163":1,"164":1,"165":1,"166":61,"167":240,"168":5,"169":6,"170":1,"171":1,"172":1}
```

---

## `folder` — Full folder tree (nested)

```json
[
  {
    "ID": 201,
    "name": "2023 - DONE",
    "description": null,
    "parentID": null,
    "rankOrder": null,
    "children": [
      {
        "ID": 202,
        "name": "Campaign A 11/2023",
        "description": null,
        "parentID": 201,
        "rankOrder": null,
        "children": []
      },
      {
        "ID": 203,
        "name": "Revamp 2023",
        "description": null,
        "parentID": 201,
        "rankOrder": null,
        "children": [
          {
            "ID": 204,
            "name": "B2B fix",
            "description": null,
            "parentID": 203,
            "rankOrder": null,
            "children": []
          },
          {
            "ID": 205,
            "name": "Fix Revamp New Activations",
            "description": null,
            "parentID": 203,
            "rankOrder": null,
            "children": [
              {"ID": 206, "name": "Benefits", "description": null, "parentID": 205, "rankOrder": null, "children": []},
              {"ID": 207, "name": "E2E", "description": null, "parentID": 205, "rankOrder": null, "children": []},
              {"ID": 208, "name": "Misc", "description": null, "parentID": 205, "rankOrder": null, "children": []},
              {"ID": 209, "name": "Regression", "description": null, "parentID": 205, "rankOrder": null, "children": []}
            ]
          },
          {
            "ID": 210,
            "name": "Fix Revamp Exchanges",
            "description": null,
            "parentID": 203,
            "rankOrder": null,
            "children": [
              {"ID": 211, "name": "Benefits", "description": null, "parentID": 210, "rankOrder": null, "children": []},
              {"ID": 212, "name": "E2E", "description": null, "parentID": 210, "rankOrder": null, "children": []}
            ]
          },
          {"ID": 213, "name": "Feature X revamp", "description": null, "parentID": 203, "rankOrder": null, "children": []},
          {"ID": 214, "name": "Feature Y revamp", "description": null, "parentID": 203, "rankOrder": null, "children": []},
          {"ID": 215, "name": "Feature Z revamp", "description": null, "parentID": 203, "rankOrder": null, "children": []},
          {"ID": 216, "name": "Update 12/2023", "description": null, "parentID": 203, "rankOrder": null, "children": []}
        ]
      },
      {"ID": 217, "name": "Sprint 124", "description": null, "parentID": 201, "rankOrder": null, "children": []}
    ]
  },
  {
    "ID": 301,
    "name": "2024 - DONE",
    "description": null,
    "parentID": null,
    "rankOrder": null,
    "children": [
      {"ID": 302, "name": "Campaign B 2024", "description": null, "parentID": 301, "rankOrder": null, "children": []},
      {
        "ID": 303,
        "name": "Self Care Portal",
        "description": null,
        "parentID": 301,
        "rankOrder": null,
        "children": [
          {"ID": 304, "name": "SSO", "description": null, "parentID": 303, "rankOrder": null, "children": []}
        ]
      },
      {"ID": 305, "name": "Black Friday 2024", "description": null, "parentID": 301, "rankOrder": null, "children": []},
      {"ID": 306, "name": "Tax consolidation 2024", "description": null, "parentID": 301, "rankOrder": null, "children": []},
      {"ID": 307, "name": "Campaign C 11/2024", "description": null, "parentID": 301, "rankOrder": null, "children": []},
      {"ID": 308, "name": "Checkout fix 2024", "description": null, "parentID": 301, "rankOrder": null, "children": []},
      {"ID": 309, "name": "Feature A Phase 1 2024", "description": null, "parentID": 301, "rankOrder": null, "children": []},
      {"ID": 310, "name": "Flash sales 2024", "description": null, "parentID": 301, "rankOrder": null, "children": []},
      {"ID": 311, "name": "Lockers 2024", "description": null, "parentID": 301, "rankOrder": null, "children": []},
      {
        "ID": 312,
        "name": "Feature B 2024",
        "description": null,
        "parentID": 301,
        "rankOrder": null,
        "children": [
          {"ID": 313, "name": "E2E", "description": null, "parentID": 312, "rankOrder": null, "children": []},
          {"ID": 314, "name": "FE", "description": null, "parentID": 312, "rankOrder": null, "children": []},
          {"ID": 315, "name": "MISC", "description": null, "parentID": 312, "rankOrder": null, "children": []},
          {"ID": 316, "name": "Hub", "description": null, "parentID": 312, "rankOrder": null, "children": []},
          {"ID": 317, "name": "Regression", "description": null, "parentID": 312, "rankOrder": null, "children": []}
        ]
      },
      {"ID": 318, "name": "TV revamp 2024", "description": null, "parentID": 301, "rankOrder": null, "children": []},
      {
        "ID": 319,
        "name": "Winter offer 02/2024",
        "description": null,
        "parentID": 301,
        "rankOrder": null,
        "children": [
          {"ID": 320, "name": "New activation", "description": null, "parentID": 319, "rankOrder": null, "children": []},
          {"ID": 321, "name": "Renewal", "description": null, "parentID": 319, "rankOrder": null, "children": []}
        ]
      }
    ]
  },
  {
    "ID": 401,
    "name": "2025 - DONE",
    "description": null,
    "parentID": null,
    "rankOrder": null,
    "children": [
      {"ID": 402, "name": "Feature C 2025", "description": null, "parentID": 401, "rankOrder": null, "children": []},
      {"ID": 403, "name": "Abandoned Basket", "description": null, "parentID": 401, "rankOrder": null, "children": []},
      {"ID": 404, "name": "B2B Startup offer 2025", "description": null, "parentID": 401, "rankOrder": null, "children": []},
      {"ID": 405, "name": "Back to school FBB 2025", "description": null, "parentID": 401, "rankOrder": null, "children": []},
      {"ID": 406, "name": "Voucher promo 2025", "description": null, "parentID": 401, "rankOrder": null, "children": []},
      {"ID": 407, "name": "EDC via OST", "description": null, "parentID": 401, "rankOrder": null, "children": []},
      {"ID": 408, "name": "Pruning 2025", "description": null, "parentID": 401, "rankOrder": null, "children": []},
      {"ID": 409, "name": "Geo offer 5/2025", "description": null, "parentID": 401, "rankOrder": null, "children": []},
      {"ID": 410, "name": "Project Horus 2025", "description": null, "parentID": 401, "rankOrder": null, "children": []},
      {"ID": 411, "name": "MBB revamp 2025", "description": null, "parentID": 401, "rankOrder": null, "children": []},
      {"ID": 412, "name": "MNP V2 2025", "description": null, "parentID": 401, "rankOrder": null, "children": []},
      {"ID": 413, "name": "Project Moon 2025", "description": null, "parentID": 401, "rankOrder": null, "children": []},
      {"ID": 414, "name": "Offer pack 2025", "description": null, "parentID": 401, "rankOrder": null, "children": []},
      {"ID": 415, "name": "Prepaid revamp 2025", "description": null, "parentID": 401, "rankOrder": null, "children": []},
      {"ID": 416, "name": "Retest eshop testers", "description": null, "parentID": 401, "rankOrder": null, "children": []},
      {"ID": 417, "name": "Catalog redesign 2025", "description": null, "parentID": 401, "rankOrder": null, "children": []},
      {"ID": 418, "name": "Refresh shadows 2025", "description": null, "parentID": 401, "rankOrder": null, "children": []},
      {"ID": 419, "name": "Quick fix exchanges 2025", "description": null, "parentID": 401, "rankOrder": null, "children": []},
      {"ID": 420, "name": "B2C Voice exchanges 2025", "description": null, "parentID": 401, "rankOrder": null, "children": []},
      {"ID": 421, "name": "SSO migration 2025", "description": null, "parentID": 401, "rankOrder": null, "children": []},
      {"ID": 422, "name": "Senior plan 2025", "description": null, "parentID": 401, "rankOrder": null, "children": []},
      {"ID": 423, "name": "Promo end 2025", "description": null, "parentID": 401, "rankOrder": null, "children": []},
      {"ID": 424, "name": "Video bundle 2025", "description": null, "parentID": 401, "rankOrder": null, "children": []},
      {"ID": 425, "name": "Voice Checkout 2025", "description": null, "parentID": 401, "rankOrder": null, "children": []},
      {"ID": 426, "name": "Referral program 2025", "description": null, "parentID": 401, "rankOrder": null, "children": []}
    ]
  },
  {
    "ID": 501,
    "name": "2026",
    "description": null,
    "parentID": null,
    "rankOrder": null,
    "children": [
      {"ID": 502, "name": "B2B Starter no device", "description": null, "parentID": 501, "rankOrder": null, "children": []},
      {"ID": 503, "name": "OBM", "description": null, "parentID": 501, "rankOrder": null, "children": []},
      {"ID": 504, "name": "Project Thanos Revamp 2026", "description": null, "parentID": 501, "rankOrder": null, "children": []},
      {"ID": 505, "name": "Valentine gifts 2026", "description": null, "parentID": 501, "rankOrder": null, "children": []}
    ]
  },
  {
    "ID": 601,
    "name": "AUTOMATION",
    "description": null,
    "parentID": null,
    "rankOrder": null,
    "children": [
      {
        "ID": 602,
        "name": "Regression",
        "description": null,
        "parentID": 601,
        "rankOrder": null,
        "children": [
          {"ID": 603, "name": "2024_Archive", "description": null, "parentID": 602, "rankOrder": null, "children": []},
          {
            "ID": 604,
            "name": "2025_Archive",
            "description": null,
            "parentID": 602,
            "rankOrder": null,
            "children": [
              {"ID": 605, "name": "MainTest_2025", "description": null, "parentID": 604, "rankOrder": null, "children": []},
              {"ID": 606, "name": "MobileAndroid", "description": null, "parentID": 604, "rankOrder": null, "children": []},
              {"ID": 607, "name": "PriceLists", "description": null, "parentID": 604, "rankOrder": null, "children": []},
              {"ID": 608, "name": "PriceListsTest", "description": null, "parentID": 604, "rankOrder": null, "children": []},
              {"ID": 609, "name": "Production_2025", "description": null, "parentID": 604, "rankOrder": null, "children": []}
            ]
          },
          {"ID": 610, "name": "MainTest", "description": null, "parentID": 602, "rankOrder": null, "children": []},
          {"ID": 611, "name": "MobileAndroid", "description": null, "parentID": 602, "rankOrder": null, "children": []},
          {"ID": 612, "name": "PriceLists", "description": null, "parentID": 602, "rankOrder": null, "children": []},
          {"ID": 613, "name": "PriceListsTest", "description": null, "parentID": 602, "rankOrder": null, "children": []},
          {"ID": 614, "name": "Production", "description": null, "parentID": 602, "rankOrder": null, "children": []}
        ]
      },
      {"ID": 615, "name": "default", "description": null, "parentID": 601, "rankOrder": null, "children": []}
    ]
  },
  {
    "ID": 701,
    "name": "Manual regression",
    "description": null,
    "parentID": null,
    "rankOrder": null,
    "children": []
  }
]
```

---

## `paged` — Paginated cycles list (with detail)

Envelope: `items`, `allIDs`, `startAt`, `maxResults`, `total`, `isLast`, `additionalData`.

Each item when `detail` is loaded:
- `ID` — cycle ID
- `jiraProjectID` — linked Jira project ID
- `permission.value` — permission bitmask (15 = full access)
- `detail.key` — Jira-style cycle key (e.g. `PROJ-CY-123`)
- `detail.title` — cycle name
- `detail.objective` — optional objective text
- `detail.ownedByID` — owner user ID string
- `detail.folder` — folder ID or null
- `detail.jiraComponentID` — array of component IDs
- `detail.jiraReleaseID` — array of release IDs
- `detail.startDate / endDate / createdDate / updatedDate / closeDate` — ISO date strings or null
- `detail.isSystemDefined` — null
- `detail.tags` — null or array
- `detail.customFieldValues` — object (can be empty)
- `detail.isLockedForEdit` — null or bool
- `detail.isClosed` — bool
- `detail.archived` — null or bool
- `detail.closedByID` — null or user ID string
- `detail.planStatus` — null
- `detail.tasks` — array (empty in list view)
- `summary` — null (populated separately in summary request)
- `objectiveAttachments` — array

```json
{
  "items": [
    {
      "ID": 1001,
      "jiraProjectID": 2001,
      "permission": {"value": 15},
      "detail": {
        "key": "PROJ-CY-101",
        "title": "Cycle Alpha 2026",
        "objective": null,
        "ownedByID": "user_a",
        "folder": null,
        "jiraComponentID": [],
        "jiraReleaseID": [],
        "startDate": null,
        "endDate": null,
        "createdDate": null,
        "updatedDate": null,
        "isSystemDefined": null,
        "tags": null,
        "customFieldValues": {},
        "isLockedForEdit": null,
        "isClosed": false,
        "archived": null,
        "closeDate": null,
        "closedByID": null,
        "planStatus": null,
        "tasks": []
      },
      "summary": null,
      "objectiveAttachments": []
    },
    {
      "ID": 1002,
      "jiraProjectID": 2001,
      "permission": {"value": 15},
      "detail": {
        "key": "PROJ-CY-102",
        "title": "Cycle Beta 2026",
        "objective": null,
        "ownedByID": "user_b",
        "folder": null,
        "jiraComponentID": [],
        "jiraReleaseID": [],
        "startDate": null,
        "endDate": null,
        "createdDate": null,
        "updatedDate": null,
        "isSystemDefined": null,
        "tags": null,
        "customFieldValues": {},
        "isLockedForEdit": null,
        "isClosed": false,
        "archived": null,
        "closeDate": null,
        "closedByID": null,
        "planStatus": null,
        "tasks": []
      },
      "summary": null,
      "objectiveAttachments": []
    },
    {
      "ID": 1003,
      "jiraProjectID": 2001,
      "permission": {"value": 15},
      "detail": {
        "key": "PROJ-CY-103",
        "title": "Cycle Gamma 2026",
        "objective": null,
        "ownedByID": "user_a",
        "folder": null,
        "jiraComponentID": [],
        "jiraReleaseID": [],
        "startDate": null,
        "endDate": null,
        "createdDate": null,
        "updatedDate": null,
        "isSystemDefined": null,
        "tags": null,
        "customFieldValues": {},
        "isLockedForEdit": null,
        "isClosed": false,
        "archived": null,
        "closeDate": null,
        "closedByID": null,
        "planStatus": null,
        "tasks": []
      },
      "summary": null,
      "objectiveAttachments": []
    }
  ],
  "allIDs": [1001, 1002, 1003, 1004, 1005, 1006, 1007],
  "startAt": 0,
  "maxResults": 20,
  "total": 7,
  "isLast": true,
  "additionalData": {}
}
```

---

## `paged2` — Paginated cycles list (with summary only)

Same envelope, but `detail` is null and `summary` is populated. The two requests (`paged` + `paged2`) are fetched in parallel to build the full page.

`summary` shape:
- `totalTests` — total test count across all runs in this cycle
- `totalRuns` — null
- `totalTestsWithDS` — null
- `estimatedEffort` — null
- `testRunDistribution` — `{ runID: testCount }` (run IDs are integers)
- `actualEffort` — null
- `assignees` — null

```json
[
  {
    "ID": 1001,
    "jiraProjectID": 2001,
    "permission": {"value": 15},
    "detail": null,
    "summary": {
      "totalTests": 261,
      "totalRuns": null,
      "totalTestsWithDS": null,
      "estimatedEffort": null,
      "testRunDistribution": {"53": 228, "901": 30, "54": 3},
      "actualEffort": null,
      "assignees": null
    },
    "objectiveAttachments": []
  },
  {
    "ID": 1002,
    "jiraProjectID": 2001,
    "permission": {"value": 15},
    "detail": null,
    "summary": {
      "totalTests": 173,
      "totalRuns": null,
      "totalTestsWithDS": null,
      "estimatedEffort": null,
      "testRunDistribution": {"53": 142, "901": 31},
      "actualEffort": null,
      "assignees": null
    },
    "objectiveAttachments": []
  },
  {
    "ID": 1003,
    "jiraProjectID": 2001,
    "permission": {"value": 15},
    "detail": null,
    "summary": {
      "totalTests": 36,
      "totalRuns": null,
      "totalTestsWithDS": null,
      "estimatedEffort": null,
      "testRunDistribution": {"53": 34, "54": 2},
      "actualEffort": null,
      "assignees": null
    },
    "objectiveAttachments": []
  },
  {
    "ID": 1004,
    "jiraProjectID": 2001,
    "permission": {"value": 15},
    "detail": null,
    "summary": {
      "totalTests": 77,
      "totalRuns": null,
      "totalTestsWithDS": null,
      "estimatedEffort": null,
      "testRunDistribution": {"53": 71, "901": 6},
      "actualEffort": null,
      "assignees": null
    },
    "objectiveAttachments": []
  },
  {
    "ID": 1005,
    "jiraProjectID": 2001,
    "permission": {"value": 15},
    "detail": null,
    "summary": {
      "totalTests": 30,
      "totalRuns": null,
      "totalTestsWithDS": null,
      "estimatedEffort": null,
      "testRunDistribution": {"901": 1, "53": 25, "55": 4},
      "actualEffort": null,
      "assignees": null
    },
    "objectiveAttachments": []
  },
  {
    "ID": 1006,
    "jiraProjectID": 2001,
    "permission": {"value": 15},
    "detail": null,
    "summary": {
      "totalTests": 42,
      "totalRuns": null,
      "totalTestsWithDS": null,
      "estimatedEffort": null,
      "testRunDistribution": {"53": 42},
      "actualEffort": null,
      "assignees": null
    },
    "objectiveAttachments": []
  },
  {
    "ID": 1007,
    "jiraProjectID": 2001,
    "permission": {"value": 15},
    "detail": null,
    "summary": {
      "totalTests": 48,
      "totalRuns": null,
      "totalTestsWithDS": null,
      "estimatedEffort": null,
      "testRunDistribution": {"51": 3, "53": 43, "54": 1, "55": 1},
      "actualEffort": null,
      "assignees": null
    },
    "objectiveAttachments": []
  }
]
```

---

## Key observations

- **Two parallel requests per page load**: one for `detail` (cycle metadata) and one for `summary` (test counts + run distribution).
- **`folder`** is `null` on all cycles in the paged example — cycles can be unassigned to a folder.
- **`testRunDistribution`** maps run IDs to test counts; run IDs (e.g. 53, 55, 901) correspond to test run records.
- **`count`** maps `folderID → totalTestCount`; key `-1` = unassigned folder.
- **Folder tree** is deeply nested with `parentID` / `children` — the real AIO page uses this for its folder sidebar navigation.
- **Pagination**: `allIDs` contains the full sorted list of IDs; `items` is the current page slice. `isLast: true` means no more pages.
