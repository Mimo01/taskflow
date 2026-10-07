import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { Input } from '@/components/ui/input';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { statusPillClass } from '@/lib/statusStyles';
import { type IssueLinkType, type JiraIssue, searchJiraForLink } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface IssueLinkRowValue {
  id: string; // uuid for stable React key (use crypto.randomUUID())
  linkTypeId: string;
  issueKey: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function useDebounce<T extends unknown[]>(fn: (...args: T) => void, delay: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  return (...args: T) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fnRef.current(...args), delay);
  };
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface IssueLinkRowProps {
  linkTypes: IssueLinkType[];
  value: IssueLinkRowValue;
  onChange: (v: IssueLinkRowValue) => void;
  onRemove: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function IssueLinkRow({ linkTypes, value, onChange, onRemove }: IssueLinkRowProps) {
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();
  const projectKey = activeJiraProject ?? '';

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  // Full issue for the chip; the form only stores the key.
  const [selectedIssue, setSelectedIssue] = useState<JiraIssue | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const debouncedSetQuery = useDebounce((q: string) => setDebouncedQuery(q), 250);

  const trimmed = debouncedQuery.trim();
  const { data: searchResults = [], isFetching } = useQuery<JiraIssue[]>({
    queryKey: ['jira-link-search', jiraBaseUrl, projectKey, trimmed],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !projectKey) return [];
      return searchJiraForLink(jiraBaseUrl, token, projectKey, trimmed);
    },
    enabled: !!trimmed && !!jiraBaseUrl && !!projectKey,
    staleTime: 30 * 1000,
    // Keep the previous list visible while the next one loads (no flicker).
    placeholderData: keepPreviousData,
  });

  // Typing but the debounce/fetch hasn't landed yet.
  const pending = searchQuery.trim() !== trimmed || isFetching;
  const hasQuery = !!searchQuery.trim();
  const open = showDropdown && hasQuery;

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset highlight when the list changes
  useEffect(() => {
    setActiveIndex(0);
  }, [searchResults]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setSearchQuery(q);
    setShowDropdown(true);
    debouncedSetQuery(q);
  }

  function handleSelectIssue(issue: JiraIssue) {
    onChange({ ...value, issueKey: issue.key });
    setSelectedIssue(issue);
    setSearchQuery('');
    setDebouncedQuery('');
    setShowDropdown(false);
  }

  function handleClear() {
    onChange({ ...value, issueKey: '' });
    setSelectedIssue(null);
    // Focus after the input re-mounts.
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape' && open) {
      // Close the list only — don't let Escape dismiss the whole modal.
      e.preventDefault();
      e.stopPropagation();
      setShowDropdown(false);
      return;
    }
    if (!open || searchResults.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % searchResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === 'Enter') {
      // Enter must pick the highlighted result, never submit the issue form.
      e.preventDefault();
      e.stopPropagation();
      const issue = searchResults[activeIndex];
      if (issue) handleSelectIssue(issue);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Link type dropdown */}
      <Select
        value={value.linkTypeId}
        items={linkTypes.map((lt) => ({ value: lt.id, label: lt.outward }))}
        onValueChange={(v) => onChange({ ...value, linkTypeId: v ?? '' })}
      >
        <SelectTrigger className="w-auto min-w-36 max-w-[45%] shrink-0">
          <SelectValue className="min-w-0 truncate" placeholder="Link type" />
        </SelectTrigger>
        <SelectContent className="w-auto min-w-(--anchor-width)">
          {linkTypes.map((lt) => (
            <SelectItem key={lt.id} value={lt.id}>
              {lt.outward}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Target issue: chip once chosen, otherwise search input + results */}
      <div ref={inputWrapRef} className="relative min-w-0 flex-1">
        {value.issueKey ? (
          <div className="flex h-8 items-center gap-2 rounded-lg border border-input px-2.5 text-sm">
            {selectedIssue && (
              <IssueTypeIcon typeName={selectedIssue.fields.issuetype?.name ?? ''} />
            )}
            <span className="shrink-0 font-medium">{value.issueKey}</span>
            {selectedIssue && (
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {selectedIssue.fields.summary}
              </span>
            )}
            <button
              type="button"
              aria-label="Change linked issue"
              className="ml-auto shrink-0 rounded p-0.5 hover:bg-accent"
              onClick={handleClear}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <Input
            ref={inputRef}
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => {
              if (searchQuery) setShowDropdown(true);
            }}
            onBlur={() => setShowDropdown(false)}
            onKeyDown={handleKeyDown}
            placeholder="Search by key or title…"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
          />
        )}
        {/* Popup is portaled + collision-aware (flips/clamps to the viewport) and is part of
            the dialog's floating tree, so clicks in it don't dismiss the modal. Rows use
            onMouseDown+preventDefault so the input keeps focus (no blur-timeout hack). */}
        <PopoverPrimitive.Root open={open && !value.issueKey}>
          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Positioner
              anchor={inputWrapRef}
              side="bottom"
              align="start"
              sideOffset={4}
              collisionPadding={8}
              className="z-[100]"
            >
              <PopoverPrimitive.Popup
                initialFocus={false}
                finalFocus={false}
                className="max-h-[min(18rem,var(--available-height))] w-(--anchor-width) min-w-[min(22rem,var(--available-width))] overflow-y-auto rounded border bg-background shadow-md outline-none"
              >
                <div ref={listRef} role="listbox">
                  {searchResults.map((issue, i) => (
                    <div
                      key={issue.key}
                      role="option"
                      tabIndex={-1}
                      aria-selected={i === activeIndex}
                      data-index={i}
                      className={`cursor-pointer px-3 py-1.5 ${i === activeIndex ? 'bg-accent' : ''}`}
                      onMouseEnter={() => setActiveIndex(i)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectIssue(issue);
                      }}
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <IssueTypeIcon typeName={issue.fields.issuetype?.name ?? ''} />
                        <span className="shrink-0 font-medium">{issue.key}</span>
                        <span className="min-w-0 flex-1 truncate">{issue.fields.summary}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        {issue.fields.status && (
                          <div className="flex shrink-0">
                            <span
                              className={statusPillClass(issue.fields.status.statusCategory?.key)}
                            >
                              {issue.fields.status.name}
                            </span>
                          </div>
                        )}
                        <CachedAvatar
                          url={issue.fields.assignee?.avatarUrls?.['48x48']}
                          name={issue.fields.assignee?.displayName ?? 'Unassigned'}
                          size={16}
                        />
                        <span className="min-w-0 truncate">
                          {issue.fields.assignee?.displayName ?? 'Unassigned'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {searchResults.length === 0 && (
                    <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                      {pending ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
                        </>
                      ) : (
                        'No issues found'
                      )}
                    </div>
                  )}
                </div>
              </PopoverPrimitive.Popup>
            </PopoverPrimitive.Positioner>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
      </div>

      {/* Remove button */}
      <button
        type="button"
        aria-label="Remove link"
        className="shrink-0 rounded p-1 hover:bg-accent"
        onClick={onRemove}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
