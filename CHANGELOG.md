# Changelog

All notable changes to the Drode project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased] - Full-Stack Integration: GitHub, Supabase, Vercel, Activity Log, Preview

### Added

**Rust Backend -- New Command Modules:**
- `src-tauri/src/commands/activity.rs` -- 3 commands: `log_activity`, `get_activity_log`, `clear_activity_log`. Events are persisted to SQLite and broadcast to the frontend via Tauri's `emit` system.
- `src-tauri/src/commands/oauth.rs` -- Full OAuth2 PKCE flow: `oauth_start` (generates PKCE challenge, opens system browser, spawns `tiny_http` callback server on `localhost:17391`), `oauth_get_status`, `oauth_get_token`, `oauth_revoke`. Supports GitHub, Supabase, and Vercel providers with configurable client IDs via environment variables.
- `src-tauri/src/commands/github.rs` -- 8 GitHub REST API commands: `github_list_repos`, `github_get_repo_tree`, `github_read_file`, `github_update_file`, `github_list_branches`, `github_create_branch`, `github_list_pull_requests`, `github_create_pull_request`. File content decoded/encoded as base64.
- `src-tauri/src/commands/supabase.rs` -- 8 Supabase API commands: `supabase_list_projects`, `supabase_list_tables` (via `information_schema` SQL), `supabase_get_table_data` (PostgREST with pagination/count), `supabase_run_sql`, `supabase_insert_row`, `supabase_update_row`, `supabase_delete_row`, `supabase_run_migration`.
- `src-tauri/src/commands/vercel.rs` -- 10 Vercel API commands: `vercel_list_projects`, `vercel_list_deployments`, `vercel_get_deployment`, `vercel_get_deployment_logs`, `vercel_create_deployment`, `vercel_list_domains`, `vercel_add_domain`, `vercel_remove_domain`, `vercel_promote_deployment`, `vercel_rollback_deployment`.

**Rust Backend -- New DB Modules:**
- `src-tauri/src/db/activity.rs` -- `insert_event`, `query_events` (with dynamic filtering by category/before_id), `clear_events`
- `src-tauri/src/db/oauth.rs` -- `store_token` (INSERT OR REPLACE), `get_token`, `remove_token`, `list_providers`

**Rust Backend -- New Dependencies:**
- `reqwest` 0.12 (with `json` + `rustls-tls` features) -- HTTP client for all external API calls
- `tiny_http` 0.12 -- Lightweight HTTP server for OAuth2 callback
- `rand` 0.8 -- PKCE code verifier generation
- `base64` 0.22 -- GitHub file content encoding/decoding
- `sha2` 0.10 -- PKCE code challenge (S256)
- `urlencoding` 2 -- URL parameter encoding
- `open` 5 -- System browser launch for OAuth
- `lazy_static` 1.4 -- In-memory pending OAuth flow storage

**Frontend -- New Stores (Zustand):**
- `src/renderer/stores/activityStore.ts` -- events list, category filter, subscribes to `activity-event` Tauri event + project changes
- `src/renderer/stores/authStore.ts` -- OAuth state per provider (GitHub/Supabase/Vercel), listens for `oauth-complete`/`oauth-error` events, `connect`/`disconnect` actions
- `src/renderer/stores/githubStore.ts` -- repos, selectedRepo, branches, currentBranch, tree, treePath, pull requests; all CRUD actions with activity logging
- `src/renderer/stores/supabaseStore.ts` -- projects, tables, selectedTable, tableData, sqlResult, pagination; all CRUD + SQL + migration actions with activity logging
- `src/renderer/stores/vercelStore.ts` -- projects, deployments, domains, logs; 5-second polling for active builds; deploy, promote, rollback, domain management with activity logging
- `src/renderer/stores/previewStore.ts` -- preview tab management (add/remove/set active/update URL/refresh)

