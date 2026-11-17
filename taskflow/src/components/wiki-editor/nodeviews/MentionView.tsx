import { type NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useHost } from '../host';

const PILL = 'mention-badge inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium';

export function MentionView({ node, editor, selected }: NodeViewProps) {
  const { userMap } = useHost(editor);
  const id = String(node.attrs.id);
  const display = userMap[id];
  const tone = display ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground';
  return (
    <NodeViewWrapper as="span" contentEditable={false}>
      <Tooltip>
        <TooltipTrigger
          render={<span className={`${PILL} ${tone}${selected ? ' ring-1 ring-ring' : ''}`} />}
        >
          @{display ?? id}
        </TooltipTrigger>
        <TooltipContent>{id}</TooltipContent>
      </Tooltip>
    </NodeViewWrapper>
  );
}
