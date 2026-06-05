import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createTauriStorage } from '../lib/tauri-storage';

export interface SubtaskTemplateRow {
  id: string;
  title: string;
  assignee: string | '@inherit' | '@current' | '@unassigned';
  priority: string | null;
  labels: string[];
  duedate: string | null;
  timeEstimate: string;
  storyPoints: number | null;
  components: string[];
  customFieldValues: Record<string, string>;
}

export interface SubtaskTemplate {
  id: string;
  name: string;
  subtaskIssueTypeId: string;
  subtaskIssueTypeName: string;
  rows: SubtaskTemplateRow[];
}

interface SubtaskTemplatesState {
  templates: SubtaskTemplate[];
  addTemplate: (t: SubtaskTemplate) => void;
  removeTemplate: (id: string) => void;
  renameTemplate: (id: string, name: string) => void;
  updateTemplate: (id: string, patch: Partial<SubtaskTemplate>) => void;
  moveTemplate: (id: string, direction: 'up' | 'down' | 'front' | 'back') => void;
}

export const useSubtaskTemplatesStore = create<SubtaskTemplatesState>()(
  persist(
    (set) => ({
      templates: [],
      addTemplate: (t) => set((s) => ({ templates: [...s.templates, t] })),
      removeTemplate: (id) =>
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),
      renameTemplate: (id, name) =>
        set((s) => ({
          templates: s.templates.map((t) => (t.id === id ? { ...t, name } : t)),
        })),
      updateTemplate: (id, patch) =>
        set((s) => ({
          templates: s.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      moveTemplate: (id, direction) =>
        set((s) => {
          const idx = s.templates.findIndex((t) => t.id === id);
          if (idx === -1) return s;
          const arr = [...s.templates];
          const [item] = arr.splice(idx, 1);
          if (direction === 'up') arr.splice(Math.max(0, idx - 1), 0, item);
          else if (direction === 'down') arr.splice(Math.min(arr.length, idx + 1), 0, item);
          else if (direction === 'front') arr.unshift(item);
          else arr.push(item);
          return { templates: arr };
        }),
    }),
    {
      name: 'subtask-templates-store',
      storage: createTauriStorage('subtask-templates.json'),
      version: 1,
      migrate: (persisted, _version) => {
        const p = persisted as Record<string, unknown>;
        if (!Array.isArray(p.templates)) {
          return { templates: [] } as SubtaskTemplatesState;
        }
        const safeTemplates = (p.templates as unknown[]).filter(
          (entry): entry is SubtaskTemplate =>
            typeof entry === 'object' &&
            entry !== null &&
            Array.isArray((entry as SubtaskTemplate).rows),
        );
        return { ...p, templates: safeTemplates } as SubtaskTemplatesState;
      },
    },
  ),
);
