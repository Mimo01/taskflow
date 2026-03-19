/**
 * Tauri abstraction layer — the ONLY place that imports from @tauri-apps/api/core.
 * All other code calls tauriService.invoke() to keep testing possible without
 * the Tauri runtime (mockIPC intercepts at this boundary).
 *
 * Source: https://v2.tauri.app/develop/tests/mocking/
 */
import { invoke } from '@tauri-apps/api/core';

export const tauriService = {
  invoke: <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => invoke<T>(cmd, args),
};
