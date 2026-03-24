/**
 * EditFilterDialog -- Modal dialog for editing an existing Jira saved filter.
 *
 * Pre-fills name, JQL (editable), and description from the filter being edited.
 * Calls updateJiraFilter on submit and updates the saved-filter store on success.
 */

import { useEffect, useState } from 'react';
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
import { updateJiraFilter } from '@/services/jira/filters';
import type { JiraSavedFilter } from '@/services/jira/types';
import { readSecret } from '@/services/stronghold';
import { useSavedFilterStore } from '@/stores/saved-filter.store';

interface EditFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter: JiraSavedFilter | null;
  jiraBaseUrl: string;
  onUpdated?: (filter: JiraSavedFilter) => void;
}

export function EditFilterDialog({
  open,
  onOpenChange,
  filter,
  jiraBaseUrl,
  onUpdated,
}: EditFilterDialogProps) {
  const [name, setName] = useState('');
  const [jql, setJql] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateSavedFilter = useSavedFilterStore((s) => s.updateSavedFilter);

  // Reset form fields when the filter prop changes (dialog opens with a new filter)
  useEffect(() => {
    if (filter) {
      setName(filter.name);
      setJql(filter.jql);
      setDescription(filter.description ?? '');
      setError(null);
      setIsSubmitting(false);
    }
  }, [filter]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setError(null);
      setIsSubmitting(false);
    }
    onOpenChange(nextOpen);
  }

  async function handleSubmit() {
    if (!filter || !name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const token = await readSecret('jira-pat');
      const result = await updateJiraFilter(jiraBaseUrl, token, filter.id, {
        name: name.trim(),
        jql: jql.trim(),
        description: description.trim() || undefined,
      });
      updateSavedFilter(filter.id, result);
      onUpdated?.(result);
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
          <DialogTitle>Edit Filter</DialogTitle>
          <DialogDescription>Update the filter name, query, or description.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="edit-filter-name">Filter name</Label>
            <Input
              id="edit-filter-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="edit-filter-jql">JQL query</Label>
            <Textarea
              id="edit-filter-jql"
              value={jql}
              onChange={(e) => setJql(e.target.value)}
              className="min-h-16 font-mono text-sm"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="edit-filter-description">Description (optional)</Label>
            <Textarea
              id="edit-filter-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-12"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Discard Changes
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isSubmitting}>
            {isSubmitting ? 'Updating...' : 'Update Filter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
