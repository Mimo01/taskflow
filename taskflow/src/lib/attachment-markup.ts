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
