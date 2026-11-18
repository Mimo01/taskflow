/**
 * Error text for a failed save whose edits were kept as a draft. Keeps the real server
 * message (missing field, permission, ...) and adds the draft note after it.
 */
export function withDraftNote(message: string | null | undefined): string {
  const msg = (message ?? '').trim().replace(/[.!]+$/, '');
  return msg
    ? `${msg}. Your text is kept as a draft.`
    : "Couldn't save your changes. Your text is kept as a draft, try again.";
}
