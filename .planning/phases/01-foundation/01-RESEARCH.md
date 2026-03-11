# Phase 1: Foundation - Research

**Researched:** 2026-03-11
**Domain:** Tauri 2 desktop app — project scaffold, secure credential storage, Jira/GitLab API validation, wizard UX, theme persistence
**Confidence:** MEDIUM-HIGH (Stronghold API verified via official docs; keyring deprecation notice verified via Tauri maintainer; Jira Bearer vs Basic auth ambiguity flagged as LOW)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Onboarding structure**
- Step-by-step wizard (not single page, not tabbed)
- Sequence: Welcome → Jira → GitLab → Role → Done (5 steps)
- Project/group selection happens inline within each credential step — after token validates on the Jira step, the project dropdown appears on the same screen; same for GitLab group on the GitLab step
- Back navigation is allowed and all entered data is preserved (URL, token, project selection) — no clearing on back

**Token validation UX**
- Validation fires on explicit 'Test & Continue' button click — not on blur, not as-you-type
- Button shows spinner + 'Connecting...' label during validation; button is disabled while in progress
- Error messages are specific per error type:
  - 401 → "Invalid token or token has expired"
  - Network/DNS error → "Cannot reach [URL] — check the base URL"
  - 403 → "Token valid but lacks required permissions"
- Success state: green checkmark badge on the step in the wizard progress indicator; project dropdown appears inline after success (no separate success banner)

**Launch state (return visits)**
- On launch when onboarding is complete: route directly to the user's dashboard (no splash, no status screen) — fetch data in the background with loading skeletons
- If one token has expired at launch: show dashboard with a sticky (non-dismissible) re-auth banner — "Jira token expired — update it in Settings" — app remains usable for the working service
- If network is unavailable at launch: show dashboard with offline indicator + cached data if available + retry button — app remains navigable

**Settings structure**
- Settings accessible via gear icon in sidebar or top bar — persistent, always one click away
- All config is editable from settings without re-running onboarding: tokens, base URLs, active project/group, role, and theme
- Onboarding is first-run only; settings covers all subsequent changes
- Tokens displayed as masked (***...***) with eye icon reveal toggle + 'Update token' button — tokens are never shown in plaintext by default
- Switching active Jira project clears all cached data and triggers a fresh reload

### Claude's Discretion
- Exact visual design of the wizard progress indicator (step dots, numbered steps, etc.)
- Loading skeleton design for the dashboard on first data fetch
- Exact offline indicator visual treatment
- Animation/transition between wizard steps

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can enter Jira PAT and Jira base URL during onboarding | Wizard step pattern with shadcn/ui Input + Button; TanStack Query mutation for validation call |
| AUTH-02 | User can enter GitLab PAT and GitLab base URL during onboarding | Same wizard pattern as AUTH-01; GitLab GET /api/v4/user validation endpoint confirmed |
| AUTH-03 | PATs stored in OS keychain (not plaintext, not in app state) | Tauri Stronghold v2 confirmed usable; keyring alternatives documented; deprecation risk flagged |
| AUTH-04 | User can select active Jira project and GitLab group after auth | Inline dropdown after successful validation; Jira GET /rest/api/2/project + GitLab GET /api/v4/groups |
| AUTH-05 | User can update or revoke stored tokens from settings | Settings page with masked token display; Stronghold insert/remove operations confirmed |
| AUTH-06 | App displays clear error when token is invalid or expired | Specific error messages per HTTP status mapped in research; re-auth banner pattern documented |
| ROLE-01 | User can select role (Developer or PM) during onboarding | Simple Zustand store field; shadcn/ui RadioGroup or ToggleGroup on Role wizard step |
| ROLE-02 | User can switch role from settings at any time | Settings page reads/writes same Zustand role field; persisted via Tauri Store plugin |
| UI-01 | User can toggle between dark and light mode | Tailwind dark class strategy; Tauri Store plugin for persistence; shadcn/ui ThemeProvider pattern |
</phase_requirements>

