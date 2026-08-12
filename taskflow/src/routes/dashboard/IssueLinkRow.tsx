import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type IssueLinkType, type JiraIssue, searchJira } from '@/services/jira';
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

  // Update debouncedQuery after 300ms
  const applyDebounce = (q: string) => {
    setDebouncedQuery(q);
  };

  const debouncedSetQuery = useDebounce(applyDebounce, 300);

  // Issue search query — fires when debouncedQuery has content
  const { data: searchResults = [] } = useQuery<JiraIssue[]>({
    queryKey: ['jira-search', jiraBaseUrl, projectKey, debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return [];
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !projectKey) return [];
      return searchJira(jiraBaseUrl, token, projectKey, debouncedQuery);
    },
    enabled: !!debouncedQuery.trim() && !!jiraBaseUrl && !!projectKey,
    staleTime: 30 * 1000,
  });

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setSearchQuery(q);
    setShowDropdown(true);
    debouncedSetQuery(q);
  }

  function handleSelectIssue(issue: JiraIssue) {
    onChange({ ...value, issueKey: issue.key });
    setSearchQuery('');
    setDebouncedQuery('');
    setShowDropdown(false);
  }

  const displayValue = value.issueKey ? value.issueKey : searchQuery;

  return (
    <div className="flex items-center gap-2">
      {/* Link type dropdown */}
      <Select
        value={value.linkTypeId}
        onValueChange={(v) => onChange({ ...value, linkTypeId: v ?? '' })}
      >
        <SelectTrigger className="w-36 shrink-0">
          <SelectValue placeholder="Link type" />
        </SelectTrigger>
        <SelectContent>
          {linkTypes.map((lt) => (
            <SelectItem key={lt.id} value={lt.id}>
              {lt.outward}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Issue search input + dropdown */}
      <div className="relative flex-1">
        <Input
          value={displayValue}
          onChange={handleSearchChange}
          onFocus={() => {
            if (searchQuery) setShowDropdown(true);
          }}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder="Search issue..."
        />
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded border bg-background shadow-md max-h-48 overflow-y-auto">
            {searchResults.map((issue) => (
              <button
                key={issue.key}
                type="button"
                className="w-full px-3 py-2 density-compact:py-1 density-comfortable:py-3 text-left text-sm hover:bg-accent"
                onMouseDown={() => handleSelectIssue(issue)}
              >
                {issue.key}: {issue.fields.summary}
              </button>
            ))}
          </div>
        )}
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
