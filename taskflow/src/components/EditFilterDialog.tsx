/**
 * EditFilterDialog -- modal dialog for editing an existing Jira saved filter.
 *
 * Pre-fills name, description, and JQL from the filter being edited.
 * On submit, delegates to parent onUpdate callback which handles the Jira API call.
 */

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { JiraSavedFilter } from '@/services/jira/types';

export interface EditFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter: JiraSavedFilter | null;
  onUpdate: (filterId: string, name: string, jql: string, description: string) => Promise<void>;
}

export function EditFilterDialog({ open, onOpenChange, filter, onUpdate }: EditFilterDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [jql, setJql] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const discardRef = useRef<HTMLButtonElement>(null);

  // Sync form state when filter changes or dialog opens
  useEffect(() => {
    if (filter && open) {
      setName(filter.name);
      setDescription(filter.description ?? '');
      setJql(filter.jql);
      setError(null);
    }
  }, [filter, open]);

  function handleClose() {
    if (saving) return;
    setError(null);
    onOpenChange(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!filter || !name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onUpdate(filter.id, name.trim(), jql.trim(), description.trim());
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update filter');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Edit Filter</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-filter-name">Filter name</Label>
            <Input
              id="edit-filter-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Sprint Bugs"
              required
              disabled={saving}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-filter-description">Description (optional)</Label>
            <Textarea
              id="edit-filter-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this filter shows"
              disabled={saving}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-filter-jql">JQL</Label>
            <Textarea
              id="edit-filter-jql"
              value={jql}
              onChange={(e) => setJql(e.target.value)}
              className="font-mono text-xs"
              disabled={saving}
            />
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={saving}
              ref={discardRef}
              autoFocus
            >
              Discard Changes
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || saving}
            >
              {saving ? 'Updating...' : 'Update Filter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
