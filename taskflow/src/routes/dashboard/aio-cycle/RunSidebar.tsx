import type { ReactNode } from 'react';
import { normalizeStatusLabel } from '@/lib/aioUtils';
import { relativeTime } from '@/lib/relative-time';
import { aioRunStatusPillClass, STATUS_PILL_LAYOUT_CLASS, tonePillClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import type { AioTestCaseDetail, AioTestRun } from '@/services/aio';
import { RUN_PANEL_CLASS, SectionHeading } from './RunSection';
import { UserChip } from './UserChip';

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
    <section className="space-y-2.5 px-4 py-3" data-testid={testId}>
      <SectionHeading title={title} />
      <dl className="space-y-2">{children}</dl>
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
  jiraBaseUrl,
  token,
}: {
  run: AioTestRun;
  listRun: AioTestRun | undefined;
  testCase: AioTestCaseDetail | undefined;
  jiraBaseUrl: string | null | undefined;
  token: string | null | undefined;
}) {
  const assignee = listRun?.assignedToID;
  const executedBy = run.executedByID && run.executedByID !== assignee ? run.executedByID : null;
  const created = absDate(run.createdDate);

  return (
    <aside
      className={cn(RUN_PANEL_CLASS, 'min-w-0 self-start divide-y divide-border')}
      data-testid="aio-run-sidebar"
    >
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
    </aside>
  );
}
