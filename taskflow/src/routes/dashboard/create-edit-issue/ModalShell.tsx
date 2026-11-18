import { Dialog } from '@base-ui/react/dialog';
import { Loader2, X } from 'lucide-react';
import type { FocusEventHandler, FormEvent, KeyboardEvent, ReactNode, Ref } from 'react';
import { Button } from '@/components/ui/button';
import { Keycap } from '@/components/ui/keycap';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface ModalShellProps {
  open: boolean;
  /** Base UI details are passed through untouched so consumers keep details.cancel() / defaultPrevented guards. */
  onOpenChange: (open: boolean, details: Dialog.Root.ChangeEventDetails) => void;
  title: ReactNode;
  headerLeading?: ReactNode;
  subtitle?: ReactNode;
  closeDisabled?: boolean;
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  onSubmitShortcut?: () => void;
  formRef?: Ref<HTMLFormElement>;
  toolbar?: ReactNode;
  aside?: ReactNode;
  asideLabel?: string;
  onAsideBlur?: FocusEventHandler<HTMLElement>;
  mainClassName?: string;
  footerStatus?: ReactNode;
  footerActions: ReactNode;
  children: ReactNode;
  afterContent?: ReactNode;
  testId?: string;
}

const FORM_CLASS = 'flex min-h-0 flex-1 flex-col';

export function ModalShell({
  open,
  onOpenChange,
  title,
  headerLeading,
  subtitle,
  closeDisabled,
  onSubmit,
  onSubmitShortcut,
  formRef,
  toolbar,
  aside,
  asideLabel,
  onAsideBlur,
  mainClassName,
  footerStatus,
  footerActions,
  children,
  afterContent,
  testId,
}: ModalShellProps) {
  function handleKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSubmitShortcut?.();
    }
  }

  const inner = (
    <>
      <div className="flex items-center gap-3 border-b px-6 py-4">
        {headerLeading}
        <div className="min-w-0">
          <Dialog.Title className="text-lg font-semibold leading-tight">{title}</Dialog.Title>
          {subtitle != null && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <Dialog.Close
          disabled={closeDisabled}
          render={
            <button
              type="button"
              className="ml-auto rounded p-1 hover:bg-accent disabled:opacity-50"
              aria-label="Close"
              disabled={closeDisabled}
            >
              <X className="h-4 w-4" />
            </button>
          }
        />
      </div>

      {toolbar != null && <div className="shrink-0 border-b px-6 py-3">{toolbar}</div>}

      <div className="flex min-h-0 flex-1 max-[720px]:flex-col max-[720px]:overflow-y-auto">
        <div
          className={cn(
            'flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4 max-[720px]:overflow-visible',
            mainClassName,
          )}
        >
          {children}
        </div>
        {aside != null && (
          <aside
            aria-label={asideLabel}
            onBlur={onAsideBlur}
            className="w-[300px] shrink-0 overflow-y-auto border-l bg-muted/30 p-4 min-[721px]:@max-[900px]:w-[240px] max-[720px]:w-full max-[720px]:overflow-visible max-[720px]:border-l-0 max-[720px]:border-t"
          >
            {aside}
          </aside>
        )}
      </div>

      <div className="flex items-center gap-2 border-t px-6 py-4">
        <div data-testid="modal-footer-status" className="flex min-w-0 flex-1 items-center gap-3">
          {footerStatus}
        </div>
        {footerActions}
      </div>
    </>
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Popup
          data-testid={testId}
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(1080px,94vw)] h-[88vh] min-h-[480px] max-h-[calc(100vh-2rem)] overflow-hidden bg-background border rounded-lg shadow-xl flex flex-col"
        >
          <div className="@container flex min-h-0 flex-1 flex-col">
            {onSubmit ? (
              <form
                ref={formRef}
                onSubmit={onSubmit}
                onKeyDown={handleKeyDown}
                className={FORM_CLASS}
              >
                {inner}
              </form>
            ) : (
              // biome-ignore lint/a11y/noStaticElementInteractions: key events bubble up from the focusable fields inside
              <div onKeyDown={handleKeyDown} className={FORM_CLASS}>
                {inner}
              </div>
            )}
            {afterContent}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ModalCancelButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button type="button" variant="outline" onClick={onClick} disabled={disabled} />}
      >
        Cancel
      </TooltipTrigger>
      <TooltipContent>
        <span className="flex items-center gap-2">
          <span className="font-medium">Cancel</span>
          <Keycap>Esc</Keycap>
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

export function ModalPrimaryButton({
  label,
  pendingLabel,
  pending,
  disabled,
  type = 'submit',
  onClick,
  ariaLabel,
}: {
  label: string;
  pendingLabel: string;
  pending?: boolean;
  disabled?: boolean;
  type?: 'submit' | 'button';
  onClick?: () => void;
  ariaLabel?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type={type}
            disabled={disabled}
            onClick={onClick}
            aria-label={ariaLabel}
            className="gap-1.5"
          />
        }
      >
        {pending && <Loader2 className="size-3.5 animate-spin" />}
        {pending ? pendingLabel : label}
      </TooltipTrigger>
      <TooltipContent>
        <span className="flex items-center gap-2">
          <span className="font-medium">{label}</span>
          <span className="flex items-center gap-1">
            <Keycap>⌘</Keycap>
            <Keycap>↵</Keycap>
          </span>
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

export function ModalField({
  htmlFor,
  label,
  required,
  className,
  children,
}: {
  htmlFor?: string;
  label: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={htmlFor} className="text-xs font-semibold text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {children}
    </div>
  );
}
