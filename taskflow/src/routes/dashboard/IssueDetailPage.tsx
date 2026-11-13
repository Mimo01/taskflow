/**
 * IssueDetailPage -- Full-page route-based issue detail view at /issue/:key.
 *
 * Thin wrapper: reads route params + outlet context, hands the breadcrumb trail to the
 * issue header (back button + trail in its meta row), and delegates everything else to
 * IssueDetailView (two-column layout).
 *
 * All queries/mutations now live in IssueDetailView so the peek panel (Plan 03)
 * can reuse the same full-detail body (D-05 override).
 */

import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';
import type { EditInitialValues } from './CreateEditIssueModal';
import { IssueDetailView } from './IssueDetailView';
import type { HeaderNav } from './issue-detail/IssueDetailHeader';

export default function IssueDetailPage() {
  const { key: issueKey } = useParams<{ key: string }>();
  const navigate = useNavigate();

  const trail = useBreadcrumbStore((s) => s.trail);
  const breadcrumbPop = useBreadcrumbStore((s) => s.pop);

  const { onIssueClick, openEdit, openClone, openAddSubtask, openAddEpicStory } = useOutletContext<{
    onIssueClick: (key: string) => void;
    openEdit: (vals: EditInitialValues) => void;
    openClone: (vals: EditInitialValues) => void;
    openAddSubtask: (parentKey: string) => void;
    openAddEpicStory: (epicKey: string) => void;
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

  // Back + trail live in the header's meta row (no separate bar); shown only with a trail.
  const headerNav: HeaderNav | undefined =
    trail.length > 0
      ? {
          trail,
          onBack: handleBack,
          onNavigate: (i) => {
            const entry = trail[i];
            if (!entry) return;
            useBreadcrumbStore.setState({ trail: trail.slice(0, i) });
            navigate(entry.path, { replace: true });
          },
        }
      : undefined;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <IssueDetailView
        issueKey={issueKey}
        layout="two-column"
        onOpenIssue={onIssueClick}
        onEdit={openEdit}
        onClone={openClone}
        onAddSubtask={openAddSubtask}
        onAddEpicStory={openAddEpicStory}
        headerNav={headerNav}
      />
    </div>
  );
}
