import { Extension } from '@tiptap/core';

/** Keys the editor binds itself (StarterKit/UndoRedo cover Mod-b/i/u/z/Shift-z/8/7). */
export const WIKI_KEYMAP_KEYS = [
  'Mod-Shift-x',
  'Mod-Shift-s',
  'Mod-e',
  'Mod-Shift-.',
  'Mod-Shift-,',
  'Mod-Shift-b',
] as const;

/**
 * Editor keymap. Mod-k (link) and Mod-Shift-m (mode toggle) are handled by the editor
 * frame so they work in both rich and source modes.
 */
export const WikiKeymap = Extension.create({
  name: 'wikiKeymap',
  priority: 200,
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-x': () => this.editor.commands.toggleStrike(),
      // StarterKit binds Mod-Shift-s to strike; wiki strike is Mod-Shift-x, swallow it.
      'Mod-Shift-s': () => true,
      'Mod-e': () => this.editor.commands.toggleMark('mono'),
      'Mod-Shift-.': () => this.editor.commands.toggleMark('sup'),
      'Mod->': () => this.editor.commands.toggleMark('sup'),
      'Mod-Shift-,': () => this.editor.commands.toggleMark('sub'),
      'Mod-<': () => this.editor.commands.toggleMark('sub'),
      'Mod-Shift-b': () => this.editor.commands.toggleBlockquote(),
    };
  },
});
