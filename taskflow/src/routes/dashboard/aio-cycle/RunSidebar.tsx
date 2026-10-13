import type { ReactNode } from 'react';
import { normalizeStatusLabel } from '@/lib/aioUtils';
import { relativeTime } from '@/lib/relative-time';
import { aioRunStatusPillClass, STATUS_PILL_LAYOUT_CLASS, tonePillClass } from '@/lib/statusStyles';
import type { AioTestCaseDetail, AioTestRun } from '@/services/aio';
import { UserChip } from './UserChip';

/** Label/value row — same geometry as the issue/release detail MetaRow (w-28 muted label). */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <dt className="w-28 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-center">{children}</dd>
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
    <section data-testid={testId}>
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <dl className="space-y-2 density-compact:space-y-1 density-comfortable:space-y-3">
        {children}
      </dl>
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
      className="min-w-0 space-y-6 density-compact:space-y-4 density-comfortable:space-y-8"
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
