import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { AlertCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getHost } from '../host';
import { dismissRemovalNotice, getRemovalNotice, type RemovalNotice } from './embed-removal';
import { clearUploadFailures, getUploadFailures } from './upload-plugin';

const MAX_LINES = 3;
const NOTICE_MS = 6000;

const ROW = 'flex h-6 items-center gap-2 border-t border-border px-2 text-xs';
const BTN = 'flex-none rounded px-2 py-0.5 text-xs hover:bg-accent';

interface Snapshot {
  failures: readonly string[];
  notice: RemovalNotice | null;
}

function same(a: Snapshot | null, b: Snapshot | null): boolean {
  if (!a || !b) return a === b;
  return (
    a.failures.join('\n') === b.failures.join('\n') &&
    a.notice?.filename === b.notice?.filename &&
    a.notice?.attachmentId === b.notice?.attachmentId
  );
}

/** Inline message area under the editor content: upload failures (D-06) and the D-10 notice. */
export function EditorMessages({ editor }: { editor: Editor }) {
  const snap = useEditorState({
    editor,
    selector: ({ editor: e }): Snapshot => ({
      failures: getUploadFailures(e.state),
      notice: getRemovalNotice(e.state),
    }),
    equalityFn: same,
  });
  const failures = snap?.failures ?? [];
  const notice = snap?.notice ?? null;
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const noticeKey = notice ? `${notice.filename}\n${notice.attachmentId}` : null;

  useEffect(() => {
    if (!noticeKey) return;
    const t = setTimeout(() => dismissRemovalNotice(editor), NOTICE_MS);
    return () => clearTimeout(t);
  }, [noticeKey, editor]);

  const onDelete = () => {
    if (!notice) return;
    const { filename, attachmentId } = notice;
    dismissRemovalNotice(editor);
    Promise.resolve(getHost(editor).deleteAttachment?.(attachmentId)).catch(() => {
      setDeleteError(`Couldn't delete ${filename}. Remove it from Attachments.`);
    });
  };

  if (failures.length === 0 && !notice && !deleteError) return null;

  const shown = failures.slice(0, MAX_LINES);
  const extra = failures.length - shown.length;
  return (
    <div role="status" aria-live="polite">
      {shown.map((name) => (
        <div key={name} className={`${ROW} text-destructive`}>
          <AlertCircle className="size-3 flex-none" aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            Couldn't upload {name}. Check your connection and try again.
          </span>
        </div>
      ))}
      {extra > 0 ? (
        <div className={`${ROW} text-destructive`}>
          <AlertCircle className="size-3 flex-none" aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            and {extra} more {extra === 1 ? 'file' : 'files'} failed to upload.
          </span>
        </div>
      ) : null}
      {failures.length > 0 ? (
        <div className={`${ROW} justify-end`}>
          <button type="button" className={BTN} onClick={() => clearUploadFailures(editor)}>
            Dismiss
          </button>
        </div>
      ) : null}
      {notice ? (
        <div className={`${ROW} text-muted-foreground`}>
          <span className="min-w-0 flex-1 truncate">Also delete attachment?</span>
          <button type="button" className={BTN} onClick={onDelete}>
            Delete
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            className={BTN}
            onClick={() => dismissRemovalNotice(editor)}
          >
            <X className="size-3" aria-hidden />
          </button>
        </div>
      ) : null}
      {deleteError ? (
        <div className={`${ROW} text-destructive`}>
          <AlertCircle className="size-3 flex-none" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{deleteError}</span>
          <button type="button" className={BTN} onClick={() => setDeleteError(null)}>
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}
