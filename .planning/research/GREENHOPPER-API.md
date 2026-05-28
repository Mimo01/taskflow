## Jira Agile (GreenHopper) API — Complete Reference

---

### Endpoints

| File               | Method | URL Pattern                                                                                                            |
| ------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| `allData.json`     | GET    | `/rest/greenhopper/1.0/xboard/work/allData.json?rapidViewId={boardId}`                                                 |
| `data.json`        | GET    | `/rest/greenhopper/1.0/xboard/plan/backlog/data.json?rapidViewId={boardId}`                                            |
| `details.json`     | GET    | `/rest/greenhopper/1.0/xboard/issue/details.json?rapidViewId={boardId}&issueIdOrKey={issueKey}&loadSubtasks={boolean}` |
| `transitions.json` | GET    | `/rest/greenhopper/1.0/xboard/work/transitions.json?projectId={projectId}`                                             |

---

### Shared Types

#### `Issue` (base)
```ts
{
  id: number
  key: string                    // e.g. "PROJECT-123"
  hidden: boolean
  typeId: string
  summary: string
  priorityId: string
  done: boolean
  assignee?: string              // username
  assigneeName?: string
  avatarUrl?: string
  hasCustomUserAvatar: boolean
  color: string                  // hex
  flagged?: boolean
  epicId?: number
  epic?: string                  // epic issue key
  parentId?: number              // present on sub-tasks
  parentKey?: string
  estimateStatisticRequired: boolean
  estimateStatistic: {
    statFieldId: string
    statFieldValue: { value?: number; text?: string }
  }
  trackingStatistic: {
    statFieldId: string
    statFieldValue: { value?: number; text?: string }
  }
  statusId: string
  fixVersions: number[]
  projectId: number
}
```

#### `Section` (used inside `details.tabs`)
```ts
{
  label: string
  toolTip?: string
  providerKey: string
  html: string                   // server-rendered HTML
  iconFont?: string
  iconURL?: string
  tabIconId?: string
  weight: number
  renderHeader: boolean
  titleCount?: number
  headerLinks: {
    links: {
      id: string; label: string; title: string
      styleClass: string; href: string; weight: number
      params: Record<string, string>
    }[]
    groups: {
      header: { id: string; weight: number }
      links: { id: string; label: string; title: string
               styleClass: string; href: string; weight: number
               params: Record<string, string> }[]
      groups: any[]
    }[]
  }
}
```

#### `Transition`
```ts
{
  transitionId: number
  name: string
  toStatusId: number
  fromStatusId?: number          // absent when isGlobal = true
  hasScreen: boolean
  hasConditions: boolean
  hasValidators: boolean
  isInitial: boolean
  isGlobal: boolean
}
```

---

### `allData.json` — Active Sprint Board

Full board snapshot: entity lookup maps + column config + swimlanes + issues with position data.

```ts
{
  rapidViewId: number
  statistics: {
    fieldConfigured: boolean
    typeId: string
    id: string
    name: string
  }
  entityData: {
    statuses: {
      [statusId: string]: {
        statusUrl: string
        statusName: string
        status: {
          id: string
          name: string
          description: string
          iconUrl: string
          statusCategory: { id: string; key: string; colorName: string }
        }
      }
    }
    priorities: {
      [priorityId: string]: { priorityName: string; priorityUrl: string }
    }
    types: {
      [typeId: string]: { typeUrl: string; typeName: string }
    }
    epics: {
      [epicId: string]: {
        epicField: {
          id: string
          label: string
          editable: boolean
          renderer: string
          epicKey: string
          epicColor: string
          text: string
        }
      }
    }
  }
  columnsData: {
    rapidViewId: number
    columns: {
      id: number
      name: string
      statusIds: string[]
    }[]
  }
  swimlanesData: {
    rapidViewId: number
    swimlaneStrategy: string
    parentSwimlanesData: {
      parentIssueIds: number[]
      inprogressCandidates: number[]
      doneCandidates: number[]
    }
  }
  issuesData: {
    rapidViewId: number
    activeFilters: any[]
    issues: (Issue & {
      timeInColumn: {
        enteredStatus: number    // unix ms timestamp
        durationPreviously: number
      }
    })[]
  }
}
```

---

### `data.json` — Backlog / Flat Issue List

Lightweight list of all issues for the board (no board column/time data).

```ts
{
  issues: Issue[]
}
```

> Same `Issue` base shape — **no** `timeInColumn` field.

---

### `details.json` — Single Issue Detail

Full detail view of one issue: operations menu, sprint, tabs with rendered HTML and inline edit forms.

```ts
{
  key: string
  id: number
  editable: boolean
  canCreateComment: boolean
  isSubtask: boolean
  totalComments: number
  flagged: boolean
  projectName: string
  projectAvatarUrl: string
  isAssigned: boolean
  primaryStatisticFieldId: string
  trackingStatisticFieldId: string

  sprint: {
    id: number
    sequence: number
    rapidViewId: number
    name: string
    state: "ACTIVE" | "CLOSED" | "FUTURE"
    autoStartStop: boolean
    synced: boolean
  }

  operations: {
    issueKey: string
    sections: {
      groupId: string
      operations: {
        id: string
        label: string
        title: string
        styleClass: string
        url: string
      }[]
    }[]
  }

  tabs: {
    defaultTabs: [
      {
        tabId: "HEADER"
        fields: {
          id: string
          label: string
          editable: boolean
          type?: string
          renderer: string
          text?: string
          value?: number
        }[]
      },
      {
        tabId: "DETAILS"
        sections: Section[]
        inlineEditableFields: {
          id: string
          label: string
          required: boolean
          editHtml: string       // HTML form fragment for inline editing
        }[]
      },
      {
        tabId: "DESCRIPTION"
        sections: Section[]
      },
      {
        tabId: "COMMENT"
        sections: Section[]
        totalComments: number
        canCreateComment: boolean
      },
      {
        tabId: "ATTACHMENT"
        sections: Section[]
      },
      {
        tabId: "SUB_TASKS"
        subtaskEntries: any[]
        totalSubtaskCount: number
      },
      { tabId: "ISSUES_IN_EPIC" },
      {
        tabId: "THIRD_PARTY_TAB"
        sections: Section[]
      }
    ]
  }
}
```

---

### `transitions.json` — Workflow Transitions

Maps project → issue type → workflow name, and workflow name → available transitions.

```ts
{
  projectAndIssueTypeToWorkflow: {
    [projectId: string]: {
      [issueTypeId: string]: string   // workflow name
    }
  }
  workflowToTransitions: {
    [workflowName: string]: Transition[]
  }
}
```

---

### Entity Relationships

```
allData.entityData.statuses[statusId]        ← allData/data issues[].statusId
allData.entityData.priorities[priorityId]    ← allData/data issues[].priorityId
allData.entityData.types[typeId]             ← allData/data issues[].typeId
allData.entityData.epics[epicId]             ← allData/data issues[].epicId
allData/data issues[].parentId               → another issue's id (sub-task parent)

transitions
  .projectAndIssueTypeToWorkflow[projectId][typeId]
  → workflowToTransitions[workflowName][]    ← drive status changes for an issue

details.key / details.id                     ↔ allData/data issues[].key / .id
```