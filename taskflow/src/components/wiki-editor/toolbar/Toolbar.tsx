import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
  Bold,
  Code,
  Italic,
  Link2,
  List,
  ListOrdered,
  Palette,
  PanelRight,
  Quote,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
} from 'lucide-react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  applyColour,
  applyLink,
  currentColour,
  currentLink,
  removeColour,
  removeLink,
} from '../inline-commands';
import { INSERT_ITEMS, type InsertItem } from '../insert-items';
import { normalizeLinkUrl } from '../link-url';
import { TEXT_PALETTE } from '../palette';
import type { SourceHandle } from '../source/SourceView';
import { applyTextStyle, currentTextStyle } from '../text-style';
import { ColourPopover } from './ColourPopover';
import { InsertMenu } from './InsertMenu';
import { LinkPopover } from './LinkPopover';
import { ModeToggle } from './ModeToggle';
import { type OverflowItem, OverflowMenu } from './OverflowMenu';
import { TextStyleMenu } from './TextStyleMenu';
import { ToolbarButton } from './ToolbarButton';
import {
  splitToolbar,
  TOOLBAR_ITEMS,
  type ToolbarItemId,
  type ToolbarPreset,
} from './toolbar-config';

export interface ToolbarProps {
  editor: Editor;
  preset: ToolbarPreset;
  mode: 'rich' | 'source';
  richDisabled: boolean;
  onModeChange: (m: 'rich' | 'source') => void;
  previewVisible: boolean;
  onPreviewToggle: () => void;
  linkOpen: boolean;
  onLinkOpenChange: (o: boolean) => void;
  source: React.RefObject<SourceHandle | null>;
}

interface ItemsRoom {
  /** Width the items region could take with neither the More block nor the Insert label. */
  px: number;
  /** Measured Text style trigger width (0 when absent). */
  textStylePx: number;
}

const widthOf = (el: Element | null | undefined) => el?.getBoundingClientRect().width ?? 0;

/**
 * Measures the real room for the shrinkable items. The items region (min-w-0, shrinks) plus the
 * flex-1 spacer is exactly the toolbar width left after every pinned control, padding and gap,
 * so pinned widths are never guessed. The More block and Insert label are added back so the
 * result does not depend on whether they are showing, which keeps the split from oscillating.
 * Null until the toolbar has a width (jsdom, hidden): then nothing overflows.
 */
function useItemsRoom(barRef: React.RefObject<HTMLElement | null>): ItemsRoom | null {
  const [room, setRoom] = useState<ItemsRoom | null>(null);
  const measure = useCallback(() => {
    const bar = barRef.current;
    if (!bar || widthOf(bar) <= 0) return;
    const items = bar.querySelector('[data-toolbar-items]');
    const spacer = bar.querySelector('[data-toolbar-spacer]');
    const more = widthOf(bar.querySelector('[data-toolbar-more]'));
    const label = widthOf(bar.querySelector('[data-insert-label]'));
    const gap = 4;
    const px = Math.floor(
      widthOf(items) +
        widthOf(spacer) +
        (more > 0 ? more + gap : 0) +
        (label > 0 ? label + gap : 0),
    );
    const textStylePx = Math.ceil(widthOf(items?.querySelector('[aria-label="Text style"]')));
    setRoom((prev) =>
      prev && prev.px === px && prev.textStylePx === textStylePx ? prev : { px, textStylePx },
    );
  }, [barRef]);

  // Every commit can change what is shown; re-measure before paint (no-op when unchanged).
  useLayoutEffect(measure);

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(bar);
    for (const sel of ['[data-toolbar-items]', '[data-toolbar-spacer]']) {
      const el = bar.querySelector(sel);
      if (el) ro.observe(el);
    }
    return () => ro.disconnect();
  }, [barRef, measure]);

  return room;
}

const ICON = 'size-4';
const SOURCE_WRAP: Record<string, [string, string?]> = {
  bold: ['*', '*'],
  italic: ['_', '_'],
  underline: ['+', '+'],
  strike: ['-', '-'],
  mono: ['{{', '}}'],
  sup: ['^', '^'],
  sub: ['~', '~'],
  bullet: ['* '],
  numbered: ['# '],
  quote: ['bq. '],
};

function Divider() {
  return <span aria-hidden="true" className="mx-1 h-5 w-px flex-none bg-border" />;
}

function itemMeta(id: ToolbarItemId) {
  const meta = TOOLBAR_ITEMS.find((i) => i.id === id);
  return { label: meta?.label ?? id, keys: meta?.keys };
}

