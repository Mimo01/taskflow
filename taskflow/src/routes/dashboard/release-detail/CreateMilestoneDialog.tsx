/**
 * CreateMilestoneDialog — create-GitLab-milestone confirm dialog.
 *
 * Mirrors BoardResolutionDialog.tsx's structure (Dialog primitives, controlled
 * open/onOpenChange, showCloseButton={false}, the -mx-1 flex max-h-[45vh]
 * scroll container) but the reference list here is read-only (D-03) rather
 * than a clickable picker — the real input is the title field.
 *
 * Presentational only (D-21): no data fetching or credential/mutation hooks
 * of its own. The parent supplies the reference list from the already-cached
 * windowed query and owns the write.
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { extractVersionFromMilestoneTitle } from './releaseBranch';
import {
  buildMilestoneTitle,
  findDuplicateMilestone,
  formatMilestoneDueDate,
  isValidMilestoneTitle,
  type MilestoneLike,
  recentMilestonesByDate,
} from './releaseMilestone';

/** Reference-list entry: MilestoneLike plus an optional due_date so the list
 *  can be sorted newest-first (D-03). Real GitLabMilestone objects always
 *  carry due_date; this stays optional so the type degrades gracefully if a
 *  caller passes a bare MilestoneLike. */
export interface MilestoneReferenceItem extends MilestoneLike {
  due_date?: string | null;
}

interface CreateMilestoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  releaseDate: string | null;
  recentMilestones: MilestoneReferenceItem[];
  versionName: string;
  activeGitlabProject: number | null;
  onConfirm: (title: string) => void;
  isPending?: boolean;
  errorMessage?: string | null;
}

export function CreateMilestoneDialog({
  open,
  onOpenChange,
  releaseDate,
  recentMilestones,
  versionName,
  activeGitlabProject,
  onConfirm,
  isPending,
  errorMessage,
}: CreateMilestoneDialogProps) {
  const [title, setTitle] = useState('');

  // Reset (and re-prefill) whenever the dialog is (re)opened, the release
  // date changes, or the source version name changes — same identity-keyed
  // reset pattern as BoardResolutionDialog.
  // WR-01: passing an empty version into buildMilestoneTitle violates its
  // documented contract ("the bare version string") and produces a
  // leading-space title (" (21.07.2026)") that fails isValidMilestoneTitle,
  // so the dialog opened already invalid. Extract the bare X.Y.Z version from
  // the Jira version name instead (stripping an optional leading "v", since
  // Jira names are commonly v-prefixed while extractVersionFromMilestoneTitle's
  // contract is anchored to a leading digit) and only build a title when a
  // version was actually found.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset is intentionally keyed to open/releaseDate/versionName identity, not title.
  useEffect(() => {
    const bareVersionName = versionName.replace(/^v/i, '');
    setTitle(extractVersionFromMilestoneTitle(bareVersionName) ?? '');
  }, [open, releaseDate, versionName]);

  // The user types ONLY the version; the date half is appended from the Jira
  // release date. Hand-typing the date was the single largest source of
  // format-invalid titles, and the date is not the user's to choose — it is
  // whatever Jira says the release ships on.
  const composedTitle = buildMilestoneTitle(title, releaseDate) ?? '';
  const formatValid = isValidMilestoneTitle(composedTitle);
  const formattedDate = formatMilestoneDueDate(releaseDate);
  // WR-10: activeGitlabProject === null means the GitLab project isn't
  // configured. Previously the call site passed `?? 0`, which
  // ownProjectMilestones silently filters to an empty list whenever any
  // milestone carries a numeric project_id — disabling duplicate detection
  // for every title instead of blocking submit outright.
  const projectConfigured = activeGitlabProject !== null;
  // Check the COMPOSED title — that is what gets sent to GitLab, so checking
  // the bare version would compare against a string no milestone ever carries.
  const duplicate = projectConfigured
    ? findDuplicateMilestone(recentMilestones, composedTitle, activeGitlabProject)
    : null;

  // Render a capped, newest-first slice — but note `duplicate` above runs over
  // the FULL `recentMilestones` array. Slicing before the duplicate check would
  // silently narrow RELMS-04's guard to whatever happens to be displayed.
  const sortedRecentMilestones = recentMilestonesByDate(recentMilestones);

  function handleConfirm() {
    if (isPending || !formatValid || duplicate !== null || !projectConfigured) return;
    onConfirm(composedTitle);
  }

  // WR-03: inline dialog text is the ONLY error surface for this write
  // (D-15 forbids toasts), so dismissing mid-flight — via Cancel, Escape or
  // the backdrop — would report a subsequent 403/500 nowhere, and a
  // succeeded write would appear with no acknowledgement. Guard the single
  // choke point Dialog exposes for all three dismissal paths.
  function handleOpenChange(nextOpen: boolean, ...rest: unknown[]) {
    if (isPending) return;
    onOpenChange(nextOpen, ...(rest as []));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} className="max-h-[85vh] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create GitLab milestone</DialogTitle>
          <DialogDescription>
            Create a milestone for this release. Recent milestones are listed below for reference.
          </DialogDescription>
        </DialogHeader>

        {sortedRecentMilestones.length > 0 && (
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Recent milestones</p>
            <div className="-mx-1 flex max-h-[45vh] flex-col gap-0.5 overflow-y-auto px-1">
              {sortedRecentMilestones.map((m, idx) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: read-only reference rows have no stable id in this structural type
                  key={`${m.title}-${idx}`}
                  className="text-xs text-muted-foreground"
                >
                  <span>{m.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="create-milestone-title">Milestone version</Label>
          <div className="flex items-center gap-2">
            <Input
              id="create-milestone-title"
              className="font-mono"
              value={title}
              inputMode="numeric"
              placeholder="33.8.0"
              aria-describedby="create-milestone-preview"
              // Mask: accept only the characters a version is made of, so an
              // invalid title cannot be typed in the first place.
              onChange={(e) => setTitle(e.target.value.replace(/[^\d.]/g, ''))}
            />
            {formattedDate && (
              <span className="whitespace-nowrap font-mono text-muted-foreground text-sm">
                ({formattedDate})
              </span>
            )}
          </div>
          {formattedDate ? (
            <p id="create-milestone-preview" className="text-muted-foreground text-xs">
              Date comes from the Jira release date. Will create:{' '}
              <span className="font-mono">{composedTitle || '—'}</span>
            </p>
          ) : (
            <p id="create-milestone-preview" className="text-destructive text-xs">
              This version has no Jira release date, so the milestone title can't be built.
            </p>
          )}
          {!projectConfigured ? (
            <p className="text-xs text-destructive">GitLab project not configured</p>
          ) : duplicate !== null ? (
            <p className="text-xs text-destructive">
              A milestone named '{composedTitle}' already exists in this project.
            </p>
          ) : (
            formattedDate &&
            !formatValid && (
              <p className="text-xs text-destructive">Version must be X.Y.Z, e.g. 33.5.0</p>
            )
          )}
          {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>
            Cancel
          </DialogClose>
          <Button
            onClick={handleConfirm}
            disabled={isPending || !formatValid || duplicate !== null || !projectConfigured}
          >
            {isPending ? 'Creating…' : 'Create milestone'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
