import { type NodeViewProps, NodeViewWrapper } from '@tiptap/react';

export function RawInlineChip({ node, selected }: NodeViewProps) {
  return (
    <NodeViewWrapper
      as="span"
      contentEditable={false}
      className={`rounded bg-muted/40 px-1 text-xs${selected ? ' ring-1 ring-ring' : ''}`}
    >
      {String(node.attrs.raw)}
    </NodeViewWrapper>
  );
}
