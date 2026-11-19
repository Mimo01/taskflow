/**
 * NotificationsTab — OS desktop notification attempts for Developer Tools.
 *
 * One row per notification the poller tried to show (or skipped as already known, or held
 * back as launch catch-up), with the exact title/body handed to the OS and the result. A burst
 * folded into one summary banner appears as a 'summary' row followed by one 'Grouped' row per
 * folded item. Select a row for a banner-style preview and the raw item.
 */
import { Bell, Bug } from 'lucide-react';
import AppIcon from '../../components/app/AppIcon';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { FilterPopover } from '../../components/ui/table-filter-sort';
import { filterNotificationEntries } from '../../lib/dev-tools/entry-filters';
import { safeStringify } from '../../lib/dev-tools/json-preview';
import type { OsDispatchOutcome } from '../../lib/notification-dispatch-log';
import { cn } from '../../lib/utils';
import {
  type NotificationDispatchLogEntry,
  useNotificationDispatchLogStore,
} from '../../stores/notification-dispatch-log.store';
import { useSettingsStore } from '../../stores/settings.store';
import {
  CopyMenu,
  InspectorSection,
  isTabStop,
  ListRow,
  ToolbarSearch,
  useListKeyboard,
} from './dev-tools-ui';
import { facetSetter, NOTIFICATION_FACETS, useDevToolsViewStore } from './dev-tools-view.store';
import JsonTree from './JsonTree';
import ListInspectorLayout, { InspectorMaximizeButton } from './ListInspectorLayout';
import { sourceBadgeClass } from './utils';

const OUTCOME_LABEL: Record<OsDispatchOutcome, string> = {
  sent: 'Sent',
  denied: 'Denied',
  error: 'Error',
  skipped: 'Skipped',
  grouped: 'Grouped',
  'catch-up': 'Catch-up',
};

const OUTCOMES = Object.keys(OUTCOME_LABEL) as OsDispatchOutcome[];

