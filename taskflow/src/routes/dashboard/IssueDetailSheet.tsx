import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import type { JiraIssue } from '@/services/jira';
import { fetchEpicStories, fetchIssueDetail } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import type { EditInitialValues } from './CreateEditIssueModal';
import { IssueDetailContent } from './IssueDetailContent';
import { IssueDetailSidebar } from './IssueDetailSidebar';

interface IssueDetailSheetProps {
  issueKey: string | null;
  onClose: () => void;
  onOpenIssue?: (key: string) => void;
  onEdit?: (initialValues: EditInitialValues) => void;
  onAddSubtask?: (parentKey: string) => void;
  /** Whether the current issue is pinned (Plan 03 will add UI for this). */
  isPinned?: boolean;
  /** Toggle pin state for the current issue (Plan 03 will add UI for this). */
  onTogglePin?: (key: string) => void;
}

export function IssueDetailSheet({
  issueKey,
  onClose,
  onOpenIssue,
  onEdit,
  onAddSubtask,
  isPinned,
  onTogglePin,
}: IssueDetailSheetProps) {
  return (
    <Sheet
      open={issueKey !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="p-0 flex flex-col overflow-hidden"
        style={{ width: '75vw', maxWidth: '75vw' }}
      >
        {issueKey && (
          <IssueDetailBody
            data-testid="sheet-open"
            issueKey={issueKey}
            onOpenIssue={onOpenIssue}
            onEdit={onEdit}
            onAddSubtask={onAddSubtask}
            isPinned={isPinned}
            onTogglePin={onTogglePin}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function IssueDetailBody({
  issueKey,
  onOpenIssue,
  onEdit,
  onAddSubtask,
  isPinned,
  onTogglePin,
}: {
  'data-testid'?: string;
  issueKey: string;
  onOpenIssue?: (key: string) => void;
  onEdit?: (initialValues: EditInitialValues) => void;
  onAddSubtask?: (parentKey: string) => void;
  isPinned?: boolean;
  onTogglePin?: (key: string) => void;
}) {
  const { jiraBaseUrl, jiraConnected } = useAuthStore();
  const {
    epicLinkFieldKey,
    epicNameFieldKey,
    sprintFieldKey,
    storyPointsFieldKey,
    epicColorFieldKey,
  } = useSettingsStore();

  const { data: issue, isLoading } = useQuery({
    queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl) throw new Error('No credentials');
      return fetchIssueDetail(jiraBaseUrl, token, issueKey, {
        epicLinkFieldKey,
        epicNameFieldKey,
        sprintFieldKey,
        storyPointsFieldKey,
        epicColorFieldKey,
      });
    },
    staleTime: 30_000,
    enabled: !!issueKey && !!jiraBaseUrl && !!jiraConnected,
  });

  const isEpic = issue?.fields.issuetype.name === 'Epic';

  const { data: epicStories } = useQuery<JiraIssue[]>({
    queryKey: ['jira-epic-stories', issueKey, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl) return [];
      return fetchEpicStories(jiraBaseUrl, token, issueKey, '', storyPointsFieldKey);
    },
    staleTime: 30_000,
    enabled: isEpic && !!jiraBaseUrl && !!jiraConnected,
  });

  if (isLoading || !issue) {
    return <IssueDetailSkeleton data-testid="issue-detail-skeleton" />;
  }

  return (
    <div data-testid="issue-detail-body" className="flex h-full overflow-hidden">
      {/* Left column: ~60% */}
      <div className="flex-1 overflow-auto p-6">
        <IssueDetailContent
          issue={issue}
          issueKey={issueKey}
          jiraBaseUrl={jiraBaseUrl!}
          onOpenIssue={onOpenIssue}
          onEdit={onEdit}
          onAddSubtask={onAddSubtask}
          storyPointsFieldKey={storyPointsFieldKey}
          sprintFieldKey={sprintFieldKey}
          epicLinkFieldKey={epicLinkFieldKey}
          epicStories={epicStories}
          isPinned={isPinned}
          onTogglePin={onTogglePin}
        />
      </div>
      {/* Right sidebar: ~42% */}
      <div className="w-[42%] border-l overflow-auto p-4 shrink-0">
        <IssueDetailSidebar
          issue={issue}
          issueKey={issueKey}
          jiraBaseUrl={jiraBaseUrl!}
          storyPointsFieldKey={storyPointsFieldKey}
          epicLinkFieldKey={epicLinkFieldKey}
          epicNameFieldKey={epicNameFieldKey}
          sprintFieldKey={sprintFieldKey}
          onOpenIssue={onOpenIssue}
        />
      </div>
    </div>
  );
}

function IssueDetailSkeleton({ 'data-testid': testId }: { 'data-testid'?: string }) {
  return (
    <div data-testid={testId ?? 'issue-detail-skeleton'} className="flex h-full p-6 gap-6">
      <div className="flex-1 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-32 w-full" />
      </div>
      <div className="w-[42%] space-y-3">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
      </div>
    </div>
  );
}
