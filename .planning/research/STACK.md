# Technology Stack

**Project:** Taskflow
**Researched:** 2026-03-10
**Research mode:** Training knowledge (cutoff Aug 2025) — web tools unavailable during this session. Versions marked with confidence levels. Verify before pinning.

---

## Recommended Stack

### Cross-Platform Shell

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tauri 2 | ^2.1 | Desktop shell (macOS, Windows, Linux) | Ships a native webview — no bundled Chromium. ~10 MB installers vs ~150 MB for Electron. Tauri 2.0 (released Oct 2024) added multi-window, mobile support, and a stable plugin API. The Rust backend gives secure credential storage via OS keychain without a server. Actively maintained by CrabNebula with strong community. |

**Why not Electron:** Electron bundles a full Chromium + Node.js runtime. This matters less for an internal tool, but the 150-200 MB installer and 200-400 MB RAM overhead are unnecessary when the app has no complex native rendering requirements. Tauri 2's webview uses the OS-native engine (WebKit on macOS, WebView2 on Windows, WebKitGTK on Linux) — acceptable for a dashboard app that doesn't need pixel-perfect cross-platform rendering.

**Why not a pure web app:** The project requires desktop OS notifications, local PAT storage, and optionally background polling when the window is not focused. These are possible in a web app with PWA + Notification API, but PAT security in localStorage is worse than OS keychain. Tauri gives the right capabilities with a native security model.

**Fallback if Tauri is rejected:** If the team strongly prefers web-only deployment, use a React SPA hosted on a local dev server (Vite `--host`). The same React codebase runs in both modes — the Tauri shell is additive. This is an important architectural property: the UI layer must not depend on Tauri APIs directly; it should call an abstraction layer that routes to either Tauri IPC or browser equivalents.

---

### UI Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React | ^18.3 | UI component framework | The dominant ecosystem choice. Tauri's own documentation and templates are React-first. TanStack Query, the most important library in this stack, has its deepest integration with React. The team is likely already familiar with it. |
| TypeScript | ^5.4 | Type safety across the whole codebase | Jira API v2 and GitLab API have complex, partially-documented response shapes. TypeScript interfaces for API responses will prevent entire categories of runtime bugs. Not optional for a multi-API integration project. |
| Vite | ^5.2 | Build tool and dev server | Tauri's official scaffolding uses Vite. Sub-second HMR in development. Handles the Tauri + React combination out of the box. |

**Why not Vue or Svelte:** Both are valid. Vue 3 + Pinia is an excellent combination. The recommendation is React because (a) TanStack Query's React adapter is the most mature, (b) it minimizes context-switching if the team already knows React, and (c) the Tauri community produces more React examples. If the team is Svelte-experienced, Svelte 5 + Tauri is a legitimate alternative but requires verifying TanStack Query's Svelte adapter maturity.

---

### Data Fetching and Server State

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| TanStack Query (React Query) | ^5.x | All API calls: caching, background refetch, polling | This is the single most important library choice for Taskflow. The app's core feature — unified notifications and live sprint state — requires: background polling at configurable intervals, cache invalidation when the user takes an action (e.g., approves MR), stale-while-revalidate to keep the UI fast, and error retry. TanStack Query does all of this with minimal custom code. `refetchInterval` powers the notification polling loop without any manual `setInterval` management. |
| axios | ^1.6 | HTTP client for Jira + GitLab REST calls | Axios provides interceptors for injecting PAT tokens on every request, consistent error shape, timeout configuration, and better behavior than `fetch` for on-premise servers that may return non-standard responses. TanStack Query is agnostic about the fetch function — axios slots in cleanly as the underlying client. |

**Why not SWR:** TanStack Query v5 has better TypeScript generics, finer-grained cache invalidation (`invalidateQueries` with filters), and mutation support with `onSuccess` callbacks to trigger cache updates. SWR is simpler but less powerful for a multi-resource dashboard that needs coordinated cache updates (e.g., after posting a Jira comment, refresh both the comment list and the notification count).

**Why not Redux Toolkit Query (RTK Query):** RTK Query is excellent but ties you to Redux for all state. Taskflow doesn't need global application state managed by a reducer — the API cache IS the state. Adding Redux for two or three non-server UI state values (theme, selected sprint, active role) is unnecessary overhead.

---

### UI State (Non-Server)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zustand | ^4.5 | Global UI state: theme, active role, selected project/sprint | Minimal boilerplate, no context hell, works without a provider at the module level. Only three to five pieces of state need to be truly global in Taskflow: current user's PAT tokens, selected role (dev/PM), active sprint/project selection, and theme. Zustand handles these in ~50 lines. |

**What NOT to store in Zustand:** Jira tasks, MRs, sprints, notifications. Those live in TanStack Query's cache. Mixing server-derived data into Zustand creates synchronization bugs. The separation is: Zustand = user preferences and session config; TanStack Query = everything from the APIs.

---

