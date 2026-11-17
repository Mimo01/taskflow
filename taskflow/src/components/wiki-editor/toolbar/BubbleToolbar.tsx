import type { Editor } from '@tiptap/core';
import { type EditorState, PluginKey } from '@tiptap/pm/state';
import { useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Bold, Code, Italic, Link2, Palette, Strikethrough, Underline } from 'lucide-react';
import { useEffect, useRef } from 'react';
import {
  applyColour,
  applyLink,
  currentColour,
  currentLink,
  removeColour,
  removeLink,
} from '../inline-commands';
import { isAnySuggestionActive } from '../suggestion/create-suggestion';
import { ColourPopover } from './ColourPopover';
import { LinkPopover } from './LinkPopover';
import { ToolbarButton } from './ToolbarButton';
import { TOOLBAR_ITEMS, type ToolbarItemId } from './toolbar-config';

const ICON = 'size-4';
const BTN = 'size-6';
export const BUBBLE_KEY = new PluginKey('wikiBubble');

export interface BubbleToolbarProps {
  editor: Editor;
  linkOpen: boolean;
  onLinkOpenChange: (o: boolean) => void;
}

interface ShowProps {
  editor: Editor;
  state: EditorState;
  from: number;
  to: number;
}

/** True for a non-empty text selection in an editable rich editor, outside code blocks and suggestions. */
export function shouldShowBubble({ editor, state, from, to }: ShowProps): boolean {
  if (!editor.isEditable) return false;
  const sel = state.selection;
  if (sel.empty || from === to) return false;
  // NodeSelection has a `node`; only plain text ranges get the bubble.
  if ('node' in sel) return false;
  if (state.doc.textBetween(from, to).length === 0) return false;
  let inCode = false;
  state.doc.nodesBetween(from, to, (node) => {
    if (node.type.name === 'codeBlock') inCode = true;
    return !inCode;
  });
  if (inCode) return false;
  if (isAnySuggestionActive(state)) return false;
  return true;
}

function itemMeta(id: ToolbarItemId) {
  const meta = TOOLBAR_ITEMS.find((i) => i.id === id);
  return { label: meta?.label ?? id, keys: meta?.keys };
}

function Sep() {
  return <span aria-hidden="true" className="mx-0.5 h-5 w-px flex-none bg-border" />;
}

/** Floating selection toolbar for compact hosts. */
export function BubbleToolbar({ editor, linkOpen, onLinkOpenChange }: BubbleToolbarProps) {
  const visibleRef = useRef(false);

  const st = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      mono: e.isActive('mono'),
      colour: currentColour(e),
      link: currentLink(e),
    }),
  });

  // Esc hides the bubble first (selection kept) and never reaches an enclosing dialog (D-20).
  useEffect(() => {
    const dom = editor.view.dom;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !visibleRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      visibleRef.current = false;
      editor.view.dispatch(editor.state.tr.setMeta(BUBBLE_KEY, 'hide'));
    };
    dom.addEventListener('keydown', onKey, true);
    return () => dom.removeEventListener('keydown', onKey, true);
  }, [editor]);

  const chain = () => editor.chain().focus();
  const simple = (
    id: 'bold' | 'italic' | 'underline' | 'strike' | 'mono',
    icon: React.ReactNode,
    run: () => void,
  ) => {
    const { label, keys } = itemMeta(id);
    return (
      <ToolbarButton
        key={id}
        label={label}
        keys={keys}
        icon={icon}
        onClick={run}
        pressed={st[id]}
        className={BTN}
      />
    );
  };

  const linkTrigger = (
    <ToolbarButton
      label="Link"
      keys={['⌘', 'K']}
      icon={<Link2 className={ICON} />}
      onClick={() => {}}
      pressed={st.link !== null}
      className={BTN}
    />
  );
  const colourTrigger = (
    <ToolbarButton
      label="Text colour"
      icon={<Palette className={ICON} />}
      onClick={() => {}}
      className={BTN}
    />
  );

  return (
    <BubbleMenu
      editor={editor}
      pluginKey={BUBBLE_KEY}
      updateDelay={0}
      shouldShow={shouldShowBubble}
      appendTo={() => (editor.view.dom.closest('[role="dialog"]') as HTMLElement) ?? document.body}
      options={{
        placement: 'top',
        offset: 8,
        onShow: () => {
          visibleRef.current = true;
        },
        onHide: () => {
          visibleRef.current = false;
        },
      }}
    >
      <div
        role="toolbar"
        aria-label="Selection formatting"
        className="z-50 flex h-8 items-center gap-1 rounded-lg border bg-popover p-1 shadow-md"
      >
        {simple('bold', <Bold className={ICON} />, () => chain().toggleBold().run())}
        {simple('italic', <Italic className={ICON} />, () => chain().toggleItalic().run())}
        {simple('underline', <Underline className={ICON} />, () => chain().toggleUnderline().run())}
        {simple('strike', <Strikethrough className={ICON} />, () => chain().toggleStrike().run())}
        {simple('mono', <Code className={ICON} />, () => chain().toggleMark('mono').run())}
        <Sep />
        <LinkPopover
          open={linkOpen}
          onOpenChange={onLinkOpenChange}
          trigger={linkTrigger}
          currentUrl={st.link}
          onApply={(url) => {
            if (applyLink(editor, url)) onLinkOpenChange(false);
          }}
          onRemove={() => {
            removeLink(editor);
            onLinkOpenChange(false);
          }}
        />
        <Sep />
        <ColourPopover
          current={st.colour}
          onPick={(v) => applyColour(editor, v)}
          onRemove={() => removeColour(editor)}
          trigger={colourTrigger}
        />
      </div>
    </BubbleMenu>
  );
}
