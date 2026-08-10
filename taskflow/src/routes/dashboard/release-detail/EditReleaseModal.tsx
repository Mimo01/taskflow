import { Dialog } from '@base-ui/react/dialog';
import { Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface EditReleaseModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editName: string;
  setEditName: (v: string) => void;
  editDate: string;
  setEditDate: (v: string) => void;
  editDescription: string;
  setEditDescription: (v: string) => void;
  editReleased: boolean;
  setEditReleased: (v: boolean) => void;
  editMilestoneTitle: string;
  setEditMilestoneTitle: (v: string) => void;
  editMilestoneDescription: string;
  setEditMilestoneDescription: (v: string) => void;
  isSaving: boolean;
  jiraError: string | null;
  gitlabError: string | null;
  showMilestoneSection: boolean;
  isSaveDisabled: boolean;
  onCancel: () => void;
  onSave: () => void;
}

export function EditReleaseModal({
  open,
  onOpenChange,
  editName,
  setEditName,
  editDate,
  setEditDate,
  editDescription,
  setEditDescription,
  editReleased,
  setEditReleased,
  editMilestoneTitle,
  setEditMilestoneTitle,
  editMilestoneDescription,
  setEditMilestoneDescription,
  isSaving,
  jiraError,
  gitlabError,
  showMilestoneSection,
  isSaveDisabled,
  onCancel,
  onSave,
}: EditReleaseModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[680px] max-h-[85vh] overflow-y-auto bg-background border rounded-lg shadow-xl flex flex-col">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-lg font-semibold">Edit Release</h2>
            <Dialog.Close
              render={
                <button type="button" className="rounded p-1 hover:bg-accent" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              }
            />
          </div>

          <div className="flex flex-col gap-5 px-6 py-5">
            {/* Jira fields */}
            <div className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <label htmlFor="release-name" className="text-xs text-muted-foreground">
                  Name
                </label>
                <Input
                  id="release-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={isSaving}
                  required
                />
              </div>

              {/* Release Date */}
              <div className="space-y-1.5">
                <label htmlFor="release-date" className="text-xs text-muted-foreground">
                  Release Date
                </label>
                <Input
                  id="release-date"
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  disabled={isSaving}
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label htmlFor="release-description" className="text-xs text-muted-foreground">
                  Description
                </label>
                <Textarea
                  id="release-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  disabled={isSaving}
                  rows={4}
                />
              </div>

              {/* Released toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={editReleased}
                  onClick={() => setEditReleased(!editReleased)}
                  disabled={isSaving}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    editReleased ? 'bg-green-600' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`inline-block size-3.5 rounded-full bg-white transition-transform ${
                      editReleased ? 'translate-x-[18px]' : 'translate-x-[2px]'
                    }`}
                  />
                </button>
                <span className="text-sm">{editReleased ? 'Released' : 'Unreleased'}</span>
              </div>
            </div>

            {/* GitLab Milestone section — only when a milestone is matched */}
            {showMilestoneSection && (
              <div className="space-y-4 border-t pt-5">
                <h3 className="text-sm font-medium">GitLab Milestone</h3>

                {/* Milestone Title */}
                <div className="space-y-1.5">
                  <label htmlFor="milestone-title" className="text-xs text-muted-foreground">
                    Title
                  </label>
                  <Input
                    id="milestone-title"
                    value={editMilestoneTitle}
                    onChange={(e) => setEditMilestoneTitle(e.target.value)}
                    disabled={isSaving}
                    required
                  />
                </div>

                {/* Milestone Description */}
                <div className="space-y-1.5">
                  <label htmlFor="milestone-description" className="text-xs text-muted-foreground">
                    Description
                  </label>
                  <Textarea
                    id="milestone-description"
                    value={editMilestoneDescription}
                    onChange={(e) => setEditMilestoneDescription(e.target.value)}
                    disabled={isSaving}
                    rows={4}
                  />
                </div>
              </div>
            )}

            {/* Per-source errors (partial-failure handling) */}
            {jiraError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Jira: {jiraError}
              </div>
            )}
            {gitlabError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                GitLab: {gitlabError}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t px-6 py-4">
            <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button size="sm" onClick={onSave} disabled={isSaveDisabled} className="gap-1.5">
              {isSaving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  Save
                </>
              )}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