### Component Library / UI

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| shadcn/ui | current (not versioned — copy-paste model) | Accessible component primitives | shadcn/ui is not a package dependency — components are copied into the project and owned. Built on Radix UI primitives (accessibility) + Tailwind CSS (styling). Ideal for a dashboard because components are fully customizable: the team can adjust the sprint board cards, MR list items, and notification badges without fighting a component library's opinions. |
| Tailwind CSS | ^3.4 | Utility-first styling | Co-required by shadcn/ui. Vite integration is first-class. Dark/light mode via the `dark:` variant is trivial to implement — one class on the `html` element, driven by the Zustand theme state. |

**Why not MUI (Material UI) or Ant Design:** Both are heavyweight libraries with strong visual opinions. They fight back when you try to customize them. shadcn/ui has no opinions about what your app looks like — it provides the accessible plumbing and you own the visuals. For an internal tool that needs to feel clean and fast (not corporate-generic), this is the right tradeoff.

**Why not Chakra UI:** Chakra v3 dropped Emotion for CSS variables which removed some of the customization pain, but it still ships a large bundle and the theming model is more complex than Tailwind. shadcn/ui + Tailwind is lighter and faster.

---

### Credential Storage

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@tauri-apps/plugin-store` | ^2.x | Persist encrypted config (tokens, server URLs) to disk | Tauri's store plugin persists key-value data to an app-specific JSON file in the OS data directory. For PATs that should not be stored in plaintext, pair with... |
| `@tauri-apps/plugin-stronghold` | ^2.x | Encrypt secrets at rest using the OS keychain or a password-derived key | Stronghold is Tauri's secret vault plugin. It uses IOTA Stronghold under the hood — secrets are encrypted on disk and unlocked either by the OS keychain or a user-supplied master password. This is the correct storage mechanism for Jira and GitLab PATs. DO NOT store PATs in `localStorage`, `sessionStorage`, or unencrypted Tauri store. |

**Why not OS keychain directly:** Tauri's Stronghold plugin abstracts OS differences (Keychain on macOS, Credential Store on Windows, Secret Service on Linux) behind a single API. Writing platform-specific keychain code from scratch is error-prone.

**Web-app fallback:** If shipping as a web app without Tauri, store PATs in `sessionStorage` only (not `localStorage`) and add a clear "session ends on tab close" user expectation. This is a security downgrade — document it explicitly.

---

### Desktop Notifications

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@tauri-apps/plugin-notification` | ^2.x | OS-native desktop notification toasts | Required for the notification hub feature. Fires OS notifications when new Jira comment mentions or GitLab MR activity is detected by the polling loop. Works when the app window is minimized. |

The polling architecture: TanStack Query runs `refetchInterval` queries for notifications. On new results, a comparison with the previous cache value triggers `sendNotification()`. This keeps all logic in the frontend — no Rust backend custom code needed for notifications.

---

### Routing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React Router | ^6.22 | Client-side routing between dashboard views | Taskflow has multiple views: Developer Dashboard, PM Dashboard, Notifications, Releases, Search, Settings. React Router v6 with the `createBrowserRouter` API provides type-safe routes. In Tauri, use hash routing (`createHashRouter`) to avoid file path issues with the Tauri webview asset serving. |

**Why not TanStack Router:** TanStack Router has excellent TypeScript support and is the emerging challenger to React Router. It is a valid choice and worth considering if the team wants stricter type-safe routes. The recommendation stays with React Router v6 because it has a larger community, more Stack Overflow coverage, and the routing needs here are not complex enough to justify adopting a less-established library.

---

### API Client Layer (Project-Specific)

These are not npm packages but patterns that must be built:

| Module | Purpose |
|--------|---------|
| `src/api/jira.ts` | Typed wrapper around Jira REST API v2 endpoints. Uses axios instance with PAT header injection. All Jira types defined here. |
| `src/api/gitlab.ts` | Typed wrapper around GitLab REST API v4 endpoints. Same pattern. |
| `src/api/linker.ts` | Regex-based parser that extracts Jira ticket IDs from MR titles and commit messages (e.g., `/[A-Z]+-\d+/g`). Maps GitLab MRs to Jira issues. |

Build these as pure functions that accept an `axios` instance configured with the user's PAT and base URL. This makes them testable without Tauri and reusable in both the Tauri and web-app targets.

---

### Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vitest | ^1.6 | Unit + integration tests | Vite-native test runner. Same config as the build. Fast watch mode. MSW integration for mocking Jira + GitLab API responses. |
| React Testing Library | ^14.x | Component tests | The standard for testing React components by user behavior, not implementation. |
| MSW (Mock Service Worker) | ^2.x | API mocking in tests and development | Mock both Jira v2 and GitLab API responses. Critical for development when the on-premise Jira server may be unavailable. MSW v2 uses the Fetch API handler model and works in Vitest via `msw/node`. |

**Why not Cypress or Playwright for unit tests:** E2E tests are out of scope for v1 given the team size and "ship to validate" philosophy. Vitest + RTL covers the logic and component behavior. Add Playwright later when the app is stable.