**Frontend -- New Components:**
- `src/renderer/components/ActivityLog/ActivityLog.tsx` -- Timeline view with category filter buttons (All/GitHub/Supabase/Vercel/Claude/Terminal), clear button
- `src/renderer/components/ActivityLog/ActivityEvent.tsx` -- Event row with category icon, severity coloring, relative timestamp
- `src/renderer/components/Preview/PreviewPanel.tsx` -- Tabbed iframe preview for localhost URLs with sandbox permissions
- `src/renderer/components/Preview/PreviewToolbar.tsx` -- URL input bar with auto `http://` prefix, refresh button
- `src/renderer/components/GitHub/GitHubExplorer.tsx` -- Repo tree browser with auth gate, opens files in editor with `github://` prefix
- `src/renderer/components/GitHub/GitHubRepoSelector.tsx` -- Searchable repository dropdown
- `src/renderer/components/GitHub/GitHubBranchSelector.tsx` -- Branch picker dropdown
- `src/renderer/components/GitHub/GitHubCommitDialog.tsx` -- Commit message dialog for GitHub file saves
- `src/renderer/components/GitHub/GitHubPRDialog.tsx` -- Pull request creation dialog with title, body, head/base branch
- `src/renderer/components/Database/DatabasePanel.tsx` -- Main panel with project selector, data/SQL view toggle
- `src/renderer/components/Database/TableList.tsx` -- Sidebar table list with column counts
- `src/renderer/components/Database/TableViewer.tsx` -- Paginated data grid with sorting, delete buttons, null display
- `src/renderer/components/Database/QueryEditor.tsx` -- SQL textarea with Cmd+Enter execution
- `src/renderer/components/Database/QueryResults.tsx` -- Tabular SQL result display
- `src/renderer/components/Database/RowEditor.tsx` -- Insert/edit row modal with field inputs per column
- `src/renderer/components/Deployments/DeploymentsPanel.tsx` -- Main panel with project selector, deployments/domains view toggle
- `src/renderer/components/Deployments/DeploymentList.tsx` -- Deployment list with status badges (READY/BUILDING/ERROR)
- `src/renderer/components/Deployments/DeploymentDetail.tsx` -- Build log viewer with promote button
- `src/renderer/components/Deployments/DomainManager.tsx` -- Domain list with add/remove and verification status
- `src/renderer/components/Deployments/DeployButton.tsx` -- One-click deploy trigger with loading state

**Frontend -- New Services:**
- `src/renderer/services/activityBus.ts` -- `logActivity()` helper that resolves the current project path and invokes `log_activity`

### Changed

**Rust Backend:**
- `src-tauri/src/db/schema.rs` -- Added version 2 migration: creates `activity_events` table (with indexes on project_path+created_at and category+created_at) and `oauth_tokens` table (provider as PRIMARY KEY)
- `src-tauri/src/db/mod.rs` -- Added `pub mod activity; pub mod oauth;`
- `src-tauri/src/commands/mod.rs` -- Added `pub mod activity; pub mod oauth; pub mod github; pub mod supabase; pub mod vercel;`
- `src-tauri/src/lib.rs` -- Registered ~30 new commands in `invoke_handler![]`
- `src-tauri/Cargo.toml` -- Added 8 new dependencies (see above)

**Frontend -- Layout System:**
- `src/renderer/stores/layoutStore.ts` -- Added `CenterView` type (`'chat' | 'database' | 'deployments'`), `LeftPanelTab` type (`'files' | 'github'`), extended `BottomPanelTab` with `'activity' | 'preview'`. New state: `centerView`, `leftPanelTab`. New actions: `setCenterView`, `setLeftPanelTab`.
- `src/renderer/stores/editorStore.ts` -- Added `GitHubMeta` interface (`{ owner, repo, branch, sha }`), extended `EditorTab` with optional `source` (`'local' | 'github'`) and `githubMeta` fields for GitHub file editing support.

**Frontend -- Existing Components:**
- `src/renderer/components/Terminal/BottomPanel.tsx` -- Extended tab bar with Activity and Preview tabs. Added `VscPulse`, `VscBrowser` icons. Refactored tab rendering into reusable `tabButton()` helper.
- `src/renderer/components/TopBar/TopBar.tsx` -- Added `AuthIndicators` component: three colored dots showing GitHub/Supabase/Vercel connection status (green = connected, gray = disconnected).
- `src/renderer/App.tsx` -- Added center view tab bar (Chat/Database/Deployments) above center content. Added left panel tab switcher (Files/GitHub) below ConversationList. Conditional rendering for DatabasePanel, DeploymentsPanel, GitHubExplorer. Initializes `activityStore` and `authStore` in cleanup chain.

