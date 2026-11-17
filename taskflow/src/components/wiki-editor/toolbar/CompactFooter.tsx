import type { Editor } from '@tiptap/core';
import { AtSign, Paperclip, Smile } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SourceHandle } from '../source/SourceView';
import { openEmoticonSuggestion } from '../suggestion/emoticon-suggestion';
import { ModeToggle } from './ModeToggle';
import { ToolbarButton } from './ToolbarButton';

const ICON = 'size-4';
const BTN = 'size-7';

export interface CompactFooterProps {
  editor: Editor;
  mode: 'rich' | 'source';
  richDisabled: boolean;
  onModeChange: (m: 'rich' | 'source') => void;
  onAttach: () => void;
  source: React.RefObject<SourceHandle | null>;
}

/** Slim action row under a compact editor: Attach, Mention, Emoticon, Rich|Source. */
export function CompactFooter({
  editor,
  mode,
  richDisabled,
  onModeChange,
  onAttach,
  source,
}: CompactFooterProps) {
  const mention = () => {
    if (mode === 'source') {
      source.current?.insertTrigger('@');
      return;
    }
    const { $from } = editor.state.selection;
    const prev =
      $from.parentOffset > 0
        ? $from.parent.textBetween($from.parentOffset - 1, $from.parentOffset, undefined, '￼')
        : '';
    const text = prev !== '' && !/\s/.test(prev) ? ' @' : '@';
    editor.chain().focus().insertContent(text).run();
  };
  const emoticon = () => {
    if (mode === 'source') {
      source.current?.insertTrigger(':');
      return;
    }
    editor.commands.focus();
    openEmoticonSuggestion(editor);
  };

  return (
    <div className="flex h-8 flex-nowrap items-center gap-1 border-t border-border px-2">
      <ToolbarButton
        label="Attach file"
        icon={<Paperclip className={ICON} />}
        onClick={onAttach}
        className={BTN}
      />
      <ToolbarButton
        label="Mention someone"
        icon={<AtSign className={ICON} />}
        onClick={mention}
        className={cn(BTN, '@max-[260px]:hidden')}
      />
      <ToolbarButton
        label="Emoticon"
        icon={<Smile className={ICON} />}
        onClick={emoticon}
        className={cn(BTN, '@max-[320px]:hidden')}
      />
      <div className="flex-1" />
      <ModeToggle mode={mode} onChange={onModeChange} richDisabled={richDisabled} />
    </div>
  );
}
