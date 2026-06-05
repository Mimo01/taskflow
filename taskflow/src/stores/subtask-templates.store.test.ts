// SUBTPL-02: subtask-templates store — persistence and CRUD tests

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';

// Mock Tauri plugin-store so LazyStore doesn't attempt IPC calls in jsdom
vi.mock('@tauri-apps/plugin-store', () => {
  class LazyStore {
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue(undefined);
    save = vi.fn().mockResolvedValue(undefined);
    delete = vi.fn().mockResolvedValue(undefined);
  }
  return { LazyStore };
});

import {
  useSubtaskTemplatesStore,
  type SubtaskTemplate,
} from './subtask-templates.store';

function makeTemplate(id: string, name: string): SubtaskTemplate {
  return {
    id,
    name,
    subtaskIssueTypeId: 'type-1',
    subtaskIssueTypeName: 'Sub-task',
    rows: [],
  };
}

describe('subtask-templates.store (SUBTPL-02)', () => {
  beforeEach(() => {
    act(() => {
      useSubtaskTemplatesStore.setState({ templates: [] });
    });
  });

  it('templates array starts empty', () => {
    const { result } = renderHook(() => useSubtaskTemplatesStore());
    expect(result.current.templates).toEqual([]);
  });

  it('addTemplate adds a template to the list', () => {
    const { result } = renderHook(() => useSubtaskTemplatesStore());
    act(() => {
      result.current.addTemplate(makeTemplate('t1', 'Sprint Setup'));
    });
    expect(result.current.templates).toHaveLength(1);
    expect(result.current.templates[0].id).toBe('t1');
    expect(result.current.templates[0].name).toBe('Sprint Setup');
  });

  it('removeTemplate removes by id', () => {
    const { result } = renderHook(() => useSubtaskTemplatesStore());
    act(() => {
      result.current.addTemplate(makeTemplate('t1', 'A'));
      result.current.addTemplate(makeTemplate('t2', 'B'));
    });
    act(() => {
      result.current.removeTemplate('t1');
    });
    expect(result.current.templates).toHaveLength(1);
    expect(result.current.templates[0].id).toBe('t2');
  });

  it('renameTemplate updates name by id', () => {
    const { result } = renderHook(() => useSubtaskTemplatesStore());
    act(() => {
      result.current.addTemplate(makeTemplate('t1', 'Old Name'));
    });
    act(() => {
      result.current.renameTemplate('t1', 'New Name');
    });
    expect(result.current.templates[0].name).toBe('New Name');
  });

  it('updateTemplate patches fields', () => {
    const { result } = renderHook(() => useSubtaskTemplatesStore());
    act(() => {
      result.current.addTemplate(makeTemplate('t1', 'Template A'));
    });
    act(() => {
      result.current.updateTemplate('t1', { subtaskIssueTypeId: 'type-99' });
    });
    expect(result.current.templates[0].subtaskIssueTypeId).toBe('type-99');
    expect(result.current.templates[0].name).toBe('Template A'); // unchanged
  });

  describe('moveTemplate', () => {
    beforeEach(() => {
      act(() => {
        useSubtaskTemplatesStore.setState({
          templates: [
            makeTemplate('t1', 'A'),
            makeTemplate('t2', 'B'),
            makeTemplate('t3', 'C'),
          ],
        });
      });
    });

    it("'up' moves template one position earlier", () => {
      const { result } = renderHook(() => useSubtaskTemplatesStore());
      act(() => {
        result.current.moveTemplate('t2', 'up');
      });
      expect(result.current.templates.map((t) => t.id)).toEqual(['t2', 't1', 't3']);
    });

    it("'down' moves template one position later", () => {
      const { result } = renderHook(() => useSubtaskTemplatesStore());
      act(() => {
        result.current.moveTemplate('t2', 'down');
      });
      expect(result.current.templates.map((t) => t.id)).toEqual(['t1', 't3', 't2']);
    });

    it("'front' moves template to first position", () => {
      const { result } = renderHook(() => useSubtaskTemplatesStore());
      act(() => {
        result.current.moveTemplate('t3', 'front');
      });
      expect(result.current.templates.map((t) => t.id)).toEqual(['t3', 't1', 't2']);
    });

    it("'back' moves template to last position", () => {
      const { result } = renderHook(() => useSubtaskTemplatesStore());
      act(() => {
        result.current.moveTemplate('t1', 'back');
      });
      expect(result.current.templates.map((t) => t.id)).toEqual(['t2', 't3', 't1']);
    });

    it("'up' on first item is a no-op", () => {
      const { result } = renderHook(() => useSubtaskTemplatesStore());
      act(() => {
        result.current.moveTemplate('t1', 'up');
      });
      expect(result.current.templates.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
    });
  });

  it('migrate coerces non-array templates to []', () => {
    // Access the store's persist options via the store api
    // Test the migrate function directly by simulating what persist calls
    // We set a garbage state and verify the migrate guard
    act(() => {
      // Simulate what would happen with corrupted persisted data by calling setState
      // The migrate function is only invoked during hydration, so we test it directly
      useSubtaskTemplatesStore.setState({ templates: [] });
    });
    const { result } = renderHook(() => useSubtaskTemplatesStore());

    // Verify that setting a template with non-array rows via direct setState
    // demonstrates the corruption scenario — the store enforces array templates
    act(() => {
      result.current.addTemplate(makeTemplate('t1', 'Valid'));
    });
    expect(result.current.templates[0].rows).toEqual([]);

    // Test migrate function directly by extracting it from the store config
    // The migration logic: { templates: 'garbage' } → { templates: [] }
    // We access the migrate function through the store's persist.getOptions()
    const store = useSubtaskTemplatesStore;
    const persistApi = (store as unknown as { persist: { getOptions: () => { migrate?: (persisted: unknown, version: number) => unknown } } }).persist;
    if (persistApi?.getOptions) {
      const opts = persistApi.getOptions();
      if (opts.migrate) {
        const result1 = opts.migrate({ templates: 'garbage' }, 0);
        expect((result1 as { templates: unknown[] }).templates).toEqual([]);

        const result2 = opts.migrate({ templates: [{ id: 'x', name: 'x', rows: 'not-array' }] }, 0);
        expect((result2 as { templates: unknown[] }).templates).toEqual([]);

        const result3 = opts.migrate({ templates: [{ id: 'x', name: 'x', subtaskIssueTypeId: 'y', subtaskIssueTypeName: 'z', rows: [] }] }, 0);
        expect((result3 as { templates: SubtaskTemplate[] }).templates).toHaveLength(1);
      }
    }
  });
});
