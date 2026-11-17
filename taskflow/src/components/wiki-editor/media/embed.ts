import type { Editor, JSONContent } from '@tiptap/core';
import { isImageAttachment } from '@/lib/attachment-markup';
import type { JiraAttachment } from '@/services/jira';
import { classifyFile } from './upload-state';

const HAZARD = /[!|\]]/;
const HAZARD_G = /[!|\]]/g;

type EmbedAtt = Pick<JiraAttachment, 'filename' | 'mimeType' | 'content'>;

/** Mirrors attachmentRef: hazardous names fall back to the content URL. */
export function embedContentFor(att: EmbedAtt): JSONContent {
  const hazardous = HAZARD.test(att.filename);
  const image =
    isImageAttachment(att) || classifyFile({ name: att.filename, type: att.mimeType }) === 'image';
  if (image) {
    return {
      type: 'image',
      attrs: { name: hazardous ? att.content : att.filename, params: null, src: null },
    };
  }
  if (hazardous) {
    return {
      type: 'text',
      text: att.filename.replace(HAZARD_G, ''),
      marks: [{ type: 'link', attrs: { href: att.content } }],
    };
  }
  return { type: 'attachment', attrs: { name: att.filename, label: null, src: null } };
}

export function insertEmbed(editor: Editor, att: EmbedAtt): boolean {
  return editor.chain().focus().insertContent(embedContentFor(att)).run();
}
