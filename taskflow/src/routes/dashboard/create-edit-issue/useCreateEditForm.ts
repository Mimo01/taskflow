import { useEffect, useReducer } from 'react';
import type { IssueLinkRowValue } from '../IssueLinkRow';

// ── Types ────────────────────────────────────────────────────────────────────

export interface EditInitialValues {
  issueKey: string;
  summary: string;
  description: string;
  assigneeName: string | null;
  priority: string | null;
  storyPoints: number | null;
  epicLinkKey: string | null;
  linkRows?: IssueLinkRowValue[];
}

const ISSUE_TYPES = ['Story', 'Subtask', 'Bug'] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export interface AutoCompleteResult {
  id: string;
  label: string;
}

export interface FormState {
  selectedIssueType: IssueType;
  summary: string;
  description: string;
  assigneeInputValue: string;
  selectedAssigneeName: string | null;
  showAssigneeResults: boolean;
  timeEstimate: string;
  priority: string | null;
  storyPoints: string;
  epicLinkKey: string | null;
  epicOpen: boolean;
  epicFilter: string;
  parentKey: string | null;
  customFieldValues: Record<string, string>;
  customFieldInputValues: Record<string, string>;
  customFieldAutoResults: Record<string, AutoCompleteResult[]>;
  customFieldShowResults: Record<string, boolean>;
  apiError: string | null;
  linkRows: IssueLinkRowValue[];
}

export type FormAction =
  | { type: 'SET_FIELD'; field: keyof FormState; value: FormState[keyof FormState] }
  | { type: 'RESET'; defaultIssueType?: IssueType; defaultParentKey?: string | null; initialValues?: EditInitialValues }
  | { type: 'SET_ISSUE_TYPE'; issueType: IssueType }
  | { type: 'SET_CUSTOM_FIELD_VALUE'; fieldId: string; value: string }
  | { type: 'SET_CUSTOM_FIELD_INPUT'; fieldId: string; value: string }
  | { type: 'SET_CUSTOM_FIELD_AUTO_RESULTS'; fieldId: string; results: AutoCompleteResult[] }
  | { type: 'SET_CUSTOM_FIELD_SHOW_RESULTS'; fieldId: string; show: boolean }
  | { type: 'ADD_LINK_ROW'; row: IssueLinkRowValue }
  | { type: 'UPDATE_LINK_ROW'; row: IssueLinkRowValue }
  | { type: 'REMOVE_LINK_ROW'; id: string };

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildInitialState(
  defaultIssueType?: IssueType,
  defaultParentKey?: string | null,
  initialValues?: EditInitialValues,
): FormState {
  return {
    selectedIssueType: defaultIssueType ?? 'Story',
    summary: initialValues?.summary ?? '',
    description: initialValues?.description ?? '',
    assigneeInputValue: initialValues?.assigneeName ?? '',
    selectedAssigneeName: initialValues?.assigneeName ?? null,
    showAssigneeResults: false,
    timeEstimate: '',
    priority: initialValues?.priority ?? null,
    storyPoints: initialValues?.storyPoints != null ? String(initialValues.storyPoints) : '',
    epicLinkKey: initialValues?.epicLinkKey ?? null,
    epicOpen: false,
    epicFilter: '',
    parentKey: defaultParentKey ?? null,
    customFieldValues: {},
    customFieldInputValues: {},
    customFieldAutoResults: {},
    customFieldShowResults: {},
    apiError: null,
    linkRows: initialValues?.linkRows ?? [],
  };
}

// ── Reducer ──────────────────────────────────────────────────────────────────

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };

    case 'RESET':
      return buildInitialState(action.defaultIssueType, action.defaultParentKey, action.initialValues);

    case 'SET_ISSUE_TYPE':
      return {
        ...state,
        selectedIssueType: action.issueType,
        // Reset parent/epic when switching types
        parentKey: null,
        epicLinkKey: null,
      };

    case 'SET_CUSTOM_FIELD_VALUE':
      return {
        ...state,
        customFieldValues: { ...state.customFieldValues, [action.fieldId]: action.value },
      };

    case 'SET_CUSTOM_FIELD_INPUT':
      return {
        ...state,
        customFieldInputValues: { ...state.customFieldInputValues, [action.fieldId]: action.value },
      };

    case 'SET_CUSTOM_FIELD_AUTO_RESULTS':
      return {
        ...state,
        customFieldAutoResults: { ...state.customFieldAutoResults, [action.fieldId]: action.results },
      };

    case 'SET_CUSTOM_FIELD_SHOW_RESULTS':
      return {
        ...state,
        customFieldShowResults: { ...state.customFieldShowResults, [action.fieldId]: action.show },
      };

    case 'ADD_LINK_ROW':
      return { ...state, linkRows: [...state.linkRows, action.row] };

    case 'UPDATE_LINK_ROW':
      return {
        ...state,
        linkRows: state.linkRows.map((r) => (r.id === action.row.id ? action.row : r)),
      };

    case 'REMOVE_LINK_ROW':
      return {
        ...state,
        linkRows: state.linkRows.filter((r) => r.id !== action.id),
      };

    default:
      return state;
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

interface UseCreateEditFormOptions {
  open: boolean;
  mode: 'create' | 'edit';
  initialValues?: EditInitialValues;
  defaultIssueType?: IssueType;
  defaultParentKey?: string;
}

export function useCreateEditForm({
  open,
  mode,
  initialValues,
  defaultIssueType,
  defaultParentKey,
}: UseCreateEditFormOptions) {
  const [state, dispatch] = useReducer(
    formReducer,
    buildInitialState(defaultIssueType, defaultParentKey, initialValues),
  );

  // Reset form state on each open — the component stays mounted in AppLayout
  // between opens; useReducer initializers only run once, so we must re-sync
  // from props whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    dispatch({
      type: 'RESET',
      defaultIssueType: defaultIssueType ?? 'Story',
      defaultParentKey: defaultParentKey ?? null,
      initialValues,
    });
  }, [
    open,
    defaultIssueType,
    defaultParentKey,
    initialValues?.storyPoints,
    initialValues?.assigneeName,
    initialValues?.description,
    initialValues?.epicLinkKey,
    initialValues?.priority,
    initialValues?.summary,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const isSubtask = state.selectedIssueType === 'Subtask';

  return {
    state,
    dispatch,
    isSubtask,
    mode,
  };
}
