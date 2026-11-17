import { invoke } from '@tauri-apps/api/core';

/*
 * "Paste as plain text" request shared by the Cmd+Shift+V keydown and the macOS
 * Edit > Paste and Match Style menu item (phase 99 D-15, WR-07). The native paste that follows
 * carries only text/plain, which is indistinguishable from an ordinary plain-text paste (that
 * D-12 converts when it looks like wiki markup), so the request is an explicit, short-lived flag.
 * Kept free of editor imports so main.tsx can use it without pulling in the lazy editor bundle.
 */

/** How long a request waits for its paste event (covers the menu -> webview -> native round trip). */
const ARM_MS = 1000;

let armedUntil = 0;

export function armPlainPaste(): void {
  armedUntil = Date.now() + ARM_MS;
}

export function disarmPlainPaste(): void {
  armedUntil = 0;
}

/** True once if a plain paste was requested recently; always clears the request. */
export function consumePlainPaste(): boolean {
  const armed = Date.now() <= armedUntil;
  armedUntil = 0;
  return armed;
}

/**
 * Menu item handler: flag the coming paste as plain, then ask the native webview to paste.
 * The flag is set before the paste is requested, so the paste event always sees it.
 */
export async function onMenuPastePlain(): Promise<void> {
  armPlainPaste();
  try {
    await invoke('paste_as_plain_text');
  } catch {
    disarmPlainPaste();
  }
}