### Technical Details
- All external API calls go through Rust via `reqwest`, keeping OAuth tokens secure on the native side (never exposed to the webview)
- OAuth2 uses PKCE (S256) for security -- no client secret sent to the browser
- OAuth callback server runs on `localhost:17391` via `tiny_http` inside `tokio::task::spawn_blocking`
- Pending OAuth flows stored in `lazy_static` HashMap, keyed by state parameter
- Activity events are both persisted to SQLite and broadcast via Tauri `emit` for real-time UI updates
- Supabase commands use two distinct APIs: Management API (`api.supabase.com/v1/`) for admin operations and PostgREST (`<ref>.supabase.co/rest/v1/`) for data CRUD
- Vercel deployment polling runs every 5 seconds for active builds, auto-stops when build completes
- GitHub file content is base64-decoded on read and base64-encoded on write
- Async Tauri commands with `State<'_, AppState>` return `Result<T, String>` to satisfy borrow checker lifetime requirements

### Notes
- Same core user-facing behavior for existing features (chat, file explorer, terminal, editor)
- Verified by `tsc --noEmit` (zero errors), `npm run build` (clean), and `cargo build` (clean, 1 dead-code warning)
- New features require OAuth client credentials set as environment variables to function

---

## [Unreleased] - Phase 3: Zustand State Management

### Added
- `zustand` dependency (zero-dep state management for React)
- `src/renderer/stores/layoutStore.ts` — panel widths/collapse state with `persist` middleware (replaces manual debounced localStorage)
- `src/renderer/stores/editorStore.ts` — tab CRUD, reordering, active tab tracking
- `src/renderer/stores/projectStore.ts` — project selection, recent projects, folder picker (uses `subscribeWithSelector` middleware)
- `src/renderer/stores/fileSystemStore.ts` — file operations, directory/file caching, file watcher, subscribes to projectStore for auto-reload
- `src/renderer/stores/permissionStore.ts` — tool permission queue, session auto-approve, accept-all
- `src/renderer/stores/conversationStore.ts` — messages, Claude bridge listeners, conversation CRUD, debounced save (uses `subscribeWithSelector` middleware)

### Changed
- `src/renderer/App.tsx` — removed all 7 hook calls and 57 props; now handles store initialization, cross-store orchestration (file select, project change, keyboard shortcuts), and layout only
- `src/renderer/components/TopBar/TopBar.tsx` — reads project/conversation state from stores (kept 2 callback props for cross-store orchestration)
- `src/renderer/components/StatusBar/StatusBar.tsx` — reads layout/conversation/project state from stores (zero props)
- `src/renderer/components/PermissionDialog/PermissionDialog.tsx` — reads permission state from store (zero props)
- `src/renderer/components/Chat/Chat.tsx` — reads conversation state from store (zero props)
- `src/renderer/components/CodeEditor/CodeEditor.tsx` — reads editor state from store (1 prop: isLoading for cross-store file load state)
- `src/renderer/components/ConversationList/ConversationList.tsx` — reads project/conversation state from stores (zero props)
- `src/renderer/components/FileExplorer/FileExplorer.tsx` — reads project/fileSystem/editor state from stores (1 prop: onFileSelect callback for cross-store orchestration)

### Removed
- `src/renderer/hooks/useLayout.ts`
- `src/renderer/hooks/useEditorTabs.ts`
- `src/renderer/hooks/useProject.ts`
- `src/renderer/hooks/useFileSystem.ts`
- `src/renderer/hooks/usePermissions.ts`
- `src/renderer/hooks/useConversation.ts`
- `src/renderer/hooks/useFileCache.ts` (was unused)
- `src/renderer/hooks/` directory

### Fixed
- Stale closure bug in `setCurrentProject` — Zustand's `get()` always returns latest state, eliminating the stale `recentProjects` capture from the old React hook

