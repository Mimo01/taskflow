/**
 * Barrel export for the Jira service.
 *
 * Re-exports all public types and functions from domain modules.
 * Consumers import from '@/services/jira' -- no import path changes needed.
 *
 * NOTE: client.ts exports (fetchAllSearchPages, isResponseLikeError, etc.)
 * are intentionally NOT re-exported here. They are internal to jira/ modules.
 */

export * from './backlog';
export * from './comments';
export * from './epics';
export * from './fields';
export * from './issues';
export * from './links';
export * from './projects';
export * from './sprints';
export * from './transitions';
export * from './types';
export * from './versions';
export * from './worklogs';
