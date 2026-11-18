import type { Dispatch, ReactNode } from 'react';
import { EpicPicker } from '@/components/ui/epic-picker';
import { Input } from '@/components/ui/input';
import { PersonPicker, toPersonValue } from '@/components/ui/person-picker';
import { PriorityIcon } from '@/components/ui/priority-icon';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { StaleNotes } from '@/lib/issue-draft-snapshot';
import type { CreatemetaField, JiraPriority } from '@/services/jira';
import { CustomFieldsSection } from './CustomFieldsSection';
import { FixVersionField } from './FixVersionField';
import { ISSUE_TYPE_CONTROL_ID, IssueTypeSelector } from './IssueTypeSelector';
import { LabelsField } from './LabelsField';
import type { FormAction, FormState } from './useCreateEditForm';

interface ModalSidebarProps {
  mode: 'create' | 'edit';
  state: FormState;
  dispatch: Dispatch<FormAction>;
  isSubtask: boolean;
  isPending: boolean;
  projectKey: string;
  jiraBaseUrl: string;
  defaultParentKey?: string;
  priorityOptions: JiraPriority[];
  creatmetaFields?: CreatemetaField[];
  creatmetaLoading: boolean;
  customRequiredFields: CreatemetaField[];
  labelsRequired: boolean;
  fixVersionsOffered: boolean;
  fixVersionsRequired: boolean;
  open: boolean;
  issueTypeName?: string;
  staleNotes?: StaleNotes;
  /** Issue type names the project offers (Create only). */
  availableTypeNames?: string[];
}

function Row({
  htmlFor,
  label,
  required,
  note,
  children,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-xs font-semibold text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {children}
      {note && <p className="truncate text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

/** Sidebar field stack of the Create/Edit modal: label above a full-width control. */
export function ModalSidebar({
  mode,
  state,
  dispatch,
  isSubtask,
  isPending,
  projectKey,
  jiraBaseUrl,
  defaultParentKey,
  priorityOptions,
  creatmetaFields,
  creatmetaLoading,
  customRequiredFields,
  labelsRequired,
  fixVersionsOffered,
  fixVersionsRequired,
  open,
  issueTypeName,
  staleNotes,
  availableTypeNames,
}: ModalSidebarProps) {
  const showFixVersion =
    mode === 'create'
      ? fixVersionsOffered && !isSubtask
      : issueTypeName !== 'Subtask' && issueTypeName !== 'Sub-task';

  const selectedPriority = state.priority
    ? (priorityOptions.find((p) => p.name === state.priority) ?? { name: state.priority })
    : null;

  return (
    <div className="flex flex-col gap-4">
      {mode === 'create' && !isSubtask && (
        <Row htmlFor={ISSUE_TYPE_CONTROL_ID} label="Issue type">
          <IssueTypeSelector
            selectedIssueType={state.selectedIssueType}
            availableTypeNames={availableTypeNames}
            dispatch={dispatch}
          />
        </Row>
      )}

      <Row htmlFor="modal-assignee" label="Assignee">
        <PersonPicker
          variant="field"
          id="modal-assignee"
          aria-label="Assignee"
          projectKey={projectKey}
          jiraBaseUrl={jiraBaseUrl}
          value={state.selectedAssignee}
          allowUnassign
          showAssignToMe
          disabled={isPending}
          emptyLabel={mode === 'create' ? 'Select assignee (optional)' : 'Unassigned'}
          onChange={(user) =>
            dispatch(
              user
                ? { type: 'ASSIGNEE_PICK', user: toPersonValue(user) }
                : { type: 'ASSIGNEE_PICK_UNASSIGNED' },
            )
          }
        />
      </Row>

      <Row htmlFor="modal-priority" label="Priority">
        <Select
          value={state.priority ?? ''}
          onValueChange={(v) =>
            dispatch({ type: 'SET_FIELD', field: 'priority', value: v || null })
          }
        >
          <SelectTrigger id="modal-priority" className="w-full">
            {selectedPriority ? (
              <span className="flex min-w-0 items-center gap-1.5">
                <PriorityIcon priority={selectedPriority} />
                <span className="truncate">{selectedPriority.name}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Select priority</span>
            )}
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {priorityOptions.map((p) => (
              <SelectItem key={p.id} value={p.name}>
                <PriorityIcon priority={p} />
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>

      {isSubtask ? (
        <Row htmlFor="parent-key" label="Parent" required note={staleNotes?.parent}>
          {defaultParentKey ? (
            <div className="flex h-9 w-full items-center rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground font-mono">
              {state.parentKey}
            </div>
          ) : (
            <Input
              id="parent-key"
              value={state.parentKey ?? ''}
              onChange={(e) =>
                dispatch({ type: 'SET_FIELD', field: 'parentKey', value: e.target.value || null })
              }
              placeholder="Parent issue key (e.g. PROJ-123)"
              disabled={isPending}
            />
          )}
        </Row>
      ) : (
        <Row htmlFor="modal-epic-link" label="Epic" note={staleNotes?.epic}>
          <EpicPicker
            variant="field"
            id="modal-epic-link"
            value={state.epicLinkKey}
            projectKey={projectKey}
            disabled={isPending}
            onChange={(epic) =>
              dispatch({ type: 'SET_FIELD', field: 'epicLinkKey', value: epic?.key ?? null })
            }
          />
        </Row>
      )}

      <Row htmlFor="modal-labels" label="Labels" required={labelsRequired}>
        <LabelsField
          id="modal-labels"
          labels={state.labels}
          dispatch={dispatch}
          disabled={isPending}
        />
      </Row>

      {mode === 'create' && creatmetaLoading && !creatmetaFields && (
        <Skeleton className="h-9 w-full" />
      )}
      {showFixVersion && (
        <Row
          htmlFor="modal-fix-version"
          label="Fix version"
          required={fixVersionsRequired && !isSubtask}
          note={staleNotes?.fixVersions}
        >
          <FixVersionField
            id="modal-fix-version"
            value={state.fixVersions}
            dispatch={dispatch}
            disabled={isPending}
            open={open}
          />
        </Row>
      )}

      {!isSubtask && (
        <Row htmlFor="story-points" label="Story points">
          <Input
            id="story-points"
            type="number"
            min="0"
            step="0.5"
            value={state.storyPoints}
            onChange={(e) =>
              dispatch({ type: 'SET_FIELD', field: 'storyPoints', value: e.target.value })
            }
            placeholder="Optional"
            disabled={isPending}
          />
        </Row>
      )}

      {isSubtask && (
        <Row htmlFor="time-estimate" label="Estimate">
          <Input
            id="time-estimate"
            value={state.timeEstimate}
            onChange={(e) =>
              dispatch({ type: 'SET_FIELD', field: 'timeEstimate', value: e.target.value })
            }
            placeholder="e.g. 2h, 1d 3h, 30m"
            disabled={isPending}
          />
        </Row>
      )}

      <CustomFieldsSection
        customRequiredFields={customRequiredFields}
        creatmetaFields={creatmetaFields}
        creatmetaLoading={creatmetaLoading}
        state={state}
        dispatch={dispatch}
        projectKey={projectKey}
        jiraBaseUrl={jiraBaseUrl}
        isPending={isPending}
      />
      {Object.entries(staleNotes?.customFields ?? {}).map(([fieldId, note]) => (
        <p key={fieldId} className="text-xs text-muted-foreground">
          {note}
        </p>
      ))}
    </div>
  );
}
