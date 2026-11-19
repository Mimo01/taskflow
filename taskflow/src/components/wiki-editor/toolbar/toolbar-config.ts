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
 * Minimum frame content width (px) at which the item stays inline. Must match INLINE_CLASS.
 *
 * Derived from WebKit measurements (98 UAT round 2), not guessed: the pinned controls
 * (px-2 padding, Insert, More, Rich|Source and their gaps) take 214px, plus the 13px More|Insert
 * divider whenever More shows (so -45 rather than -32 when More is empty), +37 when the Insert
 * label shows, -4 when Link is inline (no overflow anchor). Buttons are 28px + 4px gap, Text
 * style 98px, each divider 13px. Every breakpoint except the widest moved +16 for the divider
 * (rounded to quarter-rem). At every width the inline set fits the items region, so nothing is
 * clipped; below ~371px (full) Text style + Bold alone overflow.
 */
export const OVERFLOW_BREAKPOINTS: Record<ToolbarPreset, Partial<Record<ToolbarItemId, number>>> = {
  full: {
    subsup: 732,
    strike: 676,
    mono: 644,
    quote: 612,
    colour: 580,
    link: 548,
    numbered: 516,
    bullet: 484,
    underline: 444,
    italic: 412,
  },
  compact: { strike: 484, mono: 484, bullet: 468, numbered: 396, underline: 364, italic: 332 },
};

/** Plain literals so the Tailwind v4 scanner finds every class. rem = px / 16. */
export const INLINE_CLASS: Record<ToolbarPreset, Partial<Record<ToolbarItemId, string>>> = {
  full: {
    subsup: 'hidden @[45.75rem]:inline-flex',
    strike: 'hidden @[42.25rem]:inline-flex',
    mono: 'hidden @[40.25rem]:inline-flex',
    quote: 'hidden @[38.25rem]:inline-flex',
    colour: 'hidden @[36.25rem]:inline-flex',
    link: 'hidden @[34.25rem]:inline-flex',
    numbered: 'hidden @[32.25rem]:inline-flex',
    bullet: 'hidden @[30.25rem]:inline-flex',
    underline: 'hidden @[27.75rem]:inline-flex',
    italic: 'hidden @[25.75rem]:inline-flex',
  },
  compact: {
    strike: 'hidden @[30.25rem]:inline-flex',
    mono: 'hidden @[30.25rem]:inline-flex',
    bullet: 'hidden @[29.25rem]:inline-flex',
    numbered: 'hidden @[24.75rem]:inline-flex',
    underline: 'hidden @[22.75rem]:inline-flex',
    italic: 'hidden @[20.75rem]:inline-flex',
  },
};

/**
 * The "Insert" word shows only once every item is inline (the widest breakpoint), so it never
 * takes room a formatting button needs.
 */
export const INSERT_LABEL_CLASS: Record<ToolbarPreset, string> = {
  full: 'hidden @[45.75rem]:inline',
  compact: 'hidden @[30.25rem]:inline',
};

export function splitToolbar(
  preset: ToolbarPreset,
  widthPx: number,
): { inline: ToolbarItemId[]; overflow: ToolbarItemId[] } {
  const bps = OVERFLOW_BREAKPOINTS[preset];
  const overflow = OVERFLOW_ORDER[preset].filter((id) => widthPx < (bps[id] ?? 0));
  const inline = TOOLBAR_ITEMS.filter(
    (i) => i.presets.includes(preset) && !overflow.includes(i.id),
  ).map((i) => i.id);
  return { inline, overflow };
}
