import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/apiFetch';
import type { CreatemetaField, JiraUser } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import type { AutoCompleteResult, FormAction, FormState } from './useCreateEditForm';

// ── Types ────────────────────────────────────────────────────────────────────

interface CustomFieldsSectionProps {
  customRequiredFields: CreatemetaField[];
  creatmetaFields?: CreatemetaField[];
  creatmetaLoading: boolean;
  state: FormState;
  dispatch: React.Dispatch<FormAction>;
  allAssignees: JiraUser[];
  isPending: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fuzzyMatch(str: string, query: string): boolean {
  let i = 0;
  for (const ch of str.toLowerCase()) {
    if (ch === query[i]) i++;
    if (i === query.length) return true;
  }
  return false;
}

async function fetchAutoComplete(
  field: CreatemetaField,
  fid: string,
  query: string,
  allAssignees: JiraUser[],
  dispatch: React.Dispatch<FormAction>,
) {
  const isUserField = field.schema.type === 'user' || field.schema.items === 'user';

  if (isUserField) {
    const lq = query.toLowerCase();
    const results: AutoCompleteResult[] = !lq
      ? allAssignees.map((u) => ({
          id: u.name,
          label: `${u.displayName} (${u.name})`,
        }))
      : allAssignees
          .filter((u) => fuzzyMatch(u.displayName, lq) || fuzzyMatch(u.name, lq))
          .map((u) => ({ id: u.name, label: `${u.displayName} (${u.name})` }));
    dispatch({ type: 'SET_CUSTOM_FIELD_AUTO_RESULTS', fieldId: fid, results });
  } else if (field.autoCompleteUrl) {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token) return;
    const url = field.autoCompleteUrl + encodeURIComponent(query);
    const resp = await apiFetch('jira', url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return;
    const data = await resp.json();
    const items: unknown[] = Array.isArray(data)
      ? data
      : (data.values ??
        data.users ??
        data.accounts ??
        data.results ??
        data.suggestions ??
        []);
    const results = (items as Record<string, string>[]).map((item) => ({
      id: String(item.id ?? item.name ?? item.key ?? ''),
      label: item.key
        ? `${item.key} – ${item.displayName ?? item.name ?? item.value ?? ''}`
        : (item.displayName ?? item.name ?? item.value ?? String(item.id ?? '')),
    }));
    dispatch({ type: 'SET_CUSTOM_FIELD_AUTO_RESULTS', fieldId: fid, results });
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function CustomFieldsSection({
  customRequiredFields,
  creatmetaFields,
  creatmetaLoading,
  state,
  dispatch,
  allAssignees,
  isPending,
}: CustomFieldsSectionProps) {
  return (
    <>
      {creatmetaLoading && !creatmetaFields && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-full" />
        </div>
      )}
      {customRequiredFields.map((field) => {
        const fid = field.fieldId;
        const isUserField = field.schema.type === 'user' || field.schema.items === 'user';
        const hasAutocomplete = isUserField || !!field.autoCompleteUrl;

        return (
          <div key={fid} className="flex flex-col gap-1">
            <label className="text-sm font-medium">
              {field.name} <span className="text-destructive">*</span>
            </label>
            {field.schema.allowedValues && field.schema.allowedValues.length > 0 ? (
              <Select
                value={state.customFieldValues[fid] ?? ''}
                onValueChange={(v) =>
                  dispatch({ type: 'SET_CUSTOM_FIELD_VALUE', fieldId: fid, value: v ?? '' })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={`Select ${field.name}`} />
                </SelectTrigger>
                <SelectContent>
                  {field.schema.allowedValues.map((av) => (
                    <SelectItem key={av.id} value={av.id}>
                      {av.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : hasAutocomplete ? (
              <div className="relative">
                <Input
                  value={state.customFieldInputValues[fid] ?? ''}
                  onChange={(e) => {
                    const q = e.target.value;
                    dispatch({ type: 'SET_CUSTOM_FIELD_INPUT', fieldId: fid, value: q });
                    dispatch({ type: 'SET_CUSTOM_FIELD_VALUE', fieldId: fid, value: '' });
                    dispatch({ type: 'SET_CUSTOM_FIELD_SHOW_RESULTS', fieldId: fid, show: true });
                    void fetchAutoComplete(field, fid, q, allAssignees, dispatch);
                  }}
                  onFocus={() => {
                    dispatch({ type: 'SET_CUSTOM_FIELD_SHOW_RESULTS', fieldId: fid, show: true });
                    if (!state.customFieldAutoResults[fid]?.length)
                      void fetchAutoComplete(field, fid, '', allAssignees, dispatch);
                  }}
                  onBlur={() =>
                    setTimeout(
                      () =>
                        dispatch({ type: 'SET_CUSTOM_FIELD_SHOW_RESULTS', fieldId: fid, show: false }),
                      150,
                    )
                  }
                  placeholder={`Search ${field.name}...`}
                  disabled={isPending}
                />
                {state.customFieldShowResults[fid] &&
                  (state.customFieldAutoResults[fid] ?? []).length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-md">
                      {(state.customFieldAutoResults[fid] ?? []).map((result) => (
                        <button
                          key={result.id}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                          onMouseDown={() => {
                            dispatch({ type: 'SET_CUSTOM_FIELD_VALUE', fieldId: fid, value: result.id });
                            dispatch({ type: 'SET_CUSTOM_FIELD_INPUT', fieldId: fid, value: result.label });
                            dispatch({ type: 'SET_CUSTOM_FIELD_SHOW_RESULTS', fieldId: fid, show: false });
                          }}
                        >
                          {result.label}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            ) : (
              <Input
                value={state.customFieldValues[fid] ?? ''}
                onChange={(e) =>
                  dispatch({ type: 'SET_CUSTOM_FIELD_VALUE', fieldId: fid, value: e.target.value })
                }
                placeholder={field.name}
                disabled={isPending}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