---

## Summary

Phase 1 establishes the entire technical foundation that all future phases build on. The core challenge is threefold: scaffolding a Tauri 2 + React 18 + TypeScript project with the full agreed-upon stack, implementing secure PAT storage that survives app restarts and never exposes tokens in plaintext, and connecting to Jira Server and GitLab APIs across a user-supplied base URL without hitting CORS.

**Critical finding on Stronghold:** The CONTEXT.md Integration Points list Tauri Stronghold for PAT storage. Research confirms Stronghold v2 is functional and well-documented for Tauri 2, but a Tauri maintainer (FabianLars) has explicitly stated it "will be deprecated and therefore removed in v3." There is no official Tauri keyring plugin; the alternatives are community packages (`tauri-plugin-keyring`, `tauri-plugin-keychain`). For a desktop-only app targeting macOS/Windows/Linux, Stronghold remains the path of least resistance for v1. The plan should document this tradeoff so the team can migrate to keyring when upgrading to Tauri 3.

**CORS is not a problem in Tauri:** Unlike a browser-based app, Tauri desktop apps are not subject to the same-origin policy. HTTP requests to any domain work natively. The Tauri `http-client` plugin or `tauri-plugin-cors-fetch` can be used; `tauri-plugin-cors-fetch` transparently proxies native fetch through Tauri's HTTP client so existing fetch() calls work unchanged.

**Primary recommendation:** Scaffold with `npm create tauri-app@latest` selecting React + TypeScript, add plugins via `npm run tauri add`, use Stronghold for PAT storage now with a known v3 migration path, use Tauri Store for theme/role persistence, React Router v6 with `createHashRouter` for SPA routing, and Zustand for client state.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tauri | 2.x | Desktop shell, OS APIs, IPC | Locked decision; enables OS keychain, CORS bypass |
| React | 18.x | UI framework | Locked in roadmap |
| TypeScript | 5.x | Type safety | Locked in roadmap |
| Vite | 5.x | Build tool | Default Tauri + React scaffold uses Vite |
| shadcn/ui | latest | Component library | Locked in roadmap; copies components into project |
| Tailwind CSS | v3.x | Styling | Locked in roadmap; v3 required (not v4) — see note below |
| Zustand | 5.x | Client state | Locked in roadmap |
| TanStack Query | v5.x | Server state / async data | Locked in roadmap |
| React Router | v6.x | SPA routing | Standard for Vite + React desktop apps |

**Tailwind v3 note:** shadcn/ui has begun migrating to Tailwind v4, but v3 still works and new components continue to be generated in v3 until you opt in. The project spec locks v3, which is correct for stability.

### Tauri Plugins
| Plugin | Version | Purpose | Install |
|--------|---------|---------|---------|
| tauri-plugin-stronghold | 2.x | Encrypted PAT vault | `npm run tauri add stronghold` |
| tauri-plugin-store | 2.x | Theme/role/config persistence | `npm run tauri add store` |
| tauri-plugin-http | 2.x | HTTP requests bypassing CORS | `npm run tauri add http` |

### Testing
| Library | Version | Purpose |
|---------|---------|---------|
| Vitest | 2.x | Unit/component test runner (native Vite integration) |
| @testing-library/react | 16.x | React component testing |
| @testing-library/jest-dom | 6.x | DOM assertion matchers |
| jsdom | 25.x | Browser environment simulation in Node |
| @tauri-apps/api/mocks | bundled | IPC mock for Tauri commands in tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Stronghold | tauri-plugin-keyring (community) | Keyring maps directly to OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service) — cleaner semantics but no official Tauri support; worth migrating to in Tauri 3 |
| Stronghold | tauri-plugin-keychain (community, v2.0.2) | Similar to keyring; community-maintained |
| React Router v6 | React Router v7 | v7 is a non-breaking upgrade; v6 is fine and stable for this use case |
| tauri-plugin-http | tauri-plugin-cors-fetch | cors-fetch transparently patches window.fetch so no code changes are needed; trade-off is an extra community dependency |

