import { type NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { EMOTICONS, emoticonGlyph } from '../suggestion/emoticon-data';

export function EmoticonView({ node, selected }: NodeViewProps) {
  const src = String(node.attrs.src);
  const name = EMOTICONS.find((e) => e.token === src)?.name ?? src;
  return (
    <NodeViewWrapper
      as="span"
      contentEditable={false}
      title={src}
      aria-label={name}
      className={selected ? 'rounded ring-1 ring-ring' : undefined}
    >
      {emoticonGlyph(src) ?? src}
    </NodeViewWrapper>
  );
}
