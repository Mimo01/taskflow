import { X } from 'lucide-react';
import { type Dispatch, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { FormAction } from './useCreateEditForm';

interface LabelsFieldProps {
  id: string;
  labels: string[];
  dispatch: Dispatch<FormAction>;
  disabled?: boolean;
}

/** Labels token input: chips with remove buttons plus an Enter-to-add input. */
export function LabelsField({ id, labels, dispatch, disabled }: LabelsFieldProps) {
  const [text, setText] = useState('');

  const set = (next: string[]) => dispatch({ type: 'SET_FIELD', field: 'labels', value: next });

  const commit = () => {
    // Jira labels cannot contain spaces: split on whitespace, dedupe.
    const next = [...labels];
    for (const token of text.split(/\s+/)) {
      if (token && !next.includes(token)) next.push(token);
    }
    if (next.length !== labels.length) set(next);
    setText('');
  };

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1">
      {labels.map((l) => (
        <Badge key={l} variant="secondary" className="gap-1 text-xs">
          {l}
          <button
            type="button"
            disabled={disabled}
            onClick={() => set(labels.filter((x) => x !== l))}
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Remove label ${l}`}
          >
            <X size={12} />
          </button>
        </Badge>
      ))}
      <Input
        id={id}
        value={text}
        disabled={disabled}
        placeholder="Add label"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape' && text) {
            e.stopPropagation();
            setText('');
          }
        }}
        className="h-7 min-w-24 flex-1 text-sm"
      />
    </div>
  );
}
