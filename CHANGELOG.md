# Changelog

All notable changes to the Drode project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
