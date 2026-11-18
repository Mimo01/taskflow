import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  ModalCancelButton,
  ModalField,
  ModalPrimaryButton,
  ModalShell,
} from '../create-edit-issue/ModalShell';

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
  const jiraMsg = jiraError ? `Couldn't update the Jira version: ${jiraError}. Try again.` : null;
  const gitlabMsg = gitlabError
    ? `Couldn't update the GitLab milestone: ${gitlabError}. Try again.`
    : null;
  const footerStatus =
    jiraMsg || gitlabMsg ? (
      <div className="flex min-w-0 flex-col">
        {jiraMsg && (
          <p className="min-w-0 truncate text-xs text-destructive" title={jiraMsg}>
            {jiraMsg}
          </p>
        )}
        {gitlabMsg && (
          <p className="min-w-0 truncate text-xs text-destructive" title={gitlabMsg}>
            {gitlabMsg}
          </p>
        )}
      </div>
    ) : null;

  return (
    <ModalShell
      open={open}
      onOpenChange={(o) => onOpenChange(o)}
      title="Edit release"
      onSubmitShortcut={() => {
        if (!isSaveDisabled) onSave();
      }}
      asideLabel="Release details"
      aside={
        <div className="flex flex-col gap-4">
          <ModalField htmlFor="release-date" label="Release date">
            <DatePicker
              id="release-date"
              value={editDate}
              onChange={setEditDate}
              disabled={isSaving}
            />
          </ModalField>
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="release-released"
              className="text-xs font-semibold text-muted-foreground"
            >
              Released
            </label>
            <Switch
              id="release-released"
              checked={editReleased}
              onCheckedChange={setEditReleased}
              disabled={isSaving}
              aria-label="Released"
            />
          </div>
        </div>
      }
      footerStatus={footerStatus}
      footerActions={
        <>
          <ModalCancelButton onClick={onCancel} disabled={isSaving} />
          <ModalPrimaryButton
            type="button"
            onClick={onSave}
            label="Save"
            pendingLabel="Saving…"
            pending={isSaving}
            disabled={isSaveDisabled}
          />
        </>
      }
    >
      <ModalField htmlFor="release-name" label="Name" required>
        <Input
          id="release-name"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          disabled={isSaving}
          required
          autoFocus
        />
      </ModalField>
      <ModalField htmlFor="release-description" label="Description" className="min-h-0 flex-1">
        <Textarea
          id="release-description"
          className="min-h-40 flex-1 resize-none field-sizing-fixed"
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          disabled={isSaving}
        />
      </ModalField>
      {showMilestoneSection && (
        <div className="flex flex-col gap-4 border-t pt-4">
          <h3 className="text-xs font-semibold text-muted-foreground">GitLab milestone</h3>
          <ModalField htmlFor="milestone-title" label="Title" required>
            <Input
              id="milestone-title"
              value={editMilestoneTitle}
              onChange={(e) => setEditMilestoneTitle(e.target.value)}
              disabled={isSaving}
              required
            />
          </ModalField>
          <ModalField htmlFor="milestone-description" label="Description">
            <Textarea
              id="milestone-description"
              className="min-h-24 resize-none field-sizing-fixed"
              value={editMilestoneDescription}
              onChange={(e) => setEditMilestoneDescription(e.target.value)}
              disabled={isSaving}
            />
          </ModalField>
        </div>
      )}
    </ModalShell>
  );
}
