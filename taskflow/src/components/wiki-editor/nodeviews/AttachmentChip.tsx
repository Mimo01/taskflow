import { type NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { File, FileText } from 'lucide-react';

// Classes mirror the `wiki-attachment-chip` anchor in routes/dashboard/WikiRenderer.tsx.
const CHIP =
  'wiki-attachment-chip inline-flex items-center gap-1 rounded border bg-muted/40 px-1.5 py-0.5 text-xs no-underline';

export function AttachmentChip({ node, selected }: NodeViewProps) {
  const name = String(node.attrs.name);
  const label = node.attrs.label ? String(node.attrs.label) : name;
  const Icon = /\.(pdf|txt|log|md)$/i.test(name) ? FileText : File;
  return (
    <NodeViewWrapper
      as="span"
      contentEditable={false}
      className={`${CHIP}${selected ? ' ring-1 ring-ring' : ''}`}
    >
      <Icon className="size-3.5 text-muted-foreground shrink-0" />
      {label}
    </NodeViewWrapper>
  );
}
