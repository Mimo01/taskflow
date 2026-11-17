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
  full: ['subsup', 'strike', 'mono', 'quote', 'colour', 'link', 'numbered', 'bullet', 'underline'],
  compact: ['strike', 'mono', 'bullet', 'numbered'],
};

/** Minimum frame width (px) at which the item stays inline. Must match INLINE_CLASS. */
export const OVERFLOW_BREAKPOINTS: Record<ToolbarPreset, Partial<Record<ToolbarItemId, number>>> = {
  full: { subsup: 640, strike: 600, mono: 560, quote: 520, colour: 480, link: 440, numbered: 420, bullet: 420, underline: 400 },
  compact: { strike: 420, mono: 400, bullet: 380, numbered: 380 },
};

/** Plain literals so the Tailwind v4 scanner finds every class. rem = px / 16. */
export const INLINE_CLASS: Record<ToolbarPreset, Partial<Record<ToolbarItemId, string>>> = {
  full: {
    subsup: 'hidden @[40rem]:inline-flex',
    strike: 'hidden @[37.5rem]:inline-flex',
    mono: 'hidden @[35rem]:inline-flex',
    quote: 'hidden @[32.5rem]:inline-flex',
    colour: 'hidden @[30rem]:inline-flex',
    link: 'hidden @[27.5rem]:inline-flex',
    numbered: 'hidden @[26.25rem]:inline-flex',
    bullet: 'hidden @[26.25rem]:inline-flex',
    underline: 'hidden @[25rem]:inline-flex',
  },
  compact: {
    strike: 'hidden @[26.25rem]:inline-flex',
    mono: 'hidden @[25rem]:inline-flex',
    bullet: 'hidden @[23.75rem]:inline-flex',
    numbered: 'hidden @[23.75rem]:inline-flex',
  },
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
