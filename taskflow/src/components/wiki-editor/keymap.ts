import { Extension } from '@tiptap/core';
import { moveToLineBoundary } from './caret-commands';

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
 * Cmd+Left/Right line-boundary keys (explicit Meta, not Mod: on Windows/Linux Ctrl+Arrow is a
 * word jump and must stay native). Kept apart from WIKI_KEYMAP_KEYS, which feeds the
 * app-shortcut conflict check.
 */
export const WIKI_CARET_KEYS = [
  'Meta-ArrowLeft',
  'Meta-ArrowRight',
  'Shift-Meta-ArrowLeft',
  'Shift-Meta-ArrowRight',
] as const;

/**
 * Editor keymap. Cmd+Left/Right (and Shift) move to the line boundary (caret-commands.ts). Mod-k (link) and Mod-Shift-m (mode toggle) are handled by the editor
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
      'Meta-ArrowLeft': () => moveToLineBoundary(this.editor.view, -1, false),
      'Meta-ArrowRight': () => moveToLineBoundary(this.editor.view, 1, false),
      'Shift-Meta-ArrowLeft': () => moveToLineBoundary(this.editor.view, -1, true),
      'Shift-Meta-ArrowRight': () => moveToLineBoundary(this.editor.view, 1, true),
    };
  },
});