**Installation:**
```bash
# Scaffold
npm create tauri-app@latest taskflow -- --template react-ts

# Add Tauri plugins
npm run tauri add stronghold
npm run tauri add store
npm run tauri add http

# Frontend dependencies
npm install react-router-dom
npm install zustand
npm install @tanstack/react-query
npm install class-variance-authority clsx tailwind-merge lucide-react

# shadcn/ui CLI (adds components on demand)
npm install -D shadcn

# Testing
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── routes/             # React Router pages (one file = one route)
│   ├── onboarding/     # Wizard steps: Welcome, Jira, GitLab, Role, Done
│   ├── dashboard/      # Post-onboarding landing (placeholder in Phase 1)
│   └── settings/       # Settings page (tokens, role, theme)
├── components/
│   ├── ui/             # shadcn/ui generated components (never edit)
│   └── app/            # App-specific composed components
├── stores/
│   ├── auth.store.ts   # Jira/GitLab URLs, auth status, project/group selection
│   ├── settings.store.ts  # Role, theme — persisted via Tauri Store
│   └── onboarding.store.ts  # Wizard step index, form values preserved on back
├── services/
│   ├── tauri.ts        # Abstraction layer: wraps invoke() + Tauri plugin calls
│   ├── jira.ts         # Jira API calls (validation, project list)
│   ├── gitlab.ts       # GitLab API calls (validation, group list)
│   └── stronghold.ts   # Stronghold read/write helpers
├── lib/
│   └── utils.ts        # cn() helper, shared utilities
└── main.tsx            # QueryClientProvider + RouterProvider + ThemeProvider
src-tauri/
├── src/
│   └── lib.rs          # Plugin registration (Stronghold, Store, HTTP)
├── capabilities/
│   └── default.json    # Permission grants (stronghold:default, store:default, http:default)
└── tauri.conf.json
```

### Pattern 1: Tauri Abstraction Layer (dev/Tauri boundary)
**What:** All Tauri API calls (invoke, plugin calls, file paths) flow through `src/services/tauri.ts`. In tests, this module is replaced by a mock that returns predictable data without needing the Tauri runtime.
**When to use:** Every time a component or store needs to call `invoke()` or a Tauri plugin API.

```typescript
// src/services/tauri.ts
// Source: https://v2.tauri.app/develop/tests/mocking/
import { invoke } from '@tauri-apps/api/core';

export const tauriService = {
  invoke: <T>(cmd: string, args?: Record<string, unknown>) =>
    invoke<T>(cmd, args),
};
```

```typescript
// In tests: mockIPC from @tauri-apps/api/mocks intercepts invoke()
// Source: https://v2.tauri.app/develop/tests/mocking/
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks';

beforeEach(() => {
  mockIPC((cmd, args) => {
    if (cmd === 'validate_jira') return { ok: true };
  });
});
afterEach(() => clearMocks());
```

### Pattern 2: Stronghold PAT Storage
**What:** Store each PAT as a UTF-8 byte array under a stable key. Always call `stronghold.save()` after write operations.
**When to use:** Writing or reading any PAT.

```typescript
// Source: https://v2.tauri.app/plugin/stronghold/
import { Client, Stronghold } from '@tauri-apps/plugin-stronghold';
import { appDataDir } from '@tauri-apps/api/path';

let _stronghold: Stronghold | null = null;
let _store: ReturnType<Client['getStore']> | null = null;

async function getStore() {
  if (_store) return _store;
  const vaultPath = `${await appDataDir()}/vault.hold`;
  // Password for the vault encryption — store this in Tauri Store or derive from a device ID
  // DO NOT hardcode. See Open Questions.
  const password = await getVaultPassword();
  _stronghold = await Stronghold.load(vaultPath, password);
  const client = await _stronghold
    .loadClient('taskflow')
    .catch(() => _stronghold!.createClient('taskflow'));
  _store = client.getStore();
  return _store;
}

export async function storeSecret(key: string, value: string): Promise<void> {
  const store = await getStore();
  const data = Array.from(new TextEncoder().encode(value));
  await store.insert(key, data);
  await _stronghold!.save();
}

export async function readSecret(key: string): Promise<string> {
  const store = await getStore();
  const data = await store.get(key);
  return new TextDecoder().decode(new Uint8Array(data));
}

export async function removeSecret(key: string): Promise<void> {
  const store = await getStore();
  await store.remove(key);
  await _stronghold!.save();
}
```

