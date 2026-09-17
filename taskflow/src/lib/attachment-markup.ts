/**
 * Jira wiki markup helper for referencing an issue's attachments from comment
 * (or, in future, description) text.
 *
 * Pure string logic — no React imports — so it stays unit-testable in isolation
 * and shareable between the comment composer and the attachment picker.
 */

import type { JiraAttachment } from '@/services/jira';

/** Same image predicate already used at AttachmentsSection.tsx:42 — kept in sync deliberately. */
export function isImageAttachment(att: Pick<JiraAttachment, 'mimeType'>): boolean {
  return (att.mimeType ?? '').startsWith('image/');
}

/** Characters that would break out of the `!...!` / `[^...]` wiki-markup regexes. */
const HAZARDOUS_FILENAME_CHARS = /[!|\]]/;
/** Same char class, `g`-flagged, for stripping every occurrence (not just the first). */
const HAZARDOUS_FILENAME_CHARS_GLOBAL = /[!|\]]/g;

/**
 * Build the Jira wiki markup string that references an attachment.
 *
 * - Image attachments → `!filename.png!` (resolved inline as `<img>` by
 *   WikiRenderer's preprocessJiraMarkup).
 * - Non-image attachments → `[^report.pdf]` (resolved as a file chip anchor).
 * - Filenames containing `!`, `|`, or `]` cannot safely appear inside those
 *   markup delimiters (they would prematurely close the regex match), so they
 *   fall back to the resolved-URL form instead:
 *     - image → `!<content-url>!`
 *     - non-image → `[<sanitized filename>|<content-url>]`
 *   (sanitized = hazard characters stripped from the display filename)
 */
export function attachmentRef(att: JiraAttachment): string {
  const hazardous = HAZARDOUS_FILENAME_CHARS.test(att.filename);
  if (isImageAttachment(att)) {
    return hazardous ? `!${att.content}!` : `!${att.filename}!`;
  }
  if (hazardous) {
    const sanitized = att.filename.replace(HAZARDOUS_FILENAME_CHARS_GLOBAL, '');
    return `[${sanitized}|${att.content}]`;
  }
  return `[^${att.filename}]`;
}

/**
 * Build a wiki markup reference for a file that has not been uploaded yet
 * (create-mode staging, before an issue key exists). Unlike `attachmentRef`,
 * there is no `content` URL to fall back to for hazardous filenames, so a
 * hazardous filename's hazard characters (`!`, `|`, `]`) are globally
 * stripped from the filename before it is embedded in the markup delimiters.
 *
 * KNOWN DIVERGENCE (accepted edge case, not an oversight): for a hazardous
 * filename, this staged ref can differ from what `attachmentRef` would later
 * produce for the same file post-upload — `attachmentRef` falls back to the
 * resolved content URL (Jira preserves the original filename server-side),
 * while this function can only sanitize the display filename since no URL
 * exists pre-upload. Non-hazardous filenames produce identical output either
 * way.
 */
export function stagedAttachmentRef(file: Pick<File, 'name' | 'type'>): string {
  const hazardous = HAZARDOUS_FILENAME_CHARS.test(file.name);
  const safeName = hazardous ? file.name.replace(HAZARDOUS_FILENAME_CHARS_GLOBAL, '') : file.name;
  const isImage = (file.type ?? '').startsWith('image/');
  return isImage ? `!${safeName}!` : `[^${safeName}]`;
}
