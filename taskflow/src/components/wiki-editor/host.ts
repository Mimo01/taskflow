import type { QueryClient } from '@tanstack/react-query';
import { type Editor, Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { useSyncExternalStore } from 'react';
import type { WikiEditorHost } from './types';

/** Transaction meta set when the issue/project prefix changes (decoration plan listens). */
export const WIKI_HOST_META = 'wikiHostChanged';

export interface ResolvedHost extends WikiEditorHost {
  attachments: readonly NonNullable<WikiEditorHost['attachments']>[number][];
  userMap: Readonly<Record<string, string>>;
  staged: boolean;
  queryClient?: QueryClient;
}

const EMPTY_ATTACHMENTS: ResolvedHost['attachments'] = [];
const EMPTY_MAP: Readonly<Record<string, string>> = {};

function resolve(host: WikiEditorHost | undefined, queryClient?: QueryClient): ResolvedHost {
  return {
    ...host,
    attachments: host?.attachments ?? EMPTY_ATTACHMENTS,
    userMap: host?.userMap ?? EMPTY_MAP,
    staged: host?.staged ?? false,
    queryClient,
  };
}

function sameHost(a: ResolvedHost, b: ResolvedHost): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof ResolvedHost>;
  for (const k of keys) if (a[k] !== b[k]) return false;
  return true;
}

export interface HostStore {
  get(): ResolvedHost;
  set(host: WikiEditorHost | undefined, queryClient: QueryClient | undefined): void;
  subscribe(fn: () => void): () => void;
  /** Local blob previews keyed by filename (staged/uploading images). */
  previews: Map<string, string>;
  /** Snapshot token for previews; changes on every preview write. */
  previewVersion(): number;
  setPreview(name: string, url: string): void;
  revokeAll(): void;
  /** Bound by a plugin view so `set` can dispatch the prefix-change transaction. */
  bindEditor(editor: Editor | null): void;
}

// State lives in closure variables: tiptap may copy the storage object, so never keep
// mutable fields as properties of it.
function createHostStore(): HostStore {
  let current = resolve(undefined);
  let version = 0;
  let bound: Editor | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const fn of listeners) fn();
  };
  const store: HostStore = {
    bindEditor(editor) {
      bound = editor;
    },
    previews: new Map(),
    get: () => current,
    previewVersion: () => version,
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    set(host, queryClient) {
      const next = resolve(host, queryClient);
      if (sameHost(current, next)) return;
      const prefixChanged =
        current.projectKey !== next.projectKey || current.issueKey !== next.issueKey;
      current = next;
      notify();
      const ed = bound;
      if (prefixChanged && ed && !ed.isDestroyed) {
        ed.view.dispatch(ed.state.tr.setMeta(WIKI_HOST_META, true).setMeta('addToHistory', false));
      }
    },
    setPreview(name, url) {
      store.previews.set(name, url);
      version += 1;
      current = { ...current };
      notify();
    },
    revokeAll() {
      for (const url of store.previews.values()) {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      }
      store.previews.clear();
    },
  };
  return store;
}

declare module '@tiptap/core' {
  interface Storage {
    wikiHost: HostStore;
  }
}

/** Per-editor host store, readable from module-scope extensions and node views. */
export const WikiHostBridge = Extension.create<unknown, HostStore>({
  name: 'wikiHost',
  addStorage() {
    return createHostStore();
  },
  addProseMirrorPlugins() {
    const editor = this.editor;
    const store = editor.storage.wikiHost;
    return [
      new Plugin({
        key: new PluginKey('wikiHost'),
        view: () => {
          store.bindEditor(editor);
          return {};
        },
      }),
    ];
  },
  onDestroy() {
    this.editor.storage.wikiHost.revokeAll();
  },
});

export function getHost(editor: Editor): ResolvedHost {
  return editor.storage.wikiHost.get();
}

/** Reactive read for node views: re-renders when the host or a preview changes. */
export function useHost(editor: Editor): ResolvedHost {
  const store = editor.storage.wikiHost;
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** False when the editor is gone (tiptap resets storage to {} on destroy); callers may retry. */
export function setLocalPreview(editor: Editor, name: string, url: string): boolean {
  const store = editor.isDestroyed ? undefined : editor.storage.wikiHost;
  if (!store) return false;
  store.setPreview(name, url);
  return true;
}

export function getLocalPreview(editor: Editor, name: string): string | undefined {
  return editor.storage.wikiHost.previews.get(name);
}

/**
 * Reactive preview lookup for node views. A plain getLocalPreview() call in render is
 * memoized by React Compiler on (editor, name) and never sees a preview registered after
 * the node mounted (resumed drafts); subscribing makes the read re-run on setPreview.
 */
export function useLocalPreview(editor: Editor, name: string): string | undefined {
  const store = editor.storage.wikiHost;
  const read = () => store.previews.get(name);
  return useSyncExternalStore(store.subscribe, read, read);
}
