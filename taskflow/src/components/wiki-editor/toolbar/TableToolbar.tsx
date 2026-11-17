import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { Popover, PopoverContent } from '@/components/ui/popover';
import { findTable, TABLE_ACTIONS } from '../table-commands';
import { ToolbarButton } from './ToolbarButton';

/** Floating toolbar shown above the table while the caret is inside it. */
export function TableToolbar({ editor }: { editor: Editor }) {
  const { inTable, anchor } = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const t = findTable(e.state);
      const dom = t ? e.view.nodeDOM(t.pos) : null;
      return { inTable: t !== null, anchor: dom instanceof HTMLElement ? dom : null };
    },
  });

  return (
    <Popover open={inTable}>
      <PopoverContent
        anchor={anchor}
        side="top"
        align="start"
        initialFocus={false}
        className="flex gap-1 p-1"
      >
        {TABLE_ACTIONS.map((a) => (
          <span key={a.id} className="flex items-center gap-1">
            {a.destructive ? (
              <span
                aria-hidden="true"
                data-testid="table-toolbar-separator"
                className="mx-0.5 h-4 w-px bg-border"
              />
            ) : null}
            <ToolbarButton
              label={a.label}
              icon={<a.icon />}
              onClick={() => a.run(editor)}
              className={a.destructive ? 'text-destructive hover:text-destructive' : undefined}
            />
          </span>
        ))}
      </PopoverContent>
    </Popover>
  );
}
