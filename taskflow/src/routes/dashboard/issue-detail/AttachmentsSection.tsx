import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetch } from '@tauri-apps/plugin-http';
import { useRef, useState } from 'react';
import { assertOk, openSavedFile, saveBytes } from '@/lib/save-attachment';
import type { JiraAttachment } from '@/services/jira';
import { uploadAttachment } from '@/services/jira/attachments';
import { readSecret } from '@/services/stronghold';
import { AttachmentPreviewModal } from './AttachmentPreviewModal';
import { AttachmentTile } from './AttachmentTile';
import { AttachmentUpload } from './AttachmentUpload';
import { resolvePreviewKind } from './resolvePreviewKind';
import { SectionHeader } from './SectionHeader';

interface AttachmentsSectionProps {
  attachments: JiraAttachment[];
  issueKey: string;
  jiraBaseUrl: string;
  onDelete?: (attachment: JiraAttachment) => void;
}

export function AttachmentsSection({
  attachments,
  issueKey,
  jiraBaseUrl,
  onDelete,
}: AttachmentsSectionProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dropUploadName, setDropUploadName] = useState<string | null>(null);
  const [dropUploadError, setDropUploadError] = useState<string | null>(null);
  const [downloadFeedback, setDownloadFeedback] = useState<{
    message: string;
    isError: boolean;
  } | null>(null);
  const downloadFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const previewKinds = new Map(attachments.map((a) => [a.id, resolvePreviewKind(a)]));
  const previewable = attachments.filter((a) => previewKinds.get(a.id) !== 'other');

  // Mutation for drag-drop uploads
  const dropMutation = useMutation({
    mutationFn: async (file: File) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No Jira credentials');
      return uploadAttachment(jiraBaseUrl, token, issueKey, file);
    },
    onSuccess: () => {
      setDropUploadName(null);
      setDropUploadError(null);
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
    },
    onError: () => {
      const fname = dropUploadName ?? 'file';
      setDropUploadError(`Failed to upload ${fname}. Check file size and try again.`);
      setDropUploadName(null);
    },
  });

  function showDownloadFeedback(message: string, isError: boolean) {
    if (downloadFeedbackTimer.current) clearTimeout(downloadFeedbackTimer.current);
    setDownloadFeedback({ message, isError });
    downloadFeedbackTimer.current = setTimeout(() => setDownloadFeedback(null), 3000);
  }

  async function fetchAndSave(att: JiraAttachment): Promise<string | null> {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token) return null;
    const resp = await fetch(att.content, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const arrayBuffer = await assertOk(resp).arrayBuffer();
    return saveBytes(new Uint8Array(arrayBuffer), att.filename);
  }

  // Save only — launching is the explicit "Open externally" action.
  async function handleDownload(att: JiraAttachment) {
    try {
      const savedPath = await fetchAndSave(att);
      if (!savedPath) {
        showDownloadFeedback('No Jira credentials found.', true);
        return;
      }
      showDownloadFeedback(`${att.filename} saved to Downloads.`, false);
    } catch {
      showDownloadFeedback(`Failed to download ${att.filename}.`, true);
    }
  }

  // Preview-toolbar Download: the toolbar shows busy/✓/✕ on the button, so this
  // throws on failure and resolves to the confirmation it floats above the pill.
  async function handlePreviewDownload(att: JiraAttachment): Promise<string> {
    let savedPath: string | null;
    try {
      savedPath = await fetchAndSave(att);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`Couldn't download ${att.filename}: ${reason}`);
    }
    if (!savedPath) throw new Error('No Jira credentials found.');
    return `${att.filename} saved to Downloads.`;
  }

  // Throws a readable Error so the preview modal can show it.
  async function handleOpenExternal(att: JiraAttachment): Promise<'opened' | 'revealed'> {
    try {
      const savedPath = await fetchAndSave(att);
      if (!savedPath) throw new Error('No Jira credentials found.');
      return await openSavedFile(savedPath);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`Couldn't open ${att.filename}: ${reason}`);
    }
  }

  function openPreview(att: JiraAttachment) {
    const index = previewable.indexOf(att);
    if (index === -1) return;
    setPreviewIndex(index);
    setPreviewOpen(true);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setDropUploadError(null);
      setDropUploadName(file.name);
      dropMutation.mutate(file);
    }
  }

  return (
    <section
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      aria-label="Drag and drop files to attach"
    >
      {/* Section header */}
      <SectionHeader
        title="Attachments"
        count={attachments.length}
        actions={<AttachmentUpload issueKey={issueKey} jiraBaseUrl={jiraBaseUrl} />}
      />

      {/* Drag overlay */}
      {isDragging && (
        <div className="border-2 border-dashed border-primary/50 rounded-lg p-6 text-center text-sm text-muted-foreground bg-primary/5 mb-2">
          Drop file here to attach
        </div>
      )}

      {/* Drop upload progress */}
      {dropUploadName && dropMutation.isPending && (
        <div className="mb-2">
          <p className="text-xs text-muted-foreground">{dropUploadName} uploading...</p>
          <div className="h-1 w-full bg-muted rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-primary rounded-full animate-pulse"
              style={{ width: '60%' }}
            />
          </div>
        </div>
      )}

      {/* Drop upload error */}
      {dropUploadError && <p className="text-xs text-destructive mb-2">{dropUploadError}</p>}

      {/* Always open: a collapse toggle here only added visual noise (UAT 261112-f4u). */}
      <div className="space-y-3 density-compact:space-y-2 density-comfortable:space-y-4">
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No attachments</p>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-x-3 gap-y-3 density-compact:gap-y-2 density-comfortable:gap-y-4">
              {attachments.map((att) => (
                <AttachmentTile
                  key={att.id}
                  attachment={att}
                  isImage={previewKinds.get(att.id) === 'image'}
                  onDownload={handleDownload}
                  onDelete={onDelete}
                  onPreview={previewKinds.get(att.id) !== 'other' ? openPreview : undefined}
                />
              ))}
            </div>
            {downloadFeedback && (
              <p
                className={`text-xs ${downloadFeedback.isError ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                {downloadFeedback.message}
              </p>
            )}
          </>
        )}
      </div>

      {/* Preview modal */}
      <AttachmentPreviewModal
        items={previewable}
        currentIndex={previewIndex}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onNavigate={setPreviewIndex}
        onDownload={handlePreviewDownload}
        onOpenExternal={handleOpenExternal}
      />
    </section>
  );
}
