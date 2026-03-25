import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import type { JiraAttachment } from '@/services/jira';
import { AuthImage } from '../AuthImage';
import { formatFileSize } from './AttachmentFileRow';

interface AttachmentLightboxProps {
  images: JiraAttachment[];
  currentIndex: number;
  open: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function AttachmentLightbox({
  images,
  currentIndex,
  open,
  onClose,
  onNavigate,
}: AttachmentLightboxProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onNavigate(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < images.length - 1) {
        onNavigate(currentIndex + 1);
      }
    },
    [onClose, onNavigate, currentIndex, images.length],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  // Auto-focus overlay for keyboard events
  useEffect(() => {
    if (open && overlayRef.current) {
      overlayRef.current.focus();
    }
  }, [open]);

  if (!open || images.length === 0) return null;

  const current = images[currentIndex];
  if (!current) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={current.filename ?? 'Image preview'}
      tabIndex={-1}
    >
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white/80 hover:text-white hover:bg-white/10 z-10"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close lightbox"
      >
        <X className="size-6" />
      </Button>

      {/* Prev button */}
      {currentIndex > 0 && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white hover:bg-white/10 z-10 size-12"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(currentIndex - 1);
          }}
          aria-label="Previous image"
        >
          <ChevronLeft className="size-8" />
        </Button>
      )}

      {/* Next button */}
      {currentIndex < images.length - 1 && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white hover:bg-white/10 z-10 size-12"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(currentIndex + 1);
          }}
          aria-label="Next image"
        >
          <ChevronRight className="size-8" />
        </Button>
      )}

      {/* Image + caption */}
      <div className="flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <AuthImage
          src={current.content}
          alt={current.filename}
          className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
        />
        <p className="text-white/80 text-sm">
          {current.filename}
          {current.size != null && ` - ${formatFileSize(current.size)}`}
        </p>
      </div>
    </div>
  );
}
