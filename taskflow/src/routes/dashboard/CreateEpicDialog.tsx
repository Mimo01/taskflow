import { Dialog } from '@base-ui/react/dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createIssue } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';

export interface CreateEpicDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateEpicDialog({ open, onClose }: CreateEpicDialogProps) {
  const { epicNameFieldKey } = useSettingsStore();
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();

  const [epicName, setEpicName] = useState('');
  const [description, setDescription] = useState('');

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const jiraToken = await readSecret('jira-pat').catch(() => null);
      if (!jiraBaseUrl || !jiraToken || !activeJiraProject || !epicNameFieldKey) {
        throw new Error('Not configured');
      }
      return createIssue(jiraBaseUrl, jiraToken, activeJiraProject, epicName, {
        issuetype: 'Epic',
        description: description || undefined,
        [epicNameFieldKey]: epicName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jira-epics-basic'] });
      setEpicName('');
      setDescription('');
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!epicName.trim()) return;
    mutation.mutate();
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-background rounded-lg shadow-lg p-6">
          <Dialog.Title className="text-lg font-semibold mb-4">Create Epic</Dialog.Title>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Epic Name *</span>
              <input
                aria-label="Epic Name"
                value={epicName}
                onChange={(e) => setEpicName(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="border rounded px-3 py-2 text-sm resize-y min-h-[80px]"
                placeholder="Optional description"
              />
            </label>
            <div className="flex justify-end gap-2 mt-2">
              <Dialog.Close
                render={
                  <button
                    type="button"
                    className="px-4 py-2 text-sm rounded border border-border hover:bg-muted"
                  >
                    Cancel
                  </button>
                }
              />
              <button
                type="submit"
                disabled={!epicName.trim() || mutation.isPending}
                className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Create Epic"
              >
                {mutation.isPending ? 'Creating...' : 'Create Epic'}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
