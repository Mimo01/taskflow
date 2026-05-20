/**
 * DiscussionThreads -- Renders all GitLab MR discussion threads.
 *
 * Supports:
 * - General threaded comments (DiscussionNote type)
 * - Diff/code comments (DiffNote type) with file path + line badge
 * - System notes (compact single-line, muted)
 * - Resolved threads (collapsed by default, expandable)
 * - Reply indentation for thread replies
 */

import { openUrl } from '@tauri-apps/plugin-opener';
import { Activity, CheckCircle2, ChevronDown, ChevronRight, FileCode, Lock } from 'lucide-react';
import { type ComponentPropsWithoutRef, useCallback, useState } from 'react';
import Markdown from 'react-markdown';
import { useLocation, useNavigate } from 'react-router-dom';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { Badge } from '@/components/ui/badge';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { tryInternalPath } from '@/lib/internalLinks';
import type { Discussion, DiscussionNote, MRDiffFile } from '@/services/gitlab';
import { useAuthStore } from '@/stores/auth.store';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';

// ---- Link rewriter for GitLab-relative URLs ----

/** Derives a breadcrumb TrailEntry for the given pathname.
 * Labels mirror the `routeLabel()` mapping in main.tsx so the breadcrumb
 * header is consistent regardless of where the push originates.
 */
function deriveSourceCrumb(pathname: string): { path: string; label: string } {
  // /issue/:key  →  label is the key itself (e.g. "PROJ-123")
  const issueMatch = pathname.match(/^\/issue\/(.+)$/);
  if (issueMatch) return { path: pathname, label: issueMatch[1] };

  // /mr/:projectId/:iid  →  label "!{iid}"
  const mrMatch = pathname.match(/^\/mr\/[^/]+\/(\d+)/);
  if (mrMatch) return { path: pathname, label: `!${mrMatch[1]}` };

  // /aio-cycle/:proj/:cycle/run/:runId  →  label "Run {runId}"
  const aioRunMatch = pathname.match(/^\/aio-cycle\/[^/]+\/[^/]+\/run\/([^/]+)/);
  if (aioRunMatch) return { path: pathname, label: `Run ${aioRunMatch[1]}` };

  // /aio-cycle/:proj/:cycle  →  label is the cycle key (last segment)
  const aioCycleMatch = pathname.match(/^\/aio-cycle\/[^/]+\/([^/]+)/);
  if (aioCycleMatch) return { path: pathname, label: aioCycleMatch[1] };

  // /release/:id  →  "Release"
  if (pathname.startsWith('/release/')) return { path: pathname, label: 'Release' };

  // Static roots — match routeLabel() in main.tsx
  const staticLabels: Record<string, string> = {
    '/sprint-board': 'Sprint Board',
    '/backlog': 'Backlog',
    '/my-tasks': 'My Tasks',
    '/epics': 'Epics',
    '/dashboard': 'Overview',
    '/sprint-progress': 'Sprint Progress',
    '/releases': 'Releases',
    '/merge-requests': 'Merge Requests',
  };
  return { path: pathname, label: staticLabels[pathname] ?? 'Home' };
}

function useGitLabLinkComponents(gitlabBaseUrl?: string) {
  const navigate = useNavigate();
  const location = useLocation();
  const breadcrumbPush = useBreadcrumbStore((s) => s.push);
  const { jiraBaseUrl, activeGitlabProject, activeGitlabProjectPath } = useAuthStore();
  const linkCtx = {
    jiraBaseUrl,
    gitlabBaseUrl: gitlabBaseUrl ?? null,
    activeGitlabProject,
    activeGitlabProjectPath,
  };

  return useCallback(
    () => ({
      a: ({ href, children, ...props }: ComponentPropsWithoutRef<'a'>) => {
        let resolvedHref = href ?? '';
        // Rewrite relative GitLab links to absolute before routing.
        if (resolvedHref.startsWith('/') && gitlabBaseUrl) {
          resolvedHref = `${gitlabBaseUrl.replace(/\/$/, '')}${resolvedHref}`;
        }
        return (
          <a
            {...props}
            href={resolvedHref}
            onClick={(e) => {
              e.preventDefault();
              if (!resolvedHref) return;
              // Try in-app routing first (Jira browse → /issue/:key,
              // GitLab MR → /mr/:projectId/:iid on path match).
              const internalPath = tryInternalPath(resolvedHref, linkCtx);
              if (internalPath !== null) {
                breadcrumbPush(deriveSourceCrumb(location.pathname));
                navigate(internalPath);
                return;
              }
              openUrl(resolvedHref);
            }}
            className="text-primary hover:underline cursor-pointer"
          >
            {children}
          </a>
        );
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      gitlabBaseUrl,
      navigate,
      breadcrumbPush,
      location.pathname,
      linkCtx.jiraBaseUrl,
      linkCtx.activeGitlabProject,
      linkCtx.activeGitlabProjectPath,
    ],
  );
}

// ---- Relative time helper ----

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMs < 60_000) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---- Diff parsing helpers ----

function parseDiffLines(diff: string): Array<{
  type: 'add' | 'remove' | 'context' | 'header';
  content: string;
  oldLine?: number;
  newLine?: number;
}> {
  const lines = diff.split('\n');
  const result: Array<{
    type: 'add' | 'remove' | 'context' | 'header';
    content: string;
    oldLine?: number;
    newLine?: number;
  }> = [];
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = Number.parseInt(match[1], 10);
        newLine = Number.parseInt(match[2], 10);
      }
      result.push({ type: 'header', content: line });
    } else if (line.startsWith('+')) {
      result.push({ type: 'add', content: line.slice(1), newLine });
      newLine++;
    } else if (line.startsWith('-')) {
      result.push({ type: 'remove', content: line.slice(1), oldLine });
      oldLine++;
    } else if (line.startsWith(' ') || line === '') {
      result.push({
        type: 'context',
        content: line.startsWith(' ') ? line.slice(1) : line,
        oldLine,
        newLine,
      });
      oldLine++;
      newLine++;
    }
  }
  return result;
}

