/// <reference types="vitest/globals" />
import '@testing-library/jest-dom';
import { randomFillSync } from 'node:crypto';

Object.defineProperty(window, 'crypto', {
  value: { getRandomValues: (buf: BufferSource) => randomFillSync(buf as Buffer) },
  configurable: true,
});

// Mock @tauri-apps/plugin-store globally -- LazyStore needs Tauri IPC which
// is unavailable in jsdom. Provide a synchronous in-memory implementation.
vi.mock('@tauri-apps/plugin-store', () => {
  class LazyStore {
    private data = new Map<string, unknown>();
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
  }
  return { LazyStore };
});
