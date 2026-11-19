export type ToolbarPreset = 'full' | 'compact';

export type ToolbarItemId =
  | 'text-style'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'mono'
  | 'subsup'
  | 'colour'
  | 'bullet'
  | 'numbered'
  | 'quote'
  | 'link'
  | 'insert';

export interface ToolbarItemConfig {
  id: ToolbarItemId;
  label: string;
  keys?: string[];
  presets: readonly ToolbarPreset[];
}

const BOTH = ['full', 'compact'] as const;
const FULL = ['full'] as const;

export const TOOLBAR_ITEMS: readonly ToolbarItemConfig[] = [
  { id: 'text-style', label: 'Text style', presets: FULL },
  { id: 'bold', label: 'Bold', keys: ['⌘', 'B'], presets: BOTH },
  { id: 'italic', label: 'Italic', keys: ['⌘', 'I'], presets: BOTH },
  { id: 'underline', label: 'Underline', keys: ['⌘', 'U'], presets: BOTH },
  { id: 'strike', label: 'Strikethrough', keys: ['⌘', '⇧', 'X'], presets: BOTH },
  { id: 'mono', label: 'Monospace', keys: ['⌘', 'E'], presets: BOTH },
  { id: 'subsup', label: 'Subscript and superscript', presets: FULL },
  { id: 'colour', label: 'Text colour', presets: FULL },
  { id: 'bullet', label: 'Bullet list', keys: ['⌘', '⇧', '8'], presets: BOTH },
  { id: 'numbered', label: 'Numbered list', keys: ['⌘', '⇧', '7'], presets: BOTH },
  { id: 'quote', label: 'Quote', keys: ['⌘', '⇧', 'B'], presets: FULL },
  { id: 'link', label: 'Link', keys: ['⌘', 'K'], presets: BOTH },
  { id: 'insert', label: 'Insert', presets: BOTH },
];

/** Overflow order (first leaves first) per preset. The rule lives only in Insert. */
const OVERFLOW_ORDER: Record<ToolbarPreset, readonly ToolbarItemId[]> = {
  full: [
    'subsup',
    'strike',
    'mono',
    'quote',
    'colour',
    'link',
    'numbered',
    'bullet',
    'underline',
    'italic',
  ],
  compact: ['strike', 'mono', 'bullet', 'numbered', 'underline', 'italic'],
};

/**
 * Widths (px) of the shrinkable items, measured in WebKit (98 UAT round 2). Buttons are 28px
 * with a 4px gap; each divider is 9px + its gap = 13px. Text style's real width varies with
 * its label, so the toolbar passes the measured value and this is only the fallback.
 */
export const TOOLBAR_PX = {
  button: 28,
  gap: 4,
  divider: 13,
  textStyle: 98,
  /** ⋯ More (28) + gap + divider (9) + the toolbar gap before the block. */
  moreBlock: 45,
  /** The hidden overflowed-link anchor adds one gap inside the More block. */
  linkAnchor: 4,
  /** The "Insert" word next to the + icon. */
  insertLabel: 37,
} as const;

const LIST_GROUP: readonly ToolbarItemId[] = ['bullet', 'numbered', 'quote', 'link'];

export interface SplitOptions {
  /** Measured Text style trigger width; falls back to TOOLBAR_PX.textStyle. */
  textStylePx?: number;
}

/** Width the inline set needs inside the items region (pure, mirrors Toolbar's markup). */
export function itemsWidth(inline: readonly ToolbarItemId[], opts: SplitOptions = {}): number {
  const items = inline.filter((i) => i !== 'insert');
  if (items.length === 0) return 0;
  const textStyle =
    opts.textStylePx && opts.textStylePx > 0 ? opts.textStylePx : TOOLBAR_PX.textStyle;
  let buttons = 0;
  let need = 0;
  for (const i of items) {
    const n = i === 'subsup' ? 2 : 1;
    buttons += n;
    need += i === 'text-style' ? textStyle : n * TOOLBAR_PX.button;
  }
  need += TOOLBAR_PX.gap * (buttons - 1);
  if (items.includes('text-style')) need += TOOLBAR_PX.divider;
  if (items.some((i) => LIST_GROUP.includes(i))) need += TOOLBAR_PX.divider;
  return need;
}

/**
 * Splits the preset's items into inline and overflowed for `availablePx`: the width the items
 * region could take when the More block and the Insert label are NOT shown (measured from the
 * real toolbar, so pinned controls are never guessed). Keeping both out of the input stops the
 * measurement oscillating. Nothing overflows if everything fits; the Insert label shows only
 * then, and only if it fits too. Otherwise the More block is reserved and items leave in
 * OVERFLOW_ORDER until the rest fits.
 */
export function splitToolbar(
  preset: ToolbarPreset,
  availablePx: number,
  opts: SplitOptions = {},
): { inline: ToolbarItemId[]; overflow: ToolbarItemId[]; showInsertLabel: boolean } {
  const all = TOOLBAR_ITEMS.filter((i) => i.presets.includes(preset)).map((i) => i.id);
  const full = itemsWidth(all, opts);
  if (full <= availablePx) {
    return {
      inline: all,
      overflow: [],
      showInsertLabel: full + TOOLBAR_PX.insertLabel <= availablePx,
    };
  }
  const overflow: ToolbarItemId[] = [];
  for (const id of OVERFLOW_ORDER[preset]) {
    overflow.push(id);
    const room =
      availablePx - TOOLBAR_PX.moreBlock - (overflow.includes('link') ? TOOLBAR_PX.linkAnchor : 0);
    const rest = all.filter((i) => !overflow.includes(i));
    if (itemsWidth(rest, opts) <= room) break;
  }
  return { inline: all.filter((i) => !overflow.includes(i)), overflow, showInsertLabel: false };
}
