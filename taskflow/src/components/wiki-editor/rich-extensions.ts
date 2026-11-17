import { ReactNodeViewRenderer } from '@tiptap/react';
import { buildEditorExtensions } from './extensions';
import { CodeBlockView } from './nodeviews/CodeBlockView';
import { PanelView } from './nodeviews/PanelView';
import { RawBlockView } from './nodeviews/RawBlockView';
import { RawInlineChip } from './nodeviews/RawInlineChip';

/** Rich-view extension list with React node views. Module scope: never rebuilt per render. */
export const richExtensions = buildEditorExtensions({
  panel: ReactNodeViewRenderer(PanelView),
  codeBlock: ReactNodeViewRenderer(CodeBlockView),
  rawBlock: ReactNodeViewRenderer(RawBlockView),
  rawInline: ReactNodeViewRenderer(RawInlineChip),
});