### Technical Details
- 57 props eliminated across 7 components via direct store consumption
- `layoutStore` uses Zustand `persist` middleware — replaces 500ms debounced localStorage writes with automatic persistence
- `projectStore` and `conversationStore` use `subscribeWithSelector` middleware — enables selector-based cross-store subscriptions
- File/directory caches kept as module-level refs in `fileSystemStore` (not reactive state) for performance
- Permission queue and session-allowed tools kept as module-level refs in `permissionStore`
- Store initialization and cleanup managed via `init()` → cleanup function pattern in App.tsx useEffect

### Notes
- Same user-facing behavior — all panels, keyboard shortcuts, file operations, chat, and conversations work identically
- Verified by `tsc --noEmit` (zero errors), `vite build` (clean), and `cargo build` (clean)

---

## [Unreleased] - Phase 2: Migrate Persistence to SQLite

### Added
- `rusqlite` 0.31 dependency (bundled SQLite, backup support)
- `src-tauri/src/db/mod.rs` — database module declarations
- `src-tauri/src/db/schema.rs` — full DDL: settings, recent_projects, conversations, messages tables + FTS5 virtual table with sync triggers
- `src-tauri/src/db/settings.rs` — key-value get/set/remove for settings table
- `src-tauri/src/db/projects.rs` — recent projects CRUD with position management
- `src-tauri/src/db/conversations.rs` — conversation + message CRUD, legacy conversation support, FTS-ready message storage
- `src-tauri/src/db/search.rs` — FTS5 search stub (roadmap Tier 4)
- `src-tauri/src/db/migrate_json.rs` — one-time JSON-to-SQLite migration (all-or-nothing transaction, backup preserved as `.migrated`)

### Changed
- `src-tauri/Cargo.toml` — added rusqlite dependency
- `src-tauri/src/lib.rs` — added `mod db` declaration
- `src-tauri/src/state.rs` — AppState now holds `Mutex<Connection>` instead of `Mutex<StoreData>`, removed `save_store()`, StoreData kept for migration only
- `src-tauri/src/commands/projects.rs` — SQL queries via db helpers instead of HashMap access
- `src-tauri/src/commands/conversations.rs` — SQL queries via db helpers instead of Vec/HashMap manipulation
- `src-tauri/src/commands/claude.rs` — reads/writes current_project via settings table
- `src-tauri/src/commands/terminal.rs` — reads current_project via settings table

### Technical Details
- SQLite WAL mode enabled for crash safety
- Foreign keys enabled for cascade deletes (conversation deletion auto-deletes messages)
- FTS5 with porter stemming tokenizer + sync triggers for future full-text search
- Schema versioning table for future migrations
- Legacy conversation commands mapped to dedicated `__legacy__` conversations per project
- Migration failure is non-fatal: logs error, preserves config.json for retry, continues with empty database

### Notes
- Same IPC interface — no frontend changes required
- Every write operation changed from "serialize entire JSON store" to "execute single SQL statement"
- Verified by `cargo build` with zero warnings

---

## [Unreleased] - Phase 1: Modularize Rust Backend

### Added
- `src-tauri/src/state.rs` — AppState, StoreData, WindowBounds, OperationResult, and all conversation-related types
- `src-tauri/src/commands/mod.rs` — public module declarations for all command submodules
- `src-tauri/src/commands/projects.rs` — 4 project management commands
- `src-tauri/src/commands/files.rs` — FileEntry struct + 8 file system commands
- `src-tauri/src/commands/claude.rs` — 5 Claude CLI commands
- `src-tauri/src/commands/conversations.rs` — 11 conversation commands (legacy + multi)
- `src-tauri/src/commands/terminal.rs` — 2 terminal commands with process group management
- `src-tauri/src/commands/ports.rs` — PortInfo struct + 2 port management commands

### Changed
- `src-tauri/src/lib.rs` — rewritten from 1,174 lines to ~40 lines (module declarations + app setup + invoke_handler registration only)

### Notes
- Zero behavior change — same IPC interface, same functionality
- Pure refactor verified by `cargo build` compilation
