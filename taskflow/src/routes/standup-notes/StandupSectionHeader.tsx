/**
 * StandupSectionHeader — shared section header for both standup columns.
 *
 * Uppercase muted label with an optional count badge. Used by the Today
 * sections (In Progress, Up Next, MRs Awaiting You, Participating) and the
 * Yesterday sections (Worked On, Other Merge Requests, Other Commits) so the
 * two columns stay visually symmetric.
 */

interface StandupSectionHeaderProps {
  label: string;
  count: number;
  /** Show the badge even when count is 0 — for always-visible sections like Up Next. */
  showZero?: boolean;
}

export default function StandupSectionHeader({
  label,
  count,
  showZero = false,
}: StandupSectionHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <h3 className="text-sm font-semibold text-muted-foreground/60">{label}</h3>
      {(count > 0 || showZero) && (
        <span className="text-sm font-normal text-muted-foreground/60">{count}</span>
      )}
      <hr className="flex-1 border-t border-border" />
    </div>
  );
}