**Rust setup in `src-tauri/src/lib.rs`:**
```rust
// Source: https://v2.tauri.app/plugin/stronghold/
use tauri_plugin_stronghold::Builder;

pub fn run() {
    tauri::Builder::default()
        .plugin(Builder::with_argon2(&salt_path).build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**`Cargo.toml` profile required to avoid slow dev builds:**
```toml
[profile.dev.package.scrypt]
opt-level = 3
```

### Pattern 3: Tauri Store for Settings Persistence
**What:** Non-sensitive settings (theme, role) use the Tauri Store plugin. Simpler API, no encryption needed.

```typescript
// Source: https://v2.tauri.app/plugin/store/
import { LazyStore } from '@tauri-apps/plugin-store';

const settingsStore = new LazyStore('settings.json');

export async function saveTheme(theme: 'dark' | 'light' | 'system'): Promise<void> {
  await settingsStore.set('theme', theme);
  await settingsStore.save();
}

export async function loadTheme(): Promise<'dark' | 'light' | 'system'> {
  return (await settingsStore.get<'dark' | 'light' | 'system'>('theme')) ?? 'system';
}
```

### Pattern 4: React Router v6 with HashRouter
**What:** `createHashRouter` is required for Tauri desktop apps because there is no HTTP server to handle browser history — the hash-based URL is self-contained in the WebView.

```typescript
// src/main.tsx
import { createHashRouter, RouterProvider } from 'react-router-dom';

const router = createHashRouter([
  { path: '/', element: <OnboardingWizard /> },       // first-run
  { path: '/dashboard', element: <Dashboard /> },
  { path: '/settings', element: <Settings /> },
]);

// Guard: if onboarding complete, redirect '/' to '/dashboard'
```

### Pattern 5: Onboarding Wizard State (preserve on back)
**What:** Wizard step state (current step index, all field values) lives in a Zustand store, not React local state. This ensures back-navigation restores form values.

```typescript
// src/stores/onboarding.store.ts
import { create } from 'zustand';

interface OnboardingState {
  step: number;
  jiraUrl: string;
  jiraToken: string;
  jiraProject: string | null;
  gitlabUrl: string;
  gitlabToken: string;
  gitlabGroup: string | null;
  role: 'developer' | 'pm' | null;
  jiraValidated: boolean;
  gitlabValidated: boolean;
  set: (partial: Partial<OnboardingState>) => void;
  goNext: () => void;
  goBack: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  step: 0,
  jiraUrl: '',
  jiraToken: '',
  jiraProject: null,
  gitlabUrl: '',
  gitlabToken: '',
  gitlabGroup: null,
  role: null,
  jiraValidated: false,
  gitlabValidated: false,
  set: (partial) => set(partial),
  goNext: () => set({ step: get().step + 1 }),
  goBack: () => set({ step: Math.max(0, get().step - 1) }),
}));
```

### Pattern 6: API Validation with TanStack Query Mutations
**What:** Use `useMutation` for the "Test & Continue" button — it handles loading state, error state, and success naturally.

```typescript
// Source: https://tanstack.com/query/v5/docs/framework/react/quick-start
import { useMutation } from '@tanstack/react-query';

