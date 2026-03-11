/**
 * GitLab REST API service — PAT validation and group listing.
 *
 * AUTH HEADER:
 * GitLab uses the PRIVATE-TOKEN header for PAT authentication (not Authorization: Bearer).
 * This is GitLab's standard across all editions (CE, EE, SaaS, self-hosted).
 * Ref: https://docs.gitlab.com/ee/api/rest/authentication.html
 *
 * All HTTP calls use @tauri-apps/plugin-http's fetch(), which proxies through
 * the Rust backend to bypass webview CORS restrictions in Tauri 2.
 *
 * IMPORTANT: This module does NOT store secrets. Callers are responsible for
 * calling storeSecret('gitlab-pat', token) after successful validation.
 */

import { fetch } from '@tauri-apps/plugin-http';

export interface GitLabUser {
  id: number;
  name: string;
  username: string;
}

export interface GitLabGroup {
  id: number;
  name: string;
  full_path: string;
}

/**
 * Validate a GitLab PAT by calling GET /api/v4/user.
 *
 * @param baseUrl - GitLab base URL (e.g. "https://gitlab.example.com")
 * @param token   - Personal Access Token
 * @returns Resolved user info on success
 * @throws Exact error strings per locked UX decisions in CONTEXT.md
 */
export async function validateGitLab(baseUrl: string, token: string): Promise<GitLabUser> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/user`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'PRIVATE-TOKEN': token,
        'Content-Type': 'application/json',
      },
      danger: { acceptInvalidCerts: true },
    });
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (response.ok) {
    const data = await response.json();
    return { id: data.id, name: data.name, username: data.username };
  }

  if (response.status === 401) {
    throw new Error('Invalid token or token has expired');
  }

  if (response.status === 403) {
    throw new Error('Token valid but lacks required permissions');
  }

  throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
}

/**
 * List all GitLab groups visible to the authenticated user.
 *
 * @param baseUrl - GitLab base URL
 * @param token   - Personal Access Token (already validated)
 * @returns Array of groups with id, name, and full_path
 */
export async function listGitLabGroups(baseUrl: string, token: string): Promise<GitLabGroup[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/groups`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'PRIVATE-TOKEN': token,
        'Content-Type': 'application/json',
      },
      danger: { acceptInvalidCerts: true },
    });
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (response.ok) {
    const data = await response.json();
    return data as GitLabGroup[];
  }

  if (response.status === 401) {
    throw new Error('Invalid token or token has expired');
  }

  if (response.status === 403) {
    throw new Error('Token valid but lacks required permissions');
  }

  throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
}
