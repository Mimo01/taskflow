/**
 * SaveFilterDialog -- Modal dialog for saving the current JQL filter to Jira.
 *
 * Shows a form with filter name (required), optional description, and a
 * read-only JQL preview. Calls createJiraFilter on submit and updates the
 * saved-filter store on success.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createJiraFilter } from '@/services/jira/filters';
import type { JiraSavedFilter } from '@/services/jira/types';
import { readSecret } from '@/services/stronghold';
import { useSavedFilterStore } from '@/stores/saved-filter.store';

interface SaveFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jql: string;
  jiraBaseUrl: string;
  onSaved?: (filter: JiraSavedFilter) => void;
}

export function SaveFilterDialog({
  open,
  onOpenChange,
  jql,
  jiraBaseUrl,
  onSaved,
}: SaveFilterDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addSavedFilter = useSavedFilterStore((s) => s.addSavedFilter);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setName('');
      setDescription('');
      setError(null);
      setIsSubmitting(false);
    }
    onOpenChange(nextOpen);
  }

  async function handleSubmit() {
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const token = await readSecret('jira-pat');
      const result = await createJiraFilter(jiraBaseUrl, token, name.trim(), jql, description.trim() || undefined);
      addSavedFilter(result);
      onSaved?.(result);
      handleOpenChange(false);
    } catch {
      setError('Could not save filter. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Current Filter</DialogTitle>
          <DialogDescription>Save this filter to quickly apply it later.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="filter-name">Filter name</Label>
            <Input
              id="filter-name"
              placeholder="My filter"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="filter-description">Description (optional)</Label>
            <Textarea
              id="filter-description"
              placeholder="What this filter shows..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-12"
            />
          </div>

          <div className="grid gap-1.5">
            <Label>JQL query</Label>
            <pre className="rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground whitespace-pre-wrap break-all">
              {jql}
            </pre>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Don't Save
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Filter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
