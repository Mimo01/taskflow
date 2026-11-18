import { type NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { AuthImage } from '@/routes/dashboard/AuthImage';
import { useHost, useLocalPreview } from '../host';

const CHIP_CLASS = 'rounded bg-muted px-1 text-xs text-muted-foreground';
const IMG_CLASS = 'max-w-full rounded-md';

/**
 * Display only: width/thumbnail options on the node are ignored here and never written
 * back, so they round-trip verbatim on save.
 */
export function ImageView({ node, editor, selected }: NodeViewProps) {
  const { attachments } = useHost(editor);
  const name = String(node.attrs.name);
  const ring = selected ? ' ring-1 ring-ring' : '';
  const local = useLocalPreview(editor, name);
  const attachment = attachments.find((a) => a.filename === name);
  let body: React.ReactNode;
  if (local) {
    body = <img src={local} alt="" className={`${IMG_CLASS}${ring}`} draggable={false} />;
  } else if (attachment) {
    body = <AuthImage src={attachment.content} alt="" className={`${IMG_CLASS}${ring}`} />;
  } else if (/^https?:\/\//.test(name)) {
    body = <AuthImage src={name.replace(/\+/g, '%20')} alt="" className={`${IMG_CLASS}${ring}`} />;
  } else {
    body = <span className={`${CHIP_CLASS}${ring}`}>{name}</span>;
  }
  return (
    <NodeViewWrapper as="span" contentEditable={false}>
      {body}
    </NodeViewWrapper>
  );
}
