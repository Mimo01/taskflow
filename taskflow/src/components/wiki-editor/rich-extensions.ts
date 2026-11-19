import { ReactNodeViewRenderer } from '@tiptap/react';
import { WikiCaretRepaint } from './caret-repaint';
import { buildEditorExtensions } from './extensions';
import { WIKI_INPUT_EXTENSIONS } from './input-extensions';
import { WikiEmbedRemoval } from './media/embed-removal';
import { WikiUpload } from './media/upload-plugin';
import { AttachmentChip } from './nodeviews/AttachmentChip';
import { CodeBlockView } from './nodeviews/CodeBlockView';
import { EmoticonView } from './nodeviews/EmoticonView';
import { ImageView } from './nodeviews/ImageView';
import { MentionView } from './nodeviews/MentionView';
import { PanelView } from './nodeviews/PanelView';
import { RawBlockView } from './nodeviews/RawBlockView';
import { RawInlineChip } from './nodeviews/RawInlineChip';

/** Rich-view extension list with React node views. Module scope: never rebuilt per render. */
export const richExtensions = [
  ...buildEditorExtensions({
    panel: ReactNodeViewRenderer(PanelView),
    codeBlock: ReactNodeViewRenderer(CodeBlockView),
    rawBlock: ReactNodeViewRenderer(RawBlockView),
    rawInline: ReactNodeViewRenderer(RawInlineChip),
    mention: ReactNodeViewRenderer(MentionView, { as: 'span' }),
    image: ReactNodeViewRenderer(ImageView, { as: 'span' }),
    attachment: ReactNodeViewRenderer(AttachmentChip, { as: 'span' }),
    emoticon: ReactNodeViewRenderer(EmoticonView, { as: 'span' }),
  }),
  WikiUpload,
  WikiEmbedRemoval,
  WikiCaretRepaint,
  ...WIKI_INPUT_EXTENSIONS,
];
