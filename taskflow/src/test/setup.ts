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

// Mock @tauri-apps/plugin-fs globally -- in-memory byte store keyed by the
// BaseDirectory-relative path (the baseDir option is ignored).
vi.mock('@tauri-apps/plugin-fs', () => {
  const files = new Map<string, Uint8Array>();
  const dirs = new Set<string>();
  const norm = (p: string) => p.replace(/\/+$/, '');
  return {
    BaseDirectory: { AppData: 'AppData' },
    mkdir: async (p: string) => {
      dirs.add(norm(p));
    },
    writeFile: async (p: string, data: Uint8Array) => {
      files.set(norm(p), data);
    },
    readFile: async (p: string) => {
      const d = files.get(norm(p));
      if (!d) throw new Error('No such file');
      return d;
    },
    exists: async (p: string) => files.has(norm(p)) || dirs.has(norm(p)),
    remove: async (p: string, opts?: { recursive?: boolean }) => {
      const k = norm(p);
      files.delete(k);
      dirs.delete(k);
      if (opts?.recursive) {
        for (const f of [...files.keys()]) if (f.startsWith(`${k}/`)) files.delete(f);
        for (const d of [...dirs]) if (d.startsWith(`${k}/`)) dirs.delete(d);
      }
    },
    readDir: async (p: string) => {
      const k = `${norm(p)}/`;
      const out = new Map<string, boolean>();
      for (const f of files.keys()) {
        if (!f.startsWith(k)) continue;
        const rest = f.slice(k.length);
        const i = rest.indexOf('/');
        if (i === -1) out.set(rest, out.get(rest) ?? false);
        else out.set(rest.slice(0, i), true);
      }
      for (const d of dirs) {
        if (d.startsWith(k)) out.set(d.slice(k.length).split('/')[0], true);
      }
      return [...out].map(([name, isDirectory]) => ({
        name,
        isDirectory,
        isFile: !isDirectory,
        isSymlink: false,
      }));
    },
  };
});

// ResizeObserver mock — required for Recharts ResponsiveContainer in jsdom.
// jsdom never lays out elements, so a real observer would report 0x0 and
// Recharts would refuse to render its SVG surface. This mock matches the real
// `new ResizeObserver(callback)` signature, stores the callback, and on
// observe() synchronously delivers a non-zero contentRect so charts mount.
global.ResizeObserver = class ResizeObserver {
  constructor(private cb: ResizeObserverCallback) {}
  observe(target: Element) {
    const contentRect = { width: 600, height: 400 } as DOMRectReadOnly;
    this.cb([{ target, contentRect } as ResizeObserverEntry], this);
  }
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

// cmdk calls scrollIntoView on the highlighted item; jsdom does not implement it.
Element.prototype.scrollIntoView = () => {};
