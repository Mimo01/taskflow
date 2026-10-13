import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { PriorityIcon } from '@/components/ui/priority-icon';
import { Skeleton } from '@/components/ui/skeleton';
import { normalizeStatusLabel } from '@/lib/aioUtils';
import { relativeTime } from '@/lib/relative-time';
import {
  aioRunStatusPillClass,
  STATUS_PILL_LAYOUT_CLASS,
  statusPillClass,
  tonePillClass,
} from '@/lib/statusStyles';
import type { AioTestCaseDetail, AioTestRun } from '@/services/aio';
import type { JiraIssue } from '@/services/jira/types';
import { UserChip } from './UserChip';

export interface SidebarDefect {
  id: string;
  issue: JiraIssue | null;
  isLoading: boolean;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className="flex-none text-xs text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center justify-end text-right">{children}</dd>
    </div>
  );
}

function Group({
  title,
  testId,
  children,
}: {
  title: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2" data-testid={testId}>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <dl className="space-y-1.5">{children}</dl>
    </section>
  );
}

function absDate(iso: string | undefined): string | null {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return null;
  return new Date(iso).toLocaleDateString();
}

export function RunSidebar({
  run,
  listRun,
  testCase,
  defects,
  onOpenDefect,
  cycleHref,
  jiraBaseUrl,
  token,
}: {
  run: AioTestRun;
  listRun: AioTestRun | undefined;
  testCase: AioTestCaseDetail | undefined;
  defects: SidebarDefect[];
  onOpenDefect: (key: string) => void;
  cycleHref: string;
  jiraBaseUrl: string | null | undefined;
  token: string | null | undefined;
}) {
  const assignee = listRun?.assignedToID;
  const executedBy = run.executedByID && run.executedByID !== assignee ? run.executedByID : null;
  const created = absDate(run.createdDate);

  return (
    <aside className="min-w-0 space-y-5" data-testid="aio-run-sidebar">
      <Group title="Run">
        <Row label="Status">
          <span className={aioRunStatusPillClass(run.status)}>
            {normalizeStatusLabel(run.status)}
          </span>
        </Row>
        {assignee && (
          <Row label="Assignee">
            <UserChip userId={assignee} jiraBaseUrl={jiraBaseUrl} token={token} size={20} />
          </Row>
        )}
        {executedBy && (
          <Row label="Executed by">
            <UserChip userId={executedBy} jiraBaseUrl={jiraBaseUrl} token={token} size={20} />
          </Row>
        )}
        {run.executedDate && (
          <Row label="Last updated">
            <span title={absDate(run.executedDate) ?? undefined}>
              {relativeTime(run.executedDate)}
            </span>
          </Row>
        )}
        {created && (
          <Row label="Created">
            <span>{created}</span>
          </Row>
        )}
        {listRun?.runCount != null && (
          <Row label="Runs">
            <span data-testid="aio-run-run-count">×{listRun.runCount}</span>
          </Row>
        )}
      </Group>

      {testCase && (
        <Group title="Test case" testId="aio-run-testcase-meta">
          {testCase.typeName && (
            <Row label="Type">
              <span className="truncate">{testCase.typeName}</span>
            </Row>
          )}
          {testCase.statusName && (
            <Row label="Status">
              <div className="flex">
                <span className={`${STATUS_PILL_LAYOUT_CLASS} ${tonePillClass('muted')}`}>
                  {testCase.statusName}
                </span>
              </div>
            </Row>
          )}
          {testCase.folderName && (
            <Row label="Folder">
              <span className="truncate" title={testCase.folderName}>
                {testCase.folderName}
              </span>
            </Row>
          )}
          {testCase.ownedByID && (
            <Row label="Owner">
              <UserChip
                userId={testCase.ownedByID}
                jiraBaseUrl={jiraBaseUrl}
                token={token}
                size={20}
              />
            </Row>
          )}
          {testCase.version && (
            <Row label="Version">
              <span>{testCase.version}</span>
            </Row>
          )}
          {testCase.customFields.map((f) => (
            <Row key={f.name} label={f.name}>
              <span className="truncate" title={f.value}>
                {f.value}
              </span>
            </Row>
          ))}
        </Group>
      )}

      <NavLink
        to={cycleHref}
        replace
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to cycle
      </NavLink>

      {defects.length > 0 && (
        <section className="space-y-2" data-testid="aio-run-defects-section">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Defects
          </h2>
          <ul className="space-y-1">
            {defects.map((d) => {
              const key = d.issue?.key ?? d.id;
              const clickable = !d.isLoading && !!d.issue;
              return (
                <li
                  key={d.id}
                  className="relative flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted/40"
                >
                  {clickable && (
                    <button
                      type="button"
                      aria-label={`Open defect ${key}`}
                      className="absolute inset-0 cursor-pointer rounded-md"
                      onClick={() => onOpenDefect(key)}
                    />
                  )}
                  {d.issue?.fields.issuetype?.name && (
                    <IssueTypeIcon typeName={d.issue.fields.issuetype.name} />
                  )}
                  <span className="flex-none font-mono text-xs">{key}</span>
                  {d.isLoading ? (
                    <Skeleton className="h-3.5 w-24" />
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {d.issue?.fields.summary ?? ''}
                    </span>
                  )}
                  <PriorityIcon priority={d.issue?.fields.priority} />
                  {d.issue?.fields.status && (
                    <div className="flex flex-none">
                      <span className={statusPillClass(d.issue.fields.status.statusCategory?.key)}>
                        {d.issue.fields.status.name}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </aside>
  );
}
