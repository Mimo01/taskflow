/// <reference types="vitest/globals" />
import '@testing-library/jest-dom';
import { randomFillSync } from 'node:crypto';

Object.defineProperty(window, 'crypto', {
  value: { getRandomValues: (buf: BufferSource) => randomFillSync(buf as Buffer) },
  configurable: true,
});

// Mock @tauri-apps/plugin-store globally -- LazyStore needs Tauri IPC which
// is unavailable in jsdom. Provide a synchronous in-memory implementation.
// Instances with the same filename share the same backing store so that
// resetForTesting() in avatarCache.ts and manual test instances see the same data.
vi.mock('@tauri-apps/plugin-store', () => {
  // Global registry: filename -> data map (shared across instances with same name)
  const stores = new Map<string, Map<string, unknown>>();

  class LazyStore {
    private data: Map<string, unknown>;
    constructor(filename: string) {
      if (!stores.has(filename)) {
        stores.set(filename, new Map<string, unknown>());
      }
      this.data = stores.get(filename) as Map<string, unknown>;
    }
    async get<T>(key: string): Promise<T | undefined> {
      return this.data.get(key) as T | undefined;
    }
    async set(key: string, value: unknown): Promise<void> {
      this.data.set(key, value);
    }
    async delete(key: string): Promise<void> {
      this.data.delete(key);
    }
    async save(): Promise<void> {}
    async load(): Promise<void> {}
    async keys(): Promise<string[]> {
      return [...this.data.keys()];
    }
    /** Test helper: clear backing store (simulates app reinstall / fresh state) */
    static clearStore(filename: string): void {
      stores.delete(filename);
    }
  }
  return { LazyStore };
});