function useJiraValidation() {
  return useMutation({
    mutationFn: async ({ baseUrl, token }: { baseUrl: string; token: string }) => {
      const res = await fetch(`${baseUrl}/rest/api/2/myself`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) throw new Error('Invalid token or token has expired');
      if (res.status === 403) throw new Error('Token valid but lacks required permissions');
      if (!res.ok) throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
      return res.json();
    },
  });
}
// Usage: mutation.isPending → show spinner; mutation.isError → show error; mutation.isSuccess → show project dropdown
```

### Pattern 7: Dark/Light Mode with Tailwind
**What:** Use Tailwind's `class` dark mode strategy (not `media`). Toggle a `dark` class on `<html>`. Persist preference via Tauri Store.

```typescript
// Apply theme on app boot and on toggle
function applyTheme(theme: 'dark' | 'light' | 'system') {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}
```

```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class',  // required — not 'media'
  // ...
};
```

### Anti-Patterns to Avoid
- **Storing PATs in Zustand store:** Zustand state is in-memory and not encrypted. PATs must go through Stronghold only. Zustand may hold an "is authenticated" boolean but never the token value.
- **Using BrowserRouter in Tauri:** Will break on navigation because there's no server to serve the HTML file on a deep URL. Use `createHashRouter`.
- **Calling Tauri APIs directly from components:** Always go through `src/services/tauri.ts`. This makes testing possible without the Tauri runtime.
- **Hardcoding the Stronghold vault password:** The vault encryption password must come from somewhere dynamic. See Open Questions.
- **Not calling `stronghold.save()` after writes:** Stronghold only writes to disk on explicit `save()`. Omitting this silently loses data.
- **Using Tailwind `darkMode: 'media'`:** This makes dark mode system-only and non-toggleable. Use `'class'` strategy.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Encrypted credential storage | Custom file encryption | Tauri Stronghold plugin | argon2 KDF, memory-protected store, audited |
| HTTP requests to arbitrary URLs | Custom CORS proxy or WebSocket tunnel | Tauri HTTP plugin or cors-fetch plugin | CORS bypass is built into Tauri's WebView; no proxy needed |
| Component primitives (Dialog, Select, Input) | Custom HTML components | shadcn/ui + Radix UI | Accessibility, keyboard nav, focus management are non-trivial |
| State persistence across restarts | localStorage (not available in all Tauri contexts reliably) | Tauri Store plugin | Cross-platform, syncs to disk, available from Rust side too |
| Form field validation | Custom regex / ad-hoc checks | Zod + React Hook Form | Schema validation, field-level errors, type inference |
| Test environment for Tauri IPC | Conditional import hacks | `mockIPC` from `@tauri-apps/api/mocks` | Official Tauri testing utility, intercepts all invoke() calls |

**Key insight:** Every "simple" credential storage implementation has gotten production apps compromised. Stronghold is purpose-built for this; the complexity of encryption, memory protection, and key derivation is already solved.

---

## Common Pitfalls

### Pitfall 1: Stronghold Vault Password Must Not Be Hardcoded
**What goes wrong:** Developers hardcode `'password'` in the `Stronghold.load()` call (exactly as shown in official docs examples), which means the vault can be decrypted by anyone who decompiles the binary.
**Why it happens:** Official documentation examples use `'password'` as a placeholder; it's easy to ship this.
**How to avoid:** Derive the vault password from a machine-specific identifier (device UUID, hostname hash) stored in Tauri Store, or use a user-prompted PIN that unlocks the vault on each app launch.
**Warning signs:** `Stronghold.load(vaultPath, 'password')` with a string literal anywhere in source.

### Pitfall 2: Jira Server Bearer vs Basic Auth Ambiguity
**What goes wrong:** Jira Server REST API v2 PAT authentication inconsistency — some Jira Server versions use `Authorization: Bearer <token>` while others (or certain configurations) require `Authorization: Basic base64(email:token)`. Network errors can look like auth errors.
**Why it happens:** Jira Server PAT support was added in v8.14.0; older instances or non-standard configs may behave differently. The STATE.md explicitly flags this as needing live verification.
**How to avoid:** Try `Bearer` first. If 401, fall back to `Basic`. Log the method that worked and use it for all subsequent calls. Make the auth header strategy configurable.
**Warning signs:** 401 on a token that the user confirms is valid and working in curl.

### Pitfall 3: Stronghold Deprecation Trap
**What goes wrong:** Building v1 deeply coupled to Stronghold internals (vault path, client name, store key naming) makes the eventual v3 keyring migration painful.
**Why it happens:** Stronghold API is different from OS keyring semantics.
**How to avoid:** Isolate all Stronghold calls behind `src/services/stronghold.ts` with a clear interface (`storeSecret`, `readSecret`, `removeSecret`). Migrating to keyring later means only replacing this one file.
**Warning signs:** `import { Stronghold } from '@tauri-apps/plugin-stronghold'` appearing outside of `stronghold.ts`.

### Pitfall 4: Wizard State in Local Component State
**What goes wrong:** Back navigation destroys all entered values because React unmounts and remounts components when the step changes.
**Why it happens:** Developers default to `useState` for form fields.
**How to avoid:** Keep the entire wizard state (all steps, all field values) in the `useOnboardingStore` Zustand store. Components read from and write to the store; they never own the field values.
**Warning signs:** `const [jiraUrl, setJiraUrl] = useState('')` at the step component level.

### Pitfall 5: Missing `stronghold.save()` After Writes
**What goes wrong:** PATs appear to be stored during the session but are gone after app restart.
**Why it happens:** Stronghold holds writes in memory until `save()` is called explicitly.
**How to avoid:** Always call `await stronghold.save()` inside the write helper, never rely on callers to remember.
**Warning signs:** Tokens work in-session but not after restarting the app.

### Pitfall 6: Capability Permissions Not Granted
**What goes wrong:** Plugin calls throw permission errors at runtime with cryptic messages.
**Why it happens:** Tauri 2 uses a capability-based permission model. Each plugin capability must be explicitly granted in `src-tauri/capabilities/default.json`.
**How to avoid:** After adding each plugin, add its permission set to the capability file.
**Warning signs:** `IPC error: permission denied` or similar at runtime.

```json
// src-tauri/capabilities/default.json — required entries
{
  "permissions": [
    "stronghold:default",
    "store:default",
    "http:default"
  ]
}
```

---

## Code Examples

### Jira API Validation Call
```typescript
// GET /rest/api/2/myself — validates PAT and returns user info
// Source: https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html
const res = await fetch(`${jiraBaseUrl}/rest/api/2/myself`, {
  headers: {
    'Authorization': `Bearer ${jiraPat}`,
    'Content-Type': 'application/json',
  },
});
```

### GitLab API Validation Call
```typescript
// GET /api/v4/user — validates PAT and returns current user
// Source: https://docs.gitlab.com/api/rest/authentication/
const res = await fetch(`${gitlabBaseUrl}/api/v4/user`, {
  headers: {
    'PRIVATE-TOKEN': gitlabPat,
  },
});
```

### Jira Project List
```typescript
// GET /rest/api/2/project — lists all projects accessible to the token
const res = await fetch(`${jiraBaseUrl}/rest/api/2/project`, {
  headers: { 'Authorization': `Bearer ${jiraPat}` },
});
const projects: Array<{ id: string; key: string; name: string }> = await res.json();
```

### GitLab Group List
```typescript
// GET /api/v4/groups — lists groups accessible to the token
const res = await fetch(`${gitlabBaseUrl}/api/v4/groups`, {
  headers: { 'PRIVATE-TOKEN': gitlabPat },
});
const groups: Array<{ id: number; name: string; full_path: string }> = await res.json();
```

### TanStack Query v5 Setup in main.tsx
```typescript
// Source: https://tanstack.com/query/v5/docs/framework/react/quick-start
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createHashRouter, RouterProvider } from 'react-router-dom';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,  // 5 minutes
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>
);
```

### Vitest Configuration for Tauri + React
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom';
import { randomFillSync } from 'crypto';

Object.defineProperty(window, 'crypto', {
  value: { getRandomValues: (buf: BufferSource) => randomFillSync(buf as Buffer) },
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri 1.x + CRA | Tauri 2.x + Vite | Tauri 2 stable Oct 2024 | IPC model changed; plugins require capability grants now |
| Stronghold for secrets | Keyring (OS-native) | Tauri maintainer statement 2025; v3 removal planned | Stronghold still works in v2 but is a dead end |
| React Router v5 `HashRouter` component | React Router v6 `createHashRouter` | React Router v6 (2021), v7 (2024) | Data loading APIs, better TypeScript |
| Tailwind `purge` config | Tailwind `content` config | Tailwind v3 | Old config key silently ignored |
| shadcn/ui with Tailwind v4 | shadcn/ui with Tailwind v3 | shadcn began v4 migration in 2025 | v3 still fully supported; new projects can stay on v3 |

**Deprecated/outdated:**
- `window.__TAURI__` global: Replaced by `@tauri-apps/api/core` imports in Tauri 2
- `tauri::Builder::default().invoke_handler()` pattern from Tauri 1: Replaced by plugin-based architecture in Tauri 2
- `createBrowserRouter` in Tauri: Works in dev (Vite dev server) but breaks in production builds — always use `createHashRouter`

---

## Open Questions

1. **Stronghold vault encryption password source**
   - What we know: The password must not be hardcoded; official docs use `'password'` as placeholder
   - What's unclear: Best practice for a desktop app with no server and no user account system — machine fingerprint? A user-set PIN stored in the Tauri Store? A random key generated on first run and stored in a separate Tauri Store entry?
   - Recommendation: Generate a random 32-byte key on first launch, store it in Tauri Store (`settings.json`) as the vault password. This is not maximally secure (anyone with file access can read `settings.json`) but is appropriate for a dev tool protecting internal API tokens rather than financial credentials. Document this explicitly in the codebase.

2. **Jira Server Bearer vs Basic auth format**
   - What we know: Jira Data Center 8.14+ supports `Authorization: Bearer <PAT>`; some configurations may require `Basic base64(user:PAT)` or `Basic base64(:PAT)`
   - What's unclear: The specific Jira Server version and config of the target on-premise instance
   - Recommendation: Implement Bearer auth first. If the user's Jira returns 401, surface a hint in the error message: "If your Jira instance is older than 8.14, try using Basic auth." Plan 01-02 should make the auth header strategy testable in isolation.

3. **CORS in Tauri 2 — which HTTP approach to use**
   - What we know: Tauri desktop apps are not subject to browser CORS. The `tauri-plugin-http` provides fetch-compatible HTTP that works cross-origin. `tauri-plugin-cors-fetch` patches `window.fetch` transparently.
   - What's unclear: Whether the standard WebView fetch (without any plugin) already works for user-supplied on-premise Jira URLs in Tauri 2
   - Recommendation: Test with plain `fetch()` first in the Tauri dev environment. If a CORS error appears, add `tauri-plugin-cors-fetch`. The plan should assume plain fetch works (it should in Tauri) and treat the plugin as a fallback.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.x |
| Config file | `vitest.config.ts` — Wave 0 creates this |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Jira validation mutation maps 401 → correct error string | unit | `npx vitest run src/services/jira.test.ts` | Wave 0 |
| AUTH-02 | GitLab validation mutation maps 401 → correct error string | unit | `npx vitest run src/services/gitlab.test.ts` | Wave 0 |
| AUTH-03 | storeSecret / readSecret round-trip (mocked Stronghold) | unit | `npx vitest run src/services/stronghold.test.ts` | Wave 0 |
| AUTH-04 | Project/group dropdown appears after successful validation | component | `npx vitest run src/routes/onboarding/JiraStep.test.tsx` | Wave 0 |
| AUTH-05 | Settings form reads masked token; Update button triggers store write | component | `npx vitest run src/routes/settings/Settings.test.tsx` | Wave 0 |
| AUTH-06 | Error banner renders with specific message for 401/403/network | component | `npx vitest run src/routes/onboarding/JiraStep.test.tsx` | Wave 0 |
| ROLE-01 | Role picker step renders; selecting role updates store | component | `npx vitest run src/routes/onboarding/RoleStep.test.tsx` | Wave 0 |
| ROLE-02 | Settings page role picker reads and writes role | component | `npx vitest run src/routes/settings/Settings.test.tsx` | Wave 0 |
| UI-01 | Theme toggle applies/removes `dark` class on `<html>` | unit | `npx vitest run src/services/theme.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` — test runner configuration
- [ ] `src/test/setup.ts` — jest-dom matchers + window.crypto shim
- [ ] `src/services/jira.test.ts` — covers AUTH-01, AUTH-06
- [ ] `src/services/gitlab.test.ts` — covers AUTH-02, AUTH-06
- [ ] `src/services/stronghold.test.ts` — covers AUTH-03, AUTH-05 (with mockIPC)
- [ ] `src/routes/onboarding/JiraStep.test.tsx` — covers AUTH-04, AUTH-06
- [ ] `src/routes/onboarding/RoleStep.test.tsx` — covers ROLE-01
- [ ] `src/routes/settings/Settings.test.tsx` — covers AUTH-05, ROLE-02
- [ ] `src/services/theme.test.ts` — covers UI-01

---

## Sources

### Primary (HIGH confidence)
- `https://v2.tauri.app/plugin/stronghold/` — Stronghold v2 installation, Rust setup, JS API, code examples
- `https://v2.tauri.app/plugin/store/` — Store plugin LazyStore API, set/get/save
- `https://v2.tauri.app/start/create-project/` — Official scaffold CLI commands
- `https://v2.tauri.app/develop/tests/mocking/` — mockIPC pattern, Vitest integration
- `https://tanstack.com/query/v5/docs/framework/react/quick-start` — QueryClient setup, useMutation
- `https://docs.gitlab.com/api/rest/authentication/` — GitLab PRIVATE-TOKEN header, /api/v4/user validation
- `https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html` — Jira Server PAT Bearer auth, DC 8.14+ requirement

