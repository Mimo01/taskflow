import { create } from 'zustand';
import type { ParentCompletionResult } from '../services/jira/parentCompletion';

export type ParentCompletionPrompt = Extract<ParentCompletionResult, { shouldPrompt: true }>;

export interface ParentCompletionEntry {
  prompt: ParentCompletionPrompt;
  jiraBaseUrl: string;
  boardId?: number | null;
}

interface ParentCompletionState {
  /** Pending prompts; the head is the one currently shown. Not persisted. */
  queue: ParentCompletionEntry[];
  enqueue: (entry: ParentCompletionEntry) => void;
  /** Drop the head (the prompt that was just closed); the next one shows. */
  dismiss: () => void;
}

export const useParentCompletionStore = create<ParentCompletionState>((set) => ({
  queue: [],
  enqueue: (entry) =>
    set((s) =>
      s.queue.some((e) => e.prompt.parentKey === entry.prompt.parentKey)
        ? s
        : { queue: [...s.queue, entry] },
    ),
  dismiss: () => set((s) => ({ queue: s.queue.slice(1) })),
}));