export function Toolbar({
  editor,
  preset,
  mode,
  richDisabled,
  onModeChange,
  previewVisible,
  onPreviewToggle,
  linkOpen,
  onLinkOpenChange,
  source,
}: ToolbarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const room = useItemsRoom(barRef);
  const { overflow, showInsertLabel } =
    room === null
      ? { overflow: [] as ToolbarItemId[], showInsertLabel: false }
      : splitToolbar(preset, room.px, { textStylePx: room.textStylePx });
  const isRich = mode === 'rich';

  const st = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      mono: e.isActive('mono'),
      sup: e.isActive('sup'),
      sub: e.isActive('sub'),
      bullet: e.isActive('bulletList'),
      numbered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      textStyle: currentTextStyle(e),
      colour: currentColour(e),
      link: currentLink(e),
    }),
  });

  const pressedOf = (key: keyof typeof SOURCE_WRAP): boolean | undefined =>
    isRich ? (st[key as keyof typeof st] as boolean) : undefined;

  const act = (key: string, rich: () => void) => () => {
    if (isRich) {
      rich();
      return;
    }
    const wrap = SOURCE_WRAP[key];
    if (wrap) source.current?.insert(wrap[0], wrap[1]);
  };
  const chain = () => editor.chain().focus();
  const richActions: Record<string, () => void> = {
    bold: () => chain().toggleBold().run(),
    italic: () => chain().toggleItalic().run(),
    underline: () => chain().toggleUnderline().run(),
    strike: () => chain().toggleStrike().run(),
    mono: () => chain().toggleMark('mono').run(),
    sup: () => chain().toggleMark('sup').run(),
    sub: () => chain().toggleMark('sub').run(),
    bullet: () => chain().toggleBulletList().run(),
    numbered: () => chain().toggleOrderedList().run(),
    quote: () => chain().toggleBlockquote().run(),
  };
  const run = (key: string) => act(key, richActions[key] as () => void);

  const insert = (item: InsertItem, opts?: { rows: number; cols: number }) => {
    if (isRich) item.run(editor, opts);
    else source.current?.insert(item.source.before, item.source.after);
  };

  const applyLinkUrl = (url: string) => {
    if (isRich) {
      if (applyLink(editor, url)) onLinkOpenChange(false);
      return;
    }
    const href = normalizeLinkUrl(url);
    if (!href) return;
    source.current?.insert('[', `|${href}]`);
    onLinkOpenChange(false);
  };
  const removeLinkUrl = () => {
    if (isRich) removeLink(editor);
    onLinkOpenChange(false);
  };

  const simple = (
    id: 'bold' | 'italic' | 'underline' | 'strike' | 'mono' | 'bullet' | 'numbered' | 'quote',
    icon: React.ReactNode,
  ) => {
    const { label, keys } = itemMeta(id);
    return {
      id,
      label,
      keys,
      icon,
      onClick: run(id),
      pressed: pressedOf(id),
    };
  };
  const SIMPLE = {
    bold: simple('bold', <Bold className={ICON} />),
    italic: simple('italic', <Italic className={ICON} />),
    underline: simple('underline', <Underline className={ICON} />),
    strike: simple('strike', <Strikethrough className={ICON} />),
    mono: simple('mono', <Code className={ICON} />),
    bullet: simple('bullet', <List className={ICON} />),
    numbered: simple('numbered', <ListOrdered className={ICON} />),
    quote: simple('quote', <Quote className={ICON} />),
  };

  const show = (id: ToolbarItemId) =>
    TOOLBAR_ITEMS.some((i) => i.id === id && i.presets.includes(preset)) && !overflow.includes(id);

  const renderSimple = (id: keyof typeof SIMPLE) => {
    const b = SIMPLE[id];
    return (
      <ToolbarButton
        key={id}
        label={b.label}
        keys={b.keys}
        icon={b.icon}
        onClick={b.onClick}
        pressed={b.pressed}
      />
    );
  };

  const colourTrigger = (
    <ToolbarButton label="Text colour" icon={<Palette className={ICON} />} onClick={() => {}} />
  );
  const linkTrigger = (
    <ToolbarButton
      label="Link"
      keys={['⌘', 'K']}
      icon={<Link2 className={ICON} />}
      onClick={() => {}}
      pressed={isRich ? st.link !== null : undefined}
    />
  );

  const overflowItems: OverflowItem[] = overflow.flatMap((id): OverflowItem[] => {
    if (id === 'subsup') {
      return [
        {
          id: 'sup',
          label: 'Superscript',
          icon: <Superscript className={ICON} />,
          pressed: pressedOf('sup'),
          onSelect: run('sup'),
        },
        {
          id: 'sub',
          label: 'Subscript',
          icon: <Subscript className={ICON} />,
          pressed: pressedOf('sub'),
          onSelect: run('sub'),
        },
      ];
    }
    if (id === 'colour') {
      if (!isRich) return [];
      return [
        {
          id,
          label: 'Text colour',
          icon: <Palette className={ICON} />,
          onSelect: () => {},
          submenu: (
            <div className="grid grid-cols-8 gap-1 p-2">
              {TEXT_PALETTE.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  aria-label={p.name}
                  title={p.name}
                  style={{ backgroundColor: p.value }}
                  onClick={() => applyColour(editor, p.value)}
                  className="size-5 rounded border border-border"
                />
              ))}
              <button
                type="button"
                className="col-span-8 mt-1 text-left text-xs text-muted-foreground"
                onClick={() => removeColour(editor)}
              >
                Remove colour
              </button>
            </div>
          ),
        },
      ];
    }
    if (id === 'link') {
      return [
        {
          id,
          label: 'Link',
          icon: <Link2 className={ICON} />,
          pressed: isRich ? st.link !== null : undefined,
          onSelect: () => onLinkOpenChange(true),
        },
      ];
    }
    if (id in SIMPLE) {
      const b = SIMPLE[id as keyof typeof SIMPLE];
      return [{ id, label: b.label, icon: b.icon, pressed: b.pressed, onSelect: b.onClick }];
    }
    return [];
  });

  const linkOverflowed = overflow.includes('link');
  const showLink = preset === 'full' || preset === 'compact';
  const listGroupVisible =
    show('bullet') || show('numbered') || show('quote') || (showLink && !linkOverflowed);

  return (
    <div
      ref={barRef}
      role="toolbar"
      aria-label="Formatting"
      className="sticky top-0 z-10 flex h-10 rounded-t-[calc(var(--radius-lg)-1px)] flex-nowrap items-center gap-1 border-b border-border bg-[color-mix(in_oklab,var(--color-muted)_40%,var(--color-background))] px-2"
    >
      <div data-toolbar-items className="flex min-w-0 shrink items-center gap-1 overflow-hidden">
        {isRich && show('text-style') ? (
          <>
            <TextStyleMenu current={st.textStyle} onSelect={(id) => applyTextStyle(editor, id)} />
            <Divider />
          </>
        ) : null}
        {show('bold') ? renderSimple('bold') : null}
        {show('italic') ? renderSimple('italic') : null}
        {show('underline') ? renderSimple('underline') : null}
        {show('strike') ? renderSimple('strike') : null}
        {show('mono') ? renderSimple('mono') : null}
        {show('subsup') ? (
          <>
            <ToolbarButton
              label="Superscript"
              keys={['⌘', '⇧', '.']}
              icon={<Superscript className={ICON} />}
              onClick={run('sup')}
              pressed={pressedOf('sup')}
            />
            <ToolbarButton
              label="Subscript"
              keys={['⌘', '⇧', ',']}
              icon={<Subscript className={ICON} />}
              onClick={run('sub')}
              pressed={pressedOf('sub')}
            />
          </>
        ) : null}
        {isRich && show('colour') ? (
          <ColourPopover
            current={st.colour}
            onPick={(v) => applyColour(editor, v)}
            onRemove={() => removeColour(editor)}
            trigger={colourTrigger}
          />
        ) : null}
        {listGroupVisible ? <Divider /> : null}
        {show('bullet') ? renderSimple('bullet') : null}
        {show('numbered') ? renderSimple('numbered') : null}
        {show('quote') ? renderSimple('quote') : null}
        {showLink && !linkOverflowed ? (
          <LinkPopover
            open={linkOpen}
            onOpenChange={onLinkOpenChange}
            trigger={linkTrigger}
            currentUrl={isRich ? st.link : null}
            onApply={applyLinkUrl}
            onRemove={removeLinkUrl}
          />
        ) : null}
      </div>
      {overflowItems.length > 0 || (showLink && linkOverflowed) ? (
        // Measured as one block (useItemsRoom) so the split never depends on it showing.
        <span data-toolbar-more className="flex flex-none items-center gap-1">
          {showLink && linkOverflowed ? (
            <LinkPopover
              open={linkOpen}
              onOpenChange={onLinkOpenChange}
              trigger={<span aria-hidden="true" className="size-0" />}
              currentUrl={isRich ? st.link : null}
              onApply={applyLinkUrl}
              onRemove={removeLinkUrl}
            />
          ) : null}
          <OverflowMenu items={overflowItems} />
          {overflowItems.length > 0 ? <Divider /> : null}
        </span>
      ) : null}
      <InsertMenu items={INSERT_ITEMS} onInsert={insert} showLabel={showInsertLabel} />
      <div data-toolbar-spacer className="flex-1" />
      {!isRich ? (
        <ToolbarButton
          label={previewVisible ? 'Hide preview' : 'Show preview'}
          icon={<PanelRight className={ICON} />}
          onClick={onPreviewToggle}
          pressed={previewVisible}
          className={cn('flex-none', 'hidden @[35rem]:inline-flex')}
        />
      ) : null}
      <ModeToggle mode={mode} onChange={onModeChange} richDisabled={richDisabled} />
    </div>
  );
}
