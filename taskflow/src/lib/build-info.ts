/** Build-time metadata injected by Vite define (see vite.config.ts). */
export const buildInfo = {
  /** App version from git tag, SemVer format (e.g. "1.6.0"). Falls back to "0.0.0-dev". */
  version: import.meta.env.APP_VERSION,
  /** Short commit SHA (e.g. "a1b2c3d"). Falls back to "dev". */
  commitSha: import.meta.env.APP_COMMIT_SHA,
  /** ISO date string (e.g. "2026-03-24"). Falls back to "unknown". */
  buildDate: import.meta.env.APP_BUILD_DATE,
} as const;
