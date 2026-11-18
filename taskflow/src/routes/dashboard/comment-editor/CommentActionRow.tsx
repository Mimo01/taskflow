import { Loader2, Paperclip } from 'lucide-react';
import { type ComponentProps, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { DraftNote } from '@/components/ui/draft-note';
import { Keycap } from '@/components/ui/keycap';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody } from '@/components/ui/tooltip-body';

interface CommentActionRowProps {
  draftState: ComponentProps<typeof DraftNote>['state'];
  onDiscard: () => void;
  onUseJira: () => void;
  onAttachFiles: (files: File[]) => void;
  attachDisabled?: boolean;
  onCancel?: () => void;
  cancelDisabled?: boolean;
  primaryLabel: string;
  pendingLabel: string;
  pending: boolean;
  primaryDisabled: boolean;
  onPrimary: () => void;
}

/** Single action row shared by the comment composer and the comment edit host (D-05). */
export function CommentActionRow({
  draftState,
  onDiscard,
  onUseJira,
  onAttachFiles,
  attachDisabled,
  onCancel,
  cancelDisabled,
  primaryLabel,
  pendingLabel,
  pending,
  primaryDisabled,
  onPrimary,
}: CommentActionRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-2">
      <DraftNote
        className="mr-auto"
        state={draftState}
        onDiscard={onDiscard}
        onUseJira={onUseJira}
      />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Attach files"
              disabled={attachDisabled}
              onClick={() => inputRef.current?.click()}
            />
          }
        >
          <Paperclip className="size-4 text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent>
          <TooltipBody>Attach files</TooltipBody>
        </TooltipContent>
      </Tooltip>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) onAttachFiles(files);
          e.target.value = '';
        }}
      />
      {onCancel && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={cancelDisabled}
              />
            }
          >
            Cancel
          </TooltipTrigger>
          <TooltipContent>
            <TooltipBody>
              <div className="flex items-center gap-2">
                <span className="font-medium">Cancel</span>
                <Keycap>Esc</Keycap>
              </div>
            </TooltipBody>
          </TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              disabled={primaryDisabled || pending}
              onClick={onPrimary}
            />
          }
        >
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          {pending ? pendingLabel : primaryLabel}
        </TooltipTrigger>
        <TooltipContent>
          <TooltipBody>
            <div className="flex items-center gap-2">
              <span className="font-medium">{primaryLabel}</span>
              <span className="flex items-center gap-1">
                <Keycap>⌘</Keycap>
                <Keycap>↵</Keycap>
              </span>
            </div>
          </TooltipBody>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
