/**
 * SearchResultPanel — read-only detail view for a Jira issue or GitLab MR.
 *
 * Follows the NotificationDetail pattern from Phase 3:
 * - Back button to return to results list
 * - Source-specific metadata rows
 * - "Open in Jira/GitLab" button using openUrl from @tauri-apps/plugin-opener
 *
 * For Jira issues: key, summary, status badge, assignee, story points, description excerpt.
 * For GitLab MRs: iid, title, state badge, author, linked task key chip (if found in title).
 */
import { openUrl } from '@tauri-apps/plugin-opener';
import { ChevronLeft } from 'lucide-react';
import type { JiraIssue } from '@/services/jira';
import type { GitLabMR } from '@/services/gitlab';
import { extractTicketKeys } from '@/services/linkEngine';

interface SearchResultPanelProps {
  result: JiraIssue | GitLabMR;
  type: 'jira' | 'gitlab';
  jiraBaseUrl: string;
  onBack: () => void;
}

/**
 * Convert Atlassian Document Format (ADF) to plain text.
 * Jira Cloud returns issue.fields.description as an ADF JSON object.
 * Jira Server may still return a plain string — handle both defensively.
 */
function adfToPlainText(description: unknown): string {
  if (!description) return '';
  // Jira Server plain-string fallback
  if (typeof description === 'string') return description;
  // ADF object: walk content nodes and collect text leaves
  const parts: string[] = [];
  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (n.type === 'text' && typeof n.text === 'string') {
      parts.push(n.text);
    }
    if (Array.isArray(n.content)) {
      n.content.forEach(walk);
    }
  }
  walk(description);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function isJiraIssue(result: JiraIssue | GitLabMR): result is JiraIssue {
  return 'key' in result && 'fields' in result;
}

function MrStateBadge({ state }: { state: GitLabMR['state'] }) {
  const colors: Record<GitLabMR['state'], string> = {
    opened: 'bg-green-100 text-green-700',
    closed: 'bg-red-100 text-red-700',
    merged: 'bg-purple-100 text-purple-700',
    locked: 'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${colors[state]}`}>
      {state}
    </span>
  );
}

function JiraPanel({
  issue,
  jiraBaseUrl,
  onBack,
}: {
  issue: JiraIssue;
  jiraBaseUrl: string;
  onBack: () => void;
}) {
  const descriptionExcerpt = (() => {
    const text = adfToPlainText(issue.fields.description as unknown);
    return text ? text.slice(0, 200) : null;
  })();

  return (
    <div className="p-3 space-y-3">
      {/* Back + header */}
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground flex-shrink-0"
          aria-label="Back"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
      </div>

      <div>
        <span className="text-xs font-mono text-muted-foreground">{issue.key}</span>
        <h3 className="text-sm font-semibold mt-0.5">{issue.fields.summary}</h3>
      </div>

      {/* Metadata row */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        <span className="inline-block px-2 py-0.5 rounded-full bg-muted text-foreground text-xs font-medium">
          {issue.fields.status.name}
        </span>
        <span>{issue.fields.assignee ? issue.fields.assignee.displayName : 'Unassigned'}</span>
        {issue.fields.customfield_10016 !== null && (
          <span>{issue.fields.customfield_10016} pts</span>
        )}
      </div>

      {/* Description excerpt */}
      {descriptionExcerpt !== null && (
        <p className="text-xs text-muted-foreground line-clamp-3 bg-muted/30 p-2 rounded">
          {descriptionExcerpt}
        </p>
      )}

      {/* Footer */}
      <button
        type="button"
        onClick={() => openUrl(`${jiraBaseUrl}/browse/${issue.key}`)}
        className="text-xs text-primary hover:underline"
        aria-label="Open in Jira"
      >
        Open in Jira ↗
      </button>
    </div>
  );
}

function GitLabPanel({
  mr,
  jiraBaseUrl,
  onBack,
}: {
  mr: GitLabMR;
  jiraBaseUrl: string;
  onBack: () => void;
}) {
  const linkedKey = extractTicketKeys(mr.title)[0] ?? null;

  return (
    <div className="p-3 space-y-3">
      {/* Back + header */}
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground flex-shrink-0"
          aria-label="Back"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
      </div>

      <div>
        <span className="text-xs text-muted-foreground">!{mr.iid}</span>
        <h3 className="text-sm font-semibold mt-0.5">{mr.title}</h3>
      </div>

      {/* Metadata row */}
      <div className="flex items-center gap-3 text-xs flex-wrap">
        <MrStateBadge state={mr.state} />
        <span className="text-muted-foreground">{mr.author.name}</span>
        {linkedKey && (
          <span className="text-muted-foreground font-mono">{linkedKey}</span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => openUrl(mr.web_url)}
          className="text-xs text-primary hover:underline"
          aria-label="Open in GitLab"
        >
          Open in GitLab ↗
        </button>
        {linkedKey && (
          <button
            type="button"
            onClick={() => openUrl(`${jiraBaseUrl}/browse/${linkedKey}`)}
            className="text-xs text-primary hover:underline"
            aria-label={`Open ${linkedKey} in Jira`}
          >
            Open {linkedKey} in Jira ↗
          </button>
        )}
      </div>
    </div>
  );
}

export default function SearchResultPanel({ result, type, jiraBaseUrl, onBack }: SearchResultPanelProps) {
  if (type === 'jira' && isJiraIssue(result)) {
    return <JiraPanel issue={result} jiraBaseUrl={jiraBaseUrl} onBack={onBack} />;
  }
  if (type === 'gitlab' && !isJiraIssue(result)) {
    return <GitLabPanel mr={result as GitLabMR} jiraBaseUrl={jiraBaseUrl} onBack={onBack} />;
  }
  return null;
}
