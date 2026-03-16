/**
 * BacklogRow -- A single backlog issue row in the Backlog table.
 *
 * Displays: checkbox (multi-select), issue key (monospace), summary (clickable),
 * story points badge, assignee avatar, and colored epic badge.
 *
 * Epic badge colors now come from Jira's actual epic color field (ghx-label-N),
 * with hash-based fallback for epics missing a Jira color value.
 *
 * Row click (summary text) calls onIssueClick(issue.key) -- NOT the entire row.
 * Checkbox onChange stops propagation to avoid triggering the summary click.
 */
import React from 'react';
import type { JiraIssue } from '@/services/jira';
import { cn } from '@/lib/utils';
import { epicColorToTailwind } from '@/lib/epicColors';

// -- Props --------------------------------------------------------------------

export interface BacklogRowProps {
  issue: JiraIssue;
  selected: boolean;
  onSelect: (key: string, selected: boolean) => void;
  onIssueClick: (key: string) => void;
  storyPointsFieldKey: string;
  epicLinkFieldKey: string;
  epicNameFieldKey: string;
  epicNames?: Map<string, string>;
  epicColors?: Map<string, string>;
  isFocused?: boolean;
}

// -- Component ----------------------------------------------------------------

export const BacklogRow = React.forwardRef<HTMLTableRowElement, BacklogRowProps>(function BacklogRow({
  issue,
  selected,
  onSelect,
  onIssueClick,
  storyPointsFieldKey,
  epicLinkFieldKey,
  epicNameFieldKey,
  epicNames,
  epicColors,
  isFocused,
}, ref) {
  const epicKey = issue.fields[epicLinkFieldKey] as string | null;
  // Prefer fetched epic name from the epicNames map; fall back to customfield_10015, then key
  const epicName = epicKey
    ? (epicNames?.get(epicKey) ?? (issue.fields[epicNameFieldKey] as string | null) ?? epicKey)
    : null;
  const storyPoints =
    (issue.fields[storyPointsFieldKey] as number | null) ??
    (issue.fields.customfield_10016 as number | null);

  // Resolve epic badge color from Jira color map, with hash-based fallback
  const epicColorResult = epicKey
    ? epicColorToTailwind(epicColors?.get(epicKey) ?? null, epicKey)
    : null;

  return (
    <tr
      ref={ref}
      data-testid={`backlog-row-${issue.key}`}
      className={cn('border-b border-border hover:bg-muted/30 transition-colors', isFocused && 'bg-muted border-l-2 border-primary')}
      aria-current={isFocused ? 'true' : undefined}
    >
      {/* Checkbox cell */}
      <td className="w-8 px-3 py-2 density-compact:py-1 density-comfortable:py-3">
        <input
          type="checkbox"
          data-testid={`row-checkbox-${issue.key}`}
          aria-label={issue.key}
          checked={selected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect(issue.key, !selected);
          }}
          className="cursor-pointer"
        />
      </td>

      {/* Key cell */}
      <td className="w-24 px-2 py-2 density-compact:py-1 density-comfortable:py-3">
        <span className="font-mono text-xs text-muted-foreground">{issue.key}</span>
      </td>

      {/* Epic badge cell -- right after key */}
      <td className="w-32 px-2 py-2 density-compact:py-1 density-comfortable:py-3">
        {epicKey && epicName && epicColorResult ? (
          <button
            type="button"
            onClick={() => onIssueClick(epicKey)}
            className={cn(
              'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium truncate max-w-full hover:opacity-80 transition-opacity',
              epicColorResult.className,
            )}
            style={epicColorResult.style}
            title={`${epicKey}: ${epicName}`}
          >
            <span className="opacity-70 mr-1">{epicKey}</span>
            {epicName !== epicKey ? epicName : null}
          </button>
        ) : null}
      </td>

      {/* Summary cell -- clickable button */}
      <td className="px-2 py-2 density-compact:py-1 density-comfortable:py-3 max-w-xs">
        <button
          type="button"
          onClick={() => onIssueClick(issue.key)}
          className="text-sm text-left hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded truncate w-full"
        >
          {issue.fields.summary}
        </button>
      </td>

      {/* Story points cell */}
      <td className="w-14 px-2 py-2 density-compact:py-1 density-comfortable:py-3 text-right">
        {storyPoints !== null ? (
          <span className="inline-flex items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">
            {storyPoints}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">--</span>
        )}
      </td>

      {/* Assignee cell */}
      <td className="w-10 px-2 py-2 density-compact:py-1 density-comfortable:py-3">
        {issue.fields.assignee ? (
          <img
            src={issue.fields.assignee.avatarUrls['48x48'] || undefined}
            alt={issue.fields.assignee.displayName}
            title={issue.fields.assignee.displayName}
            className="rounded-full w-6 h-6 object-cover"
          />
        ) : (
          <span
            className="inline-flex items-center justify-center rounded-full w-6 h-6 bg-muted text-xs text-muted-foreground"
            title="Unassigned"
          >
            ?
          </span>
        )}
      </td>


    </tr>
  );
});

export default BacklogRow;
