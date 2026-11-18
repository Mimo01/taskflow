import { Dialog } from '@base-ui/react/dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Paperclip } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Keycap } from '@/components/ui/keycap';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody } from '@/components/ui/tooltip-body';
import type { WikiEditorHandle, WikiEditorHost } from '@/components/wiki-editor/types';
import { WikiEditorLazy } from '@/components/wiki-editor/WikiEditorLazy';
import { uploadStagedFiles } from '@/lib/upload-staged-files';
import { createIssue } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { StagedFilesStrip } from './StagedFilesStrip';

export interface CreateEpicDialogProps {
  open: boolean;
  onClose: () => void;
  /** Draft to restore on open (Phase 101) */
  resumeDraftId?: string | null;
}

export function CreateEpicDialog({ open, onClose }: CreateEpicDialogProps) {
  const { epicNameFieldKey } = useSettingsStore();
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();

  const [epicName, setEpicName] = useState('');
  const [description, setDescription] = useState('');

  const editorRef = useRef<WikiEditorHandle>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [stagedUploadError, setStagedUploadError] = useState<string | null>(null);
  // Set when create succeeded but a staged upload failed: the dialog stays open with the
  // error visible and the button is disabled so the form can't create a duplicate epic.
  const [hasCreatedWithError, setHasCreatedWithError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStagedFiles([]);
    setStagedUploadError(null);
    setHasCreatedWithError(false);
  }, [open]);

  const host = useMemo<WikiEditorHost>(
    () => ({
      projectKey: activeJiraProject,
      staged: true,
      stageFile: (f) => setStagedFiles((p) => [...p, f]),
    }),
    [activeJiraProject],
  );

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const jiraToken = await readSecret('jira-pat').catch(() => null);
      if (!jiraBaseUrl || !jiraToken || !activeJiraProject || !epicNameFieldKey) {
        throw new Error('Not configured');
      }
      const newIssue = await createIssue(jiraBaseUrl, jiraToken, activeJiraProject, epicName, {
        issuetype: 'Epic',
        description: description || undefined,
        [epicNameFieldKey]: epicName,
      });
      const failed =
        stagedFiles.length > 0
          ? await uploadStagedFiles(jiraBaseUrl, jiraToken, newIssue.key, stagedFiles)
          : [];
      return { newIssue, failed };
    },
    onSuccess: ({ failed }) => {
      queryClient.invalidateQueries({ queryKey: ['jira-epics-basic'] });
      if (failed.length > 0) {
        setStagedUploadError(
          `Issue created, but ${failed.length} file(s) failed to upload: ${failed.join(', ')}`,
        );
        setStagedFiles([]);
        setHasCreatedWithError(true);
        return;
      }
      setEpicName('');
      setDescription('');
      setStagedFiles([]);
      onClose();
    },
  });

  const canSubmit = !!epicName.trim() && !mutation.isPending && !hasCreatedWithError;

  const trySubmit = () => {
    if (!canSubmit) {
      nameInputRef.current?.focus();
      return;
    }
    formRef.current?.requestSubmit();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
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
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
                e.preventDefault();
                trySubmit();
              }
            }}
            className="flex flex-col gap-4"
          >
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Epic Name *</span>
              <input
                ref={nameInputRef}
                aria-label="Epic Name"
                value={epicName}
                onChange={(e) => setEpicName(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
                required
              />
            </label>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span id="create-epic-description-label" className="text-sm font-medium">
                  Description
                </span>
                <button
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  <Paperclip className="h-3 w-3" />
                  Attach file
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  data-testid="create-epic-file-input"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length > 0) editorRef.current?.insertFiles(files);
                    e.target.value = '';
                  }}
                />
              </div>
              <WikiEditorLazy
                ref={editorRef}
                value={description}
                onChange={setDescription}
                preset="full"
                placeholder="Optional description"
                aria-label="Description"
                host={host}
                onSubmit={(text) => {
                  flushSync(() => setDescription(text));
                  trySubmit();
                }}
              />
              <StagedFilesStrip
                files={stagedFiles}
                onRemove={(i) => setStagedFiles((p) => p.filter((_, idx) => idx !== i))}
                disabled={mutation.isPending}
              />
              {stagedUploadError && (
                <p role="alert" className="text-xs text-destructive">
                  {stagedUploadError}
                </p>
              )}
            </div>
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
              <Tooltip>
                <TooltipTrigger
                  delay={300}
                  render={
                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Create Epic"
                    />
                  }
                >
                  {mutation.isPending ? 'Creating...' : 'Create Epic'}
                </TooltipTrigger>
                <TooltipContent>
                  <TooltipBody>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Create Epic</span>
                      <span className="flex items-center gap-1">
                        <Keycap>⌘</Keycap>
                        <Keycap>↵</Keycap>
                      </span>
                    </div>
                  </TooltipBody>
                </TooltipContent>
              </Tooltip>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