function extractCodeContext(
  diffFiles: MRDiffFile[] | undefined,
  filePath: string,
  targetLine: number | null,
  isNewFile: boolean,
): Array<{
  type: 'add' | 'remove' | 'context' | 'header';
  content: string;
  lineNum?: number;
}> | null {
  if (!diffFiles || targetLine === null) return null;

  const file = diffFiles.find((f) =>
    isNewFile ? f.new_path === filePath : f.old_path === filePath,
  );
  if (!file?.diff) return null;

  const parsed = parseDiffLines(file.diff);
  // Find the target line and extract surrounding context (3 lines before/after)
  const targetIdx = parsed.findIndex((l) => {
    if (isNewFile) return (l.type === 'add' || l.type === 'context') && l.newLine === targetLine;
    return (l.type === 'remove' || l.type === 'context') && l.oldLine === targetLine;
  });

  if (targetIdx === -1) return null;

  const CONTEXT = 3;
  const start = Math.max(0, targetIdx - CONTEXT);
  const end = Math.min(parsed.length, targetIdx + CONTEXT + 1);
  const slice = parsed.slice(start, end).filter((l) => l.type !== 'header');

  return slice.map((l) => ({
    type: l.type,
    content: l.content,
    lineNum: isNewFile ? l.newLine : l.oldLine,
  }));
}

// ---- DiffCodePreview ----

