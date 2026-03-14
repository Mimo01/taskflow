/**
 * BacklogRow — A single backlog issue row in the Backlog table.
 *
 * Displays: checkbox (multi-select), issue key (monospace), summary (clickable),
 * story points badge, assignee avatar, and colored epic badge.
 *
 * Row click (summary text) calls onIssueClick(issue.key) — NOT the entire row.
 * Checkbox onChange stops propagation to avoid triggering the summary click.
 */
import type { JiraIssue } from '@/services/jira';

// ── Epic color helper ──────────────────────────────────────────────────────────

const EPIC_COLORS = [
  'bg-purple-100 text-purple-800 border-purple-300',
  'bg-blue-100 text-blue-800 border-blue-300',
  'bg-green-100 text-green-800 border-green-300',
  'bg-orange-100 text-orange-800 border-orange-300',
  'bg-pink-100 text-pink-800 border-pink-300',
  'bg-teal-100 text-teal-800 border-teal-300',
] as const;

function epicColorClass(epicKey: string): string {
  let hash = 0;
  for (let i = 0; i < epicKey.length; i++) hash = (hash * 31 + epicKey.charCodeAt(i)) >>> 0;
  return EPIC_COLORS[hash % EPIC_COLORS.length];
}

// ── Props ──────────────────────────────────────────────────────────────────────

export interface BacklogRowProps {
  issue: JiraIssue;
  selected: boolean;
  onSelect: (key: string, selected: boolean) => void;
  onIssueClick: (key: string) => void;
  storyPointsFieldKey: string;
  epicLinkFieldKey: string;
  epicNameFieldKey: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BacklogRow({
  issue,
  selected,
  onSelect,
  onIssueClick,
  storyPointsFieldKey,
  epicLinkFieldKey,
  epicNameFieldKey,
}: BacklogRowProps) {
  const epicKey = issue.fields[epicLinkFieldKey] as string | null;
  const epicName = issue.fields[epicNameFieldKey] as string | null;
  const storyPoints =
    (issue.fields[storyPointsFieldKey] as number | null) ??
    (issue.fields.customfield_10016 as number | null);

  return (
    <tr
      data-testid={`backlog-row-${issue.key}`}
      className="border-b border-border hover:bg-muted/30 transition-colors"
    >
      {/* Checkbox cell */}
      <td className="w-8 px-3 py-2">
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
      <td className="w-24 px-2 py-2">
        <span className="font-mono text-xs text-muted-foreground">{issue.key}</span>
      </td>

      {/* Summary cell — clickable button */}
      <td className="px-2 py-2 max-w-xs">
        <button
          type="button"
          onClick={() => onIssueClick(issue.key)}
          className="text-sm text-left hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded truncate w-full"
        >
          {issue.fields.summary}
        </button>
      </td>

      {/* Story points cell */}
      <td className="w-14 px-2 py-2 text-right">
        {storyPoints !== null ? (
          <span className="inline-flex items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">
            {storyPoints}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      {/* Assignee cell */}
      <td className="w-10 px-2 py-2">
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

      {/* Epic badge cell */}
      <td className="px-2 py-2">
        {epicKey && epicName ? (
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${epicColorClass(epicKey)}`}
            title={epicKey}
          >
            {epicName}
          </span>
        ) : null}
      </td>
    </tr>
  );
}

export default BacklogRow;
