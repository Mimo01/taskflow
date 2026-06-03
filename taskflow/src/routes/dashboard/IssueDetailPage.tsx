/**
 * IssueDetailPage -- Full-page route-based issue detail view at /issue/:key.
 *
 * Thin wrapper: reads route params + outlet context, renders the breadcrumb
 * header, and delegates everything else to IssueDetailView (two-column layout).
 *
 * All queries/mutations now live in IssueDetailView so the peek panel (Plan 03)
 * can reuse the same full-detail body (D-05 override).
 */

import { ArrowLeft } from 'lucide-react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';
import type { EditInitialValues } from './CreateEditIssueModal';
import { IssueDetailView } from './IssueDetailView';

export default function IssueDetailPage() {
  const { key: issueKey } = useParams<{ key: string }>();
  const navigate = useNavigate();

  const trail = useBreadcrumbStore((s) => s.trail);
  const breadcrumbPop = useBreadcrumbStore((s) => s.pop);

  const { onIssueClick, openEdit, openClone, openAddSubtask } = useOutletContext<{
    onIssueClick: (key: string) => void;
    openEdit: (vals: EditInitialValues) => void;
    openClone: (vals: EditInitialValues) => void;
    openAddSubtask: (parentKey: string) => void;
  }>();
  // NOTE: `onOpenIssue` is also provided in the outlet context (main.tsx wires it to
  // handleOpenPeek), but is intentionally NOT consumed here. On the full-page route,
  // clicking a child issue (subtask, epic story, linked issue) should navigate full-page
  // via `onIssueClick`, not open a secondary peek panel. The peek-inside-peek swap behavior
  // (D-13) is only active when the caller is PeekPanel, which passes onOpenIssue directly.
  // Leaving onOpenIssue unused here is a deliberate product choice, not a wiring bug.

  const handleBack = () => {
    if (trail.length > 0) {
      const target = trail[trail.length - 1];
      breadcrumbPop();
      navigate(target.path, { replace: true });
    } else {
      navigate('/dashboard');
    }
  };

  if (!issueKey) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Back + breadcrumb header — only shown when there's a trail */}
      {trail.length > 0 && (
        <div className="px-6 py-3 border-b flex items-center gap-2 text-sm flex-shrink-0">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted"
            aria-label="Go back"
          >
            <ArrowLeft className="size-4" />
          </button>
          {trail.map((entry, i) => (
            <span key={entry.path} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted-foreground">/</span>}
              <button
                type="button"
                onClick={() => {
                  useBreadcrumbStore.setState({ trail: trail.slice(0, i) });
                  navigate(entry.path, { replace: true });
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                {entry.label}
              </button>
            </span>
          ))}
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{issueKey}</span>
        </div>
      )}

      <IssueDetailView
        issueKey={issueKey}
        layout="two-column"
        onOpenIssue={onIssueClick}
        onEdit={openEdit}
        onClone={openClone}
        onAddSubtask={openAddSubtask}
      />
    </div>
  );
}