function DiffCodePreview({ note, diffFiles }: { note: DiscussionNote; diffFiles?: MRDiffFile[] }) {
  if (!note.position) return null;
  const filePath = note.position.new_path || note.position.old_path;
  const isNewFile = !!note.position.new_line;
  const targetLine = note.position.new_line ?? note.position.old_line;

  const codeLines = extractCodeContext(diffFiles, filePath, targetLine, isNewFile);

  return (
    <div className="rounded-md border bg-muted/30 overflow-hidden mb-2 text-xs">
      {/* File header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b">
        <FileCode className="size-3.5 text-muted-foreground shrink-0" />
        <span className="font-mono text-muted-foreground truncate">{filePath}</span>
        {targetLine !== null && (
          <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0 ml-auto shrink-0">
            L{targetLine}
          </Badge>
        )}
      </div>
      {/* Code lines */}
      {codeLines && codeLines.length > 0 ? (
        <div className="font-mono text-[11px] leading-[1.6] overflow-x-auto">
          <div className="min-w-fit">
            {codeLines.map((line, i) => (
              <div
                key={`${line.lineNum}-${i}`}
                className={`flex ${
                  line.type === 'add'
                    ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                    : line.type === 'remove'
                      ? 'bg-red-500/10 text-red-700 dark:text-red-400'
                      : 'text-muted-foreground'
                }`}
              >
                <span className="w-10 shrink-0 text-right pr-2 select-none opacity-50 border-r border-muted">
                  {line.lineNum ?? ''}
                </span>
                <span className="w-4 shrink-0 text-center select-none opacity-60">
                  {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                </span>
                <span className="px-2 whitespace-pre">{line.content}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="px-3 py-2 text-muted-foreground italic">Line {targetLine}</div>
      )}
    </div>
  );
}

// ---- NoteCard ----

function NoteCard({
  note,
  diffFiles,
  gitlabBaseUrl,
}: {
  note: DiscussionNote;
  diffFiles?: MRDiffFile[];
  gitlabBaseUrl?: string;
}) {
  const components = useGitLabLinkComponents(gitlabBaseUrl);
  return (
    <div className="flex gap-3">
      <div className="shrink-0 mt-0.5">
        <CachedAvatar url={note.author.avatar_url} name={note.author.name} size={24} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm font-semibold leading-none">{note.author.name}</span>
          <span className="text-xs text-muted-foreground">@{note.author.username}</span>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(note.created_at)}
          </span>
          {(note.confidential || note.internal) && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 gap-1 h-4">
              <Lock className="size-2.5" />
              Internal
            </Badge>
          )}
        </div>
        {note.type === 'DiffNote' && <DiffCodePreview note={note} diffFiles={diffFiles} />}
        <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
          <Markdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={components()}
          >
            {note.body}
          </Markdown>
        </div>
      </div>
    </div>
  );
}

// ---- SystemNote ----

function SystemNote({ note, gitlabBaseUrl }: { note: DiscussionNote; gitlabBaseUrl?: string }) {
  const components = useGitLabLinkComponents(gitlabBaseUrl);
  return (
    <div className="flex gap-2 text-xs text-muted-foreground py-1">
      <Activity className="size-3 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 prose prose-xs dark:prose-invert max-w-none [&_p]:my-0.5 [&_ul]:my-0.5 [&_li]:my-0 [&_a]:text-muted-foreground [&_a]:underline">
        <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components()}>
          {note.body}
        </Markdown>
      </div>
      <span className="shrink-0 whitespace-nowrap">{formatRelativeTime(note.created_at)}</span>
    </div>
  );
}

// ---- DiscussionThread ----

function DiscussionThread({
  discussion,
  diffFiles,
  gitlabBaseUrl,
}: {
  discussion: Discussion;
  diffFiles?: MRDiffFile[];
  gitlabBaseUrl?: string;
}) {
  const firstNote = discussion.notes[0];
  const isResolvable = firstNote?.resolvable ?? false;
  const isResolved = isResolvable && (firstNote?.resolved ?? false);

  // Resolved threads — collapsed by default; always call hooks unconditionally
  const [expanded, setExpanded] = useState(!isResolved);

  if (!firstNote) return null;

  // System notes — compact single-line rendering
  if (firstNote.system) {
    return <SystemNote note={firstNote} gitlabBaseUrl={gitlabBaseUrl} />;
  }

  const hasReplies = discussion.notes.length > 1;

  return (
    <div
      className={`rounded-lg border p-4 space-y-3 ${
        isResolvable && !isResolved ? 'border-l-2 border-l-amber-400 dark:border-l-amber-500' : ''
      }`}
    >
      {/* Resolved thread header */}
      {isResolved && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full bg-muted/50 rounded px-3 py-2 cursor-pointer hover:bg-muted flex items-center gap-2 text-sm -mx-0 -mt-0"
        >
          <CheckCircle2 className="size-4 text-green-500 shrink-0" />
          <span className="text-muted-foreground flex-1 text-left">
            Resolved
            {firstNote.resolved_by && ` by ${firstNote.resolved_by.name}`}
          </span>
          {hasReplies && (
            <span className="text-xs text-muted-foreground shrink-0">
              {discussion.notes.length} comment{discussion.notes.length === 1 ? '' : 's'}
            </span>
          )}
          {expanded ? (
            <ChevronDown className="size-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground shrink-0" />
          )}
        </button>
      )}

      {/* Thread content */}
      {expanded && (
        <div className="space-y-3">
          {/* Root note */}
          <NoteCard note={firstNote} diffFiles={diffFiles} gitlabBaseUrl={gitlabBaseUrl} />

          {/* Replies */}
          {hasReplies && (
            <div className="pl-8 border-l-2 border-muted space-y-3 mt-3">
              {discussion.notes
                .slice(1)
                .map((note) =>
                  note.system ? (
                    <SystemNote key={note.id} note={note} gitlabBaseUrl={gitlabBaseUrl} />
                  ) : (
                    <NoteCard
                      key={note.id}
                      note={note}
                      diffFiles={diffFiles}
                      gitlabBaseUrl={gitlabBaseUrl}
                    />
                  ),
                )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- DiscussionThreads (main export) ----

export function DiscussionThreads({
  discussions,
  diffFiles,
  gitlabBaseUrl,
}: {
  discussions: Discussion[];
  diffFiles?: MRDiffFile[];
  gitlabBaseUrl?: string;
}) {
  const [showSystemNotes, setShowSystemNotes] = useState(false);

  if (discussions.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Discussions</h3>
        <p className="text-sm text-muted-foreground italic">No discussions yet</p>
      </div>
    );
  }

  // Count stats
  const nonSystemThreads = discussions.filter((d) => !d.notes[0]?.system);
  const unresolvedCount = nonSystemThreads.filter(
    (d) => d.notes[0]?.resolvable && !d.notes[0]?.resolved,
  ).length;
  const systemNoteCount = discussions.filter((d) => d.notes[0]?.system).length;
  const totalThreads = nonSystemThreads.length;

  const visibleDiscussions = showSystemNotes
    ? discussions
    : discussions.filter((d) => !d.notes[0]?.system);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          Discussions ({totalThreads}
          {unresolvedCount > 0 && (
            <span className="text-amber-600 dark:text-amber-400">
              {' '}
              &mdash; {unresolvedCount} unresolved
            </span>
          )}
          )
        </h3>
        {systemNoteCount > 0 && (
          <button
            type="button"
            onClick={() => setShowSystemNotes((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showSystemNotes ? 'Hide' : 'Show'} {systemNoteCount} system note
            {systemNoteCount === 1 ? '' : 's'}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {visibleDiscussions.map((discussion) => (
          <DiscussionThread
            key={discussion.id}
            discussion={discussion}
            diffFiles={diffFiles}
            gitlabBaseUrl={gitlabBaseUrl}
          />
        ))}
      </div>
    </div>
  );
}
