import type { JiraAttachment } from '@/services/jira';
import { AuthImage } from '../AuthImage';

interface AttachmentThumbnailProps {
  attachment: JiraAttachment;
  onClick: () => void;
}

// Jira thumbnails are often missing or a generic placeholder for some PNGs; small
// images load fine as full content (same path the description uses), so prefer that.
const MAX_FULL_THUMB_BYTES = 2 * 1024 * 1024;

export function AttachmentThumbnail({ attachment, onClick }: AttachmentThumbnailProps) {
  return (
    <button
      type="button"
      aria-label={`${attachment.filename} - click to view full size`}
      className="w-20 h-20 rounded-md overflow-hidden bg-muted relative group cursor-pointer border border-border p-0"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <AuthImage
        src={
          attachment.size !== undefined && attachment.size <= MAX_FULL_THUMB_BYTES
            ? attachment.content
            : (attachment.thumbnail ?? attachment.content)
        }
        fallbackSrc={attachment.thumbnail ?? attachment.content}
        alt={attachment.filename}
        className="w-full h-full object-cover"
      />
    </button>
  );
}
