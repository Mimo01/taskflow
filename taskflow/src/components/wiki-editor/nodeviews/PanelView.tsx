import { NodeViewContent, type NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { calloutStyles } from '@/lib/wiki/prose';
import {
  type PanelType,
  paramsFromTitle,
  removePanel,
  sanitizePanelTitle,
  titleFromParams,
} from '../panel-commands';

const TYPES: readonly { value: PanelType; label: string }[] = [
  { value: 'panel', label: 'Panel' },
  { value: 'info', label: 'Info' },
  { value: 'note', label: 'Note' },
  { value: 'warning', label: 'Warning' },
  { value: 'tip', label: 'Tip' },
];

export function PanelView({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  const type = String(node.attrs.type);
  const saved = titleFromParams(node.attrs.params as string | null);
  // Draft keeps in-progress spaces (the stored title is trimmed).
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <NodeViewWrapper className={calloutStyles[type] ?? calloutStyles.panel} data-callout={type}>
      <div contentEditable={false} className="mb-1 flex items-center gap-2">
        <input
          type="text"
          aria-label="Panel title"
          placeholder="Title (optional)"
          className="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground"
          value={draft ?? saved}
          onChange={(e) => {
            setDraft(e.target.value);
            updateAttributes({ params: paramsFromTitle(sanitizePanelTitle(e.target.value)) });
          }}
          onBlur={() => setDraft(null)}
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Panel options"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          {/* The trigger sits outside the editable text (or is removed with the panel), so focus returns to the editor. */}
          <DropdownMenuContent align="end" finalFocus={() => editor.view.dom}>
            <DropdownMenuRadioGroup
              value={type}
              onValueChange={(v) => updateAttributes({ type: v })}
            >
              {TYPES.map((t) => (
                <DropdownMenuRadioItem key={t.value} value={t.value} closeOnClick>
                  {t.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                const pos = getPos();
                if (typeof pos === 'number') removePanel(editor, pos);
              }}
            >
              Remove panel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <NodeViewContent />
    </NodeViewWrapper>
  );
}