/** Status colour as text only: green sent, muted for not-sent-by-design, red for failures. */
function outcomeClass(outcome: OsDispatchOutcome): string {
  if (outcome === 'sent') return 'text-green-600 dark:text-green-400';
  if (outcome === 'skipped' || outcome === 'grouped' || outcome === 'catch-up')
    return 'text-muted-foreground';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Approximation of a macOS notification banner: app icon, bold one-line title, body clamped
 * to two lines — roughly what the OS shows before the user expands it.
 */
function OsNotificationPreview({ title, body }: { title: string; body: string }) {
  return (
    <div
      role="img"
      aria-label={`Notification preview: ${title}. ${body}`}
      className="w-[23rem] max-w-full flex items-start gap-3 rounded-2xl border border-border bg-card p-3 shadow-md"
    >
      <AppIcon className="size-9 shrink-0 -m-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="text-[13px] font-semibold leading-snug truncate flex-1 min-w-0">{title}</p>
          <span className="shrink-0 text-[11px] text-muted-foreground">now</span>
        </div>
        <p className="text-[13px] leading-snug line-clamp-2 break-words">{body}</p>
      </div>
    </div>
  );
}

function NotificationInspector({ entry }: { entry: NotificationDispatchLogEntry }) {
  return (
    <div data-testid="notification-inspector">
      <div className="flex items-center justify-end gap-1 border-b px-4 py-2">
        <CopyMenu
          items={[
            { label: 'Copy entry as JSON', getText: () => safeStringify(entry) },
            { label: 'Copy title and body', getText: () => `${entry.title}\n${entry.body}` },
          ]}
        />
        <InspectorMaximizeButton />
      </div>
      <InspectorSection title="Banner">
        <div className="flex flex-col gap-3">
          {entry.outcome === 'skipped' && (
            <p className="text-sm text-muted-foreground">
              Not sent: this notification was already in the list before this poll.
            </p>
          )}
          {entry.outcome === 'grouped' && (
            <p className="text-sm text-muted-foreground">
              Not sent individually: folded into a summary banner.
            </p>
          )}
          {entry.outcome === 'catch-up' && (
            <p className="text-sm text-muted-foreground">
              Not sent: the first check after launch only catches up on what arrived while the app
              was closed.
            </p>
          )}
          <OsNotificationPreview title={entry.title} body={entry.body} />
        </div>
      </InspectorSection>
      <InspectorSection title={entry.kind === 'summary' ? 'Raw items' : 'Raw item'}>
        <JsonTree value={entry.kind === 'summary' ? entry.items : entry.item} />
      </InspectorSection>
    </div>
  );
}

export default function NotificationsTab() {
  const entries = useNotificationDispatchLogStore((s) => s.entries);
  const devToolsEnabled = useSettingsStore((s) => s.devToolsEnabled);
  const desktopNotificationsEnabled = useSettingsStore((s) => s.desktopNotificationsEnabled);

  const { selectedId, search } = useDevToolsViewStore((s) => s.tabs.notifications);
  const outcomes = useDevToolsViewStore((s) => s.notificationOutcomes);
  const setSelected = useDevToolsViewStore((s) => s.setSelected);
  const setSearch = useDevToolsViewStore((s) => s.setSearch);

  const filtered = filterNotificationEntries(entries, { search, outcomes });
  const ids = filtered.map((e) => e.id);
  const selected = filtered.find((e) => e.id === selectedId) ?? null;
  const onKeyDown = useListKeyboard(ids, selectedId, (id) => setSelected('notifications', id));

  if (!devToolsEnabled) {
    return (
      <EmptyState
        fill
        icon={Bug}
        title="Developer Tools are disabled"
        subtitle="Enable them in Settings → Advanced."
      />
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        fill
        icon={Bell}
        title="No desktop notifications yet"
        subtitle={
          desktopNotificationsEnabled
            ? 'Entries appear here when a poll brings in a new notification.'
            : 'Turn on Desktop Notifications in Settings to capture them here.'
        }
      />
    );
  }

  return (
    <ListInspectorLayout
      toolbar={
        <>
          <ToolbarSearch
            value={search}
            onChange={(v) => setSearch('notifications', v)}
            placeholder="Search notifications"
          />
          <FilterPopover
            dimension="Outcome"
            testId="notifications-filter-outcome"
            options={OUTCOMES}
            selected={outcomes}
            setSelected={facetSetter('notificationOutcomes', outcomes)}
            formatOption={(v) => OUTCOME_LABEL[v as OsDispatchOutcome]}
          />
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="ml-auto"
            onClick={() => {
              useNotificationDispatchLogStore.getState().clear();
              setSelected('notifications', null);
              useDevToolsViewStore.getState().resetFacets(NOTIFICATION_FACETS);
            }}
          >
            Clear
          </Button>
        </>
      }
      onKeyDown={onKeyDown}
      emptyTitle="Select a notification"
      list={
        filtered.length === 0 ? (
          <EmptyState compact icon={Bell} title="No notifications match the filters" />
        ) : (
          <div>
            {filtered.map((entry) => (
              <ListRow
                key={entry.id}
                selected={entry.id === selectedId}
                tabStop={isTabStop(ids, selectedId, entry.id)}
                onSelect={() => setSelected('notifications', entry.id)}
                label={`${OUTCOME_LABEL[entry.outcome]}: ${entry.title}`}
                title={`${entry.title}\n${entry.body}`}
              >
                <span className={cn('w-16 flex-none font-semibold', outcomeClass(entry.outcome))}>
                  {OUTCOME_LABEL[entry.outcome]}
                </span>
                {entry.kind === 'summary' ? (
                  <span className="w-14 flex-none text-center text-muted-foreground">summary</span>
                ) : (
                  <span
                    className={cn(
                      sourceBadgeClass(entry.item.source),
                      'w-14 flex-none text-center',
                    )}
                  >
                    {entry.item.source}
                  </span>
                )}
                <span className="min-w-0 flex-[0_1_auto] truncate font-medium">{entry.title}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{entry.body}</span>
                <span className="w-20 flex-none text-right tabular-nums text-muted-foreground">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </ListRow>
            ))}
          </div>
        )
      }
      inspector={selected ? <NotificationInspector entry={selected} /> : null}
    />
  );
}
