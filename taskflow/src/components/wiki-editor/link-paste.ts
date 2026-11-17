import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { isSafeLinkUrl } from './link-url';

/** Pasting a single safe URL over a non-empty selection links the selection (EDIT-06). */
export const WikiLinkPaste = Extension.create({
  name: 'wikiLinkPaste',
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey('wikiLinkPaste'),
        props: {
          handlePaste: (view, event) => {
            if (view.state.selection.empty) return false;
            const text = event.clipboardData?.getData('text/plain')?.trim() ?? '';
            if (!isSafeLinkUrl(text)) return false;
            return editor.chain().setLink({ href: text }).run();
          },
        },
      }),
    ];
  },
});
