import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetch } from '@tauri-apps/plugin-http';
import { Paperclip } from 'lucide-react';
import { useRef, useState } from 'react';
import { assertOk, openSavedFile, saveBytes } from '@/lib/save-attachment';
import { cn } from '@/lib/utils';
import type { JiraAttachment } from '@/services/jira';
import { uploadAttachment } from '@/services/jira/attachments';
import { readSecret } from '@/services/stronghold';
import { AttachmentPreviewModal } from './AttachmentPreviewModal';
import { AttachmentTile } from './AttachmentTile';
import { AttachmentUpload } from './AttachmentUpload';
import { previewUnavailableReason, resolvePreviewKind } from './resolvePreviewKind';
import { SectionHeader } from './SectionHeader';

interface AttachmentsSectionProps {
  attachments: JiraAttachment[];
  issueKey: string;
  jiraBaseUrl: string;
  onDelete?: (attachment: JiraAttachment) => unknown;
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
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const previewKinds = new Map(attachments.map((a) => [a.id, resolvePreviewKind(a)]));
  const unavailable = new Map(
    attachments.map((a) => [a.id, previewUnavailableReason(a, previewKinds.get(a.id))]),
  );
  const previewable = attachments.filter((a) => unavailable.get(a.id) == null);

  // Single upload mutation shared by drag-drop and the browse strip
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No Jira credentials');
      return uploadAttachment(jiraBaseUrl, token, issueKey, file);
    },
    onSuccess: () => {
      setUploadName(null);
      setUploadError(null);
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
    },
    onError: () => {
      const fname = uploadName ?? 'file';
      setUploadError(`Failed to upload ${fname}. Check file size and try again.`);
      setUploadName(null);
    },
  });

  async function fetchAndSave(att: JiraAttachment): Promise<string | null> {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token) return null;
    const resp = await fetch(att.content, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const arrayBuffer = await assertOk(resp).arrayBuffer();
    return saveBytes(new Uint8Array(arrayBuffer), att.filename);
  }

  // Tile Download: the tile button shows busy/✓/✕ and floats this short confirmation.
  async function handleTileDownload(att: JiraAttachment): Promise<string> {
    await handlePreviewDownload(att);
    return 'Saved to Downloads';
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
    // The strip lives inside the section: ignore leaves into child elements.
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging(false);
  }

  function startUpload(file: File) {
    setUploadError(null);
    setUploadName(file.name);
    uploadMutation.mutate(file);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) startUpload(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) startUpload(file);
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

      {/* Drop upload progress */}
      {uploadName && uploadMutation.isPending && (
        <div className="mb-2">
          <p className="text-xs text-muted-foreground">{uploadName} uploading...</p>
          <div className="h-1 w-full bg-muted rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-primary rounded-full animate-pulse"
              style={{ width: '60%' }}
            />
          </div>
        </div>
      )}

      {/* Drop upload error */}
      {uploadError && <p className="text-xs text-destructive mb-2">{uploadError}</p>}

      {/* Always open: a collapse toggle here only added visual noise (UAT 261112-f4u). */}
      <div className="space-y-3 density-compact:space-y-2 density-comfortable:space-y-4">
        {attachments.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-x-3 gap-y-3 density-compact:gap-y-2 density-comfortable:gap-y-4">
            {attachments.map((att) => (
              <AttachmentTile
                key={att.id}
                attachment={att}
                isImage={previewKinds.get(att.id) === 'image'}
                onDownload={handleTileDownload}
                onDelete={onDelete}
                previewUnavailable={unavailable.get(att.id) ?? undefined}
                onPreview={unavailable.get(att.id) == null ? openPreview : undefined}
              />
            ))}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          tabIndex={-1}
          data-testid="attachment-file-input"
          onChange={handleFileSelect}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 density-compact:py-2 density-comfortable:py-3 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60',
            isDragging && 'border-primary/50 bg-primary/5 text-foreground',
          )}
        >
          <Paperclip className="size-3.5 shrink-0" aria-hidden="true" />
          {isDragging ? (
            <span className="min-w-0">Drop file to attach</span>
          ) : (
            <>
              {attachments.length === 0 && (
                <span className="font-medium text-foreground/80">No attachments</span>
              )}
              <span className="min-w-0">
                Drop files here or <span className="underline underline-offset-2">browse</span>
              </span>
            </>
          )}
        </button>
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
