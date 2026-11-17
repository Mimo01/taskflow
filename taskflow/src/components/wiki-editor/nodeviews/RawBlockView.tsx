import { type NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { WikiRenderer } from '@/routes/dashboard/WikiRenderer';
import { EDIT_IN_SOURCE_EVENT, type EditInSourceDetail } from './events';

export function RawBlockView({ node, selected, getPos }: NodeViewProps) {
  return (
    <NodeViewWrapper
      contentEditable={false}
      className={`group relative rounded-md border border-dashed border-border bg-muted/30 p-2${
        selected ? ' ring-1 ring-ring' : ''
      }`}
    >
      <WikiRenderer wikiText={String(node.attrs.raw)} />
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        onClick={(e) => {
          const pos = getPos();
          e.currentTarget.dispatchEvent(
            new CustomEvent<EditInSourceDetail>(EDIT_IN_SOURCE_EVENT, {
              bubbles: true,
              detail: { pos: typeof pos === 'number' ? pos : -1 },
            }),
          );
        }}
      >
        Edit in source
      </Button>
    </NodeViewWrapper>
  );
}
