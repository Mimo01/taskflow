import { Input } from '@/components/ui/input';
import { PersonPicker, toPersonValue } from '@/components/ui/person-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/apiFetch';
import type { CreatemetaField } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { AutocompleteField } from './AutocompleteField';
import type { FormAction, FormState } from './useCreateEditForm';

// ── Types ────────────────────────────────────────────────────────────────────

interface CustomFieldsSectionProps {
  customRequiredFields: CreatemetaField[];
  creatmetaFields?: CreatemetaField[];
  creatmetaLoading: boolean;
  state: FormState;
  dispatch: React.Dispatch<FormAction>;
  projectKey: string;
  jiraBaseUrl: string;
  isPending: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchAutoComplete(
  field: CreatemetaField,
  fid: string,
  query: string,
  dispatch: React.Dispatch<FormAction>,
) {
  if (field.autoCompleteUrl) {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token) return;
    const url = field.autoCompleteUrl + encodeURIComponent(query);
    const resp = await apiFetch(
      'jira',
      url,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
      'Load Fields',
    );
    if (!resp.ok) return;
    const data = await resp.json();
    const items: unknown[] = Array.isArray(data)
      ? data
      : (data.values ?? data.users ?? data.accounts ?? data.results ?? data.suggestions ?? []);
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
  projectKey,
  jiraBaseUrl,
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
        const hasAutocomplete = !!field.autoCompleteUrl;
        const userName = state.customFieldValues[fid];

        return (
          <div key={fid} className="flex flex-col gap-1">
            <label htmlFor={fid} className="text-xs font-semibold text-muted-foreground">
              {field.name}
              <span className="text-destructive"> *</span>
            </label>
            {field.schema.allowedValues && field.schema.allowedValues.length > 0 ? (
              <Select
                value={state.customFieldValues[fid] ?? ''}
                onValueChange={(v) =>
                  dispatch({ type: 'SET_CUSTOM_FIELD_VALUE', fieldId: fid, value: v ?? '' })
                }
              >
                <SelectTrigger id={fid} className="w-full">
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
            ) : isUserField ? (
              <PersonPicker
                variant="field"
                id={fid}
                aria-label={field.name}
                projectKey={projectKey}
                jiraBaseUrl={jiraBaseUrl}
                value={
                  userName
                    ? {
                        name: userName,
                        displayName: state.customFieldInputValues[fid] || userName,
                      }
                    : null
                }
                emptyLabel={`Select ${field.name}`}
                disabled={isPending}
                onChange={(user) => {
                  if (!user) return;
                  const p = toPersonValue(user);
                  dispatch({ type: 'SET_CUSTOM_FIELD_VALUE', fieldId: fid, value: p.name });
                  dispatch({ type: 'SET_CUSTOM_FIELD_INPUT', fieldId: fid, value: p.displayName });
                }}
              />
            ) : hasAutocomplete ? (
              <AutocompleteField
                id={fid}
                label={field.name}
                value={state.customFieldValues[fid] ?? ''}
                displayText={state.customFieldInputValues[fid] ?? ''}
                results={state.customFieldAutoResults[fid] ?? []}
                required={field.required}
                disabled={isPending}
                onSearch={(q) => void fetchAutoComplete(field, fid, q, dispatch)}
                onSelect={(result) => {
                  dispatch({ type: 'SET_CUSTOM_FIELD_VALUE', fieldId: fid, value: result.id });
                  dispatch({ type: 'SET_CUSTOM_FIELD_INPUT', fieldId: fid, value: result.label });
                }}
              />
            ) : (
              <Input
                id={fid}
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
