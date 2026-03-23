/**
 * SaveFilterDialog -- modal dialog for saving the current filter as a named Jira filter.
 *
 * Rendered from UnifiedFilterBar when user clicks "Save Filter".
 * On submit, delegates to parent onSave callback which handles the Jira API call.
 */

import { useRef, useState } from 'react';
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

export interface SaveFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, description: string) => Promise<void>;
}

export function SaveFilterDialog({ open, onOpenChange, onSave }: SaveFilterDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const discardRef = useRef<HTMLButtonElement>(null);

  function handleClose() {
    if (saving) return;
    setName('');
    setDescription('');
    setError(null);
    onOpenChange(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(name.trim(), description.trim());
      setName('');
      setDescription('');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save filter');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Save Current Filter</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="filter-name">Filter name</Label>
            <Input
              id="filter-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Sprint Bugs"
              required
              disabled={saving}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="filter-description">Description (optional)</Label>
            <Textarea
              id="filter-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this filter shows"
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
              Discard
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || saving}
            >
              {saving ? 'Saving...' : 'Save to Jira'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
