/**
 * PriorityIcon — renders the actual Jira priority `iconUrl` image.
 *
 * Mirrors the IssueTypeIcon convention (named export, `className` prop defaulting
 * to the standard small meta-icon size). The priority iconUrl is absolute and
 * needs no auth, so it renders a plain <img> (not AuthImage).
 *
 * Returns null for null/undefined priority OR an empty-string iconUrl — the
 * single truthiness guard `!priority?.iconUrl` covers all three cases, so
 * missing/unmapped priorities render nothing (no broken image).
 */
interface PriorityIconProps {
  priority: { name?: string | null; iconUrl?: string | null } | null | undefined;
  className?: string;
}

export function PriorityIcon({ priority, className = 'w-3.5 h-3.5 shrink-0' }: PriorityIconProps) {
  if (!priority?.iconUrl) return null;
  // Priority is now conveyed only by this icon (the colored card border shows
  // issue type), so the image needs a real accessible name — not alt="".
  const label = priority.name ? `Priority: ${priority.name}` : 'Priority';
  return (
    <img
      src={priority.iconUrl}
      alt={label}
      title={priority.name ?? undefined}
      className={className}
    />
  );
}
