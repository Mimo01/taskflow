import { Bold, Code, Italic, List, Paperclip, X } from 'lucide-react';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { attachmentRef } from '@/lib/attachment-markup';
import type { JiraAttachment } from '@/services/jira';
import { formatFileSize } from './issue-detail/AttachmentFileRow';
import { AttachmentPickerModal } from './issue-detail/AttachmentPickerModal';
import { WikiRenderer } from './WikiRenderer';

interface DescriptionEditorProps {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  attachments?: JiraAttachment[];
  stagedFiles?: File[];
  onFileSelected?: (file: File) => void;
  onRemoveStagedFile?: (index: number) => void;
  uploadingName?: string | null;
  uploadError?: string | null;
}

export interface DescriptionEditorHandle {
  insertRef(ref: string): void;
}

function insertAtCursor(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  before: string,
  after: string,
  setValue: (v: string) => void,
  currentValue: string,
) {
  const el = textareaRef.current;
  if (!el) {
    // Target textarea isn't mounted (e.g. Preview tab active while an attach
    // action resolves) — append via state instead of silently dropping the
    // insertion (CR-01).
    setValue(currentValue ? `${currentValue}\n${before}${after}` : `${before}${after}`);
    return;
  }
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const newText =
    currentValue.slice(0, start) +
    before +
    currentValue.slice(start, end) +
    after +
    currentValue.slice(end);
  setValue(newText);
  requestAnimationFrame(() => {
    el.selectionStart = start + before.length;
    el.selectionEnd = end + before.length;
    el.focus();
  });
}

export const DescriptionEditor = forwardRef<DescriptionEditorHandle, DescriptionEditorProps>(
  function DescriptionEditor(
    {
      id,
      value,
      onChange,
      disabled,
      attachments = [],
      stagedFiles = [],
      onFileSelected,
      onRemoveStagedFile,
      uploadingName,
      uploadError,
    },
    ref,
  ) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);

    useImperativeHandle(ref, () => ({
      insertRef(refText: string) {
        insertAtCursor(textareaRef, refText, '', onChange, value);
      },
    }));

    const attachmentMap = Object.fromEntries(attachments.map((a) => [a.filename, a.content]));

    function handleAttachmentSelect(att: JiraAttachment) {
      insertAtCursor(textareaRef, attachmentRef(att), '', onChange, value);
    }

    function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
      const files = e.clipboardData.files;
      if (files && files.length > 0) {
        e.preventDefault();
        for (const file of Array.from(files)) onFileSelected?.(file);
      }
    }

    function handleDragOver(e: React.DragEvent<HTMLTextAreaElement>) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }

    function handleDrop(e: React.DragEvent<HTMLTextAreaElement>) {
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        for (const file of Array.from(files)) onFileSelected?.(file);
      }
    }

    return (
      <Tabs defaultValue="edit" className="w-full">
        <TabsList>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="edit">
          <div className="flex flex-col gap-1">
            {/* Formatting toolbar */}
            <div className="flex items-center gap-1 border-b pb-1">
              <button
                type="button"
                disabled={disabled}
                className="rounded p-1 hover:bg-accent disabled:opacity-50"
                title="Bold"
                onClick={() => insertAtCursor(textareaRef, '*', '*', onChange, value)}
              >
                <Bold className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={disabled}
                className="rounded p-1 hover:bg-accent disabled:opacity-50"
                title="Italic"
                onClick={() => insertAtCursor(textareaRef, '_', '_', onChange, value)}
              >
                <Italic className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={disabled}
                className="rounded p-1 hover:bg-accent disabled:opacity-50"
                title="Inline Code"
                onClick={() => insertAtCursor(textareaRef, '{code}', '{code}', onChange, value)}
              >
                <Code className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={disabled}
                className="rounded p-1 hover:bg-accent disabled:opacity-50"
                title="Bullet"
                onClick={() => insertAtCursor(textareaRef, '* ', '', onChange, value)}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={disabled}
                className="rounded p-1 hover:bg-accent disabled:opacity-50"
                title="Insert attachment"
                onClick={() => setPickerOpen(true)}
              >
                <Paperclip className="h-4 w-4" />
              </button>
            </div>

            <Textarea
              id={id}
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onPaste={handlePaste}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              disabled={disabled}
              placeholder="Describe the issue..."
              className="min-h-[120px] resize-y font-mono text-sm"
            />

            {stagedFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {stagedFiles.map((file, index) => {
                  // File objects have no stable unique id, so the index is part of the key.
                  const key = `${file.name}-${index}`;
                  return (
                    <div
                      key={key}
                      title="will upload on save"
                      className="flex items-center gap-1.5 rounded border border-dashed px-2 py-1 text-xs text-muted-foreground bg-muted/30"
                    >
                      <span className="truncate max-w-[160px]">{file.name}</span>
                      {file.size > 0 && (
                        <span className="shrink-0">{formatFileSize(file.size)}</span>
                      )}
                      <span className="shrink-0 italic">will upload on save</span>
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        className="shrink-0 rounded p-0.5 hover:bg-accent"
                        onClick={() => onRemoveStagedFile?.(index)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {uploadingName && (
              <p className="text-xs text-muted-foreground">{uploadingName} uploading…</p>
            )}
            {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
          </div>
        </TabsContent>

        <TabsContent value="preview">
          {value ? (
            <WikiRenderer wikiText={value} attachments={attachmentMap} className="min-h-[120px]" />
          ) : (
            <p className="min-h-[120px] text-sm text-muted-foreground">Nothing to preview</p>
          )}
        </TabsContent>

        <AttachmentPickerModal
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          attachments={attachments}
          onSelect={handleAttachmentSelect}
        />
      </Tabs>
    );
  },
);
