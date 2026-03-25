/**
 * QuickFilterChipRow -- horizontal scrollable row of toggle chips for
 * Jira board quick filters and label-based filters.
 *
 * Jira quick filter chips appear first, then a subtle divider, then label chips.
 * Active chips use Badge variant="default", inactive use variant="outline".
 * Chips AND with existing UnifiedFilterBar selections.
 *
 * Exports useQuickFilteredIssues hook for applying QF + label filter logic.
 */

import { useCallback, useRef } from 'react';

import { Badge } from '@/components/ui/badge';
import type { JiraIssue } from '@/services/jira';
import type { JiraBoardQuickFilter } from '@/services/jira/types';
import { useFilterStore } from '@/stores/filter.store';

// ---------------------------------------------------------------------------
// Simple JQL evaluator (client-side, best-effort)
// ---------------------------------------------------------------------------

function parseSimpleJql(jql: string): { field: string; op: string; value: string } | null {
  const match = jql.trim().match(/^(\w+)\s*(=|!=)\s*"?([^"]+)"?$/i);
  if (!match) return null;
  return { field: match[1].toLowerCase(), op: match[2], value: match[3] };
}

function evaluateCondition(
  issue: JiraIssue,
  cond: { field: string; op: string; value: string },
): boolean {
  let fieldVal: string | undefined;
  switch (cond.field) {
    case 'issuetype':
      fieldVal = issue.fields.issuetype.name;
      break;
    case 'priority':
      fieldVal = (issue.fields as Record<string, unknown>).priority
        ? ((issue.fields as Record<string, unknown>).priority as { name?: string })?.name
        : undefined;
      break;
    case 'assignee':
      fieldVal = issue.fields.assignee?.displayName;
      break;
    case 'status':
      fieldVal = issue.fields.status.name;
      break;
    default:
      return true; // unknown field = pass through
  }
  if (!fieldVal) return cond.op === '!=';
  const isMatch = fieldVal.toLowerCase() === cond.value.toLowerCase();
  return cond.op === '=' ? isMatch : !isMatch;
}

function evaluateQuickFilter(issue: JiraIssue, qf: JiraBoardQuickFilter): boolean {
  const cond = parseSimpleJql(qf.jql);
  if (!cond) return true; // unparseable JQL = always pass (conservative)
  return evaluateCondition(issue, cond);
}

// ---------------------------------------------------------------------------
// Hook: useQuickFilteredIssues
// ---------------------------------------------------------------------------

/**
 * Returns the subset of issues that pass all active Jira quick filter JQL
 * conditions AND all active label filters.
 */
export function useQuickFilteredIssues(
  issues: JiraIssue[],
  quickFilters: JiraBoardQuickFilter[],
): JiraIssue[] {
  const { activeJiraQuickFilters, activeLabelFilters } = useFilterStore();

  if (activeJiraQuickFilters.size === 0 && activeLabelFilters.size === 0) {
    return issues;
  }

  return issues.filter((issue) => {
    // All active QF conditions must pass (AND)
    for (const qfId of activeJiraQuickFilters) {
      const qf = quickFilters.find((q) => q.id === qfId);
      if (qf && !evaluateQuickFilter(issue, qf)) return false;
    }

    // Label filter: issue must have at least one label in activeLabelFilters
    if (activeLabelFilters.size > 0) {
      const issueLabels = (issue.fields.labels as string[] | undefined) ?? [];
      if (!issueLabels.some((l) => activeLabelFilters.has(l))) return false;
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface QuickFilterChipRowProps {
  quickFilters: JiraBoardQuickFilter[];
  labels: string[];
  issues: JiraIssue[];
}

export function QuickFilterChipRow({ quickFilters, labels }: QuickFilterChipRowProps) {
  const { activeJiraQuickFilters, activeLabelFilters, toggleJiraQuickFilter, toggleLabelFilter } =
    useFilterStore();

  const chipRefs = useRef<(HTMLElement | null)[]>([]);

  const totalChips = quickFilters.length + labels.length;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      let nextIndex: number | null = null;
      if (e.key === 'ArrowRight') {
        nextIndex = index < totalChips - 1 ? index + 1 : 0;
      } else if (e.key === 'ArrowLeft') {
        nextIndex = index > 0 ? index - 1 : totalChips - 1;
      }
      if (nextIndex !== null) {
        e.preventDefault();
        chipRefs.current[nextIndex]?.focus();
      }
    },
    [totalChips],
  );

  if (quickFilters.length === 0 && labels.length === 0) return null;

  const hasQFs = quickFilters.length > 0;
  const hasLabels = labels.length > 0;

  return (
    <div
      role="toolbar"
      aria-label="Quick filters"
      className="flex items-center gap-2 px-3 py-1.5 overflow-x-auto no-scrollbar"
    >
      {/* Jira quick filter chips */}
      {quickFilters.map((qf, i) => {
        const isActive = activeJiraQuickFilters.has(qf.id);
        return (
          <Badge
            key={`qf-${qf.id}`}
            ref={(el: HTMLElement | null) => {
              chipRefs.current[i] = el;
            }}
            variant={isActive ? 'default' : 'outline'}
            role="switch"
            aria-checked={isActive}
            aria-label={
              isActive
                ? `${qf.name} filter active, click to remove`
                : `${qf.name} filter, click to apply`
            }
            tabIndex={i === 0 ? 0 : -1}
            className="cursor-pointer select-none"
            onClick={() => toggleJiraQuickFilter(qf.id)}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                toggleJiraQuickFilter(qf.id);
              }
              handleKeyDown(e, i);
            }}
          >
            {qf.name}
          </Badge>
        );
      })}

      {/* Divider between QF and label chips */}
      {hasQFs && hasLabels && (
        <div className="border-r border-border h-4 mx-0.5" aria-hidden="true" />
      )}

      {/* Label chips */}
      {labels.map((label, j) => {
        const chipIndex = quickFilters.length + j;
        const isActive = activeLabelFilters.has(label);
        return (
          <Badge
            key={`label-${label}`}
            ref={(el: HTMLElement | null) => {
              chipRefs.current[chipIndex] = el;
            }}
            variant={isActive ? 'default' : 'outline'}
            role="switch"
            aria-checked={isActive}
            aria-label={
              isActive
                ? `${label} filter active, click to remove`
                : `${label} filter, click to apply`
            }
            tabIndex={chipIndex === 0 ? 0 : -1}
            className="cursor-pointer select-none"
            onClick={() => toggleLabelFilter(label)}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                toggleLabelFilter(label);
              }
              handleKeyDown(e, chipIndex);
            }}
          >
            {label}
          </Badge>
        );
      })}
    </div>
  );
}