### Secondary (MEDIUM confidence)
- `https://github.com/orgs/tauri-apps/discussions/7846` — Tauri maintainer (FabianLars) explicit statement that Stronghold "will be deprecated and therefore removed in v3"; keyring recommendation
- `https://v2.tauri.app/plugin/` — Confirmed no official keyring plugin in Tauri 2 plugin list
- `https://ui.shadcn.com/docs/installation/manual` — shadcn/ui Tailwind v3 vs v4 compatibility
- `https://tanstack.com/query/v5/docs/framework/react/typescript` — TanStack Query v5 TypeScript support

### Tertiary (LOW confidence — needs validation)
- WebSearch results on Jira Bearer vs Basic auth inconsistency — multiple community reports of 401 on Bearer when Basic works; needs live instance verification (matches STATE.md blocker)
- WebSearch results on plain fetch() in Tauri 2 WebView — multiple sources say CORS is not enforced, but exact behavior with user-supplied on-premise URLs needs one real test

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against official docs and the locked roadmap
- Architecture: HIGH — patterns derived from official Tauri docs and verified TanStack Query docs
- Stronghold deprecation: HIGH — direct quote from Tauri maintainer in official GitHub discussion
- Jira auth format: LOW — community reports are inconsistent; STATE.md flags this for live validation
- CORS behavior: MEDIUM — Tauri docs say desktop apps bypass CORS; live test still recommended

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (Tauri plugin APIs are stable; Stronghold v3 removal not yet scheduled)