---

### Build / Distribution

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tauri CLI | ^2.x | Build signed installers for macOS (.dmg), Windows (.msi), Linux (.AppImage/.deb) | `tauri build` produces platform-native installers. Code signing can be deferred for v1 internal distribution. |

**Auto-update:** Tauri has a built-in updater plugin (`@tauri-apps/plugin-updater`). Defer until v2 — internal distribution via direct download is sufficient for v1.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Desktop shell | Tauri 2 | Electron | ~15x larger installers, higher RAM, no OS keychain integration without extra packages |
| Desktop shell | Tauri 2 | Pure PWA | No OS keychain for PAT storage; background notifications require persistent service worker, unreliable on desktop |
| UI framework | React 18 | Vue 3 | Valid alternative; React chosen for TanStack Query React adapter maturity and wider Tauri community examples |
| UI framework | React 18 | Svelte 5 | Svelte 5 runes are excellent but TanStack Query Svelte adapter is less mature |
| Server state | TanStack Query v5 | SWR | TanStack has better cache invalidation, mutation coordination, and TypeScript generics |
| Server state | TanStack Query v5 | RTK Query | Would require Redux for all state; unnecessary for this app's complexity |
| UI state | Zustand | Jotai | Both are good; Zustand is more explicit about store shape, better for team readability |
| Component library | shadcn/ui + Tailwind | MUI / Ant Design | Heavy, opinionated, hard to customize; shadcn is owned by the project |
| HTTP client | axios | native fetch | Axios interceptors make PAT injection and error handling cleaner; fetch requires more boilerplate |
| Secrets storage | Tauri Stronghold | localStorage | localStorage is unencrypted plaintext — never for PATs |
| Testing | Vitest | Jest | Vitest is Vite-native, no transform config needed, faster cold starts |

---

## Installation

```bash
# Scaffold Tauri 2 + React + TypeScript project
npm create tauri-app@latest taskflow -- --template react-ts

cd taskflow

# Data fetching and state
npm install @tanstack/react-query axios zustand

# Routing
npm install react-router-dom

# UI
npm install tailwindcss @tailwindcss/vite
npx shadcn@latest init

# Tauri plugins
npm install @tauri-apps/plugin-notification
npm install @tauri-apps/plugin-store
npm install @tauri-apps/plugin-stronghold

# Dev dependencies
npm install -D vitest @testing-library/react @testing-library/user-event msw

# Add Tauri plugins to src-tauri/Cargo.toml (Rust side also required)
# tauri-plugin-notification = "2"
# tauri-plugin-store = "2"
# tauri-plugin-stronghold = "2"
```

Note: Tauri plugins require both the npm package (JS side) AND the Rust crate (backend side). Adding to `package.json` alone is insufficient.

---

## Version Confidence Notes

All version recommendations are based on training knowledge with cutoff August 2025. The following should be verified against current releases before project start:

| Package | Recommended | Confidence | Verify At |
|---------|-------------|------------|-----------|
| `tauri` / `@tauri-apps/api` | ^2.1 | MEDIUM | https://github.com/tauri-apps/tauri/releases |
| `@tanstack/react-query` | ^5.x | HIGH | https://tanstack.com/query/latest |
| `react` | ^18.3 | HIGH | https://react.dev/blog |
| `vite` | ^5.x | MEDIUM | https://vitejs.dev/blog |
| `zustand` | ^4.5 | HIGH | https://github.com/pmndrs/zustand/releases |
| `axios` | ^1.6 | HIGH | https://github.com/axios/axios/releases |
| `react-router-dom` | ^6.22 | MEDIUM | https://reactrouter.com |
| `tailwindcss` | ^3.4 or ^4.x | LOW — v4 released early 2025, breaking changes | https://tailwindcss.com/blog |
| `shadcn/ui` | latest | MEDIUM — tracks Tailwind version | https://ui.shadcn.com |
| `msw` | ^2.x | HIGH | https://mswjs.io |
| Tauri plugins | ^2.x | MEDIUM | https://v2.tauri.app/plugin/ |

**Special note on Tailwind CSS v4:** Tailwind v4 (released early 2025) introduces a new CSS-first configuration model that is a breaking change from v3. shadcn/ui's compatibility with v4 should be verified before adopting v4. If in doubt, pin Tailwind to ^3.4 for v1 — the migration to v4 is straightforward later.

---

## Sources

- Tauri 2.0 release: https://tauri.app/blog/tauri-2-0-0-released/ (training knowledge, verify current state)
- TanStack Query v5: https://tanstack.com/query/latest (training knowledge)
- Jira REST API v2 reference: https://docs.atlassian.com/software/jira/docs/api/REST/latest/
- GitLab API v4 reference: https://docs.gitlab.com/ee/api/
- Confidence: MEDIUM overall — core choices (React, TanStack Query, Zustand, axios) are HIGH confidence; Tauri plugin ecosystem and exact versions are MEDIUM; Tailwind v4 compatibility is LOW and needs live verification
