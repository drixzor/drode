# Drode Architecture Overhaul Plan

Five workstreams executed in order. Each phase is self-contained -- the app compiles and works after every step.

---

## Phase 1: Modularize the Rust Backend

**Goal:** Split the 1,174-line `lib.rs` into logical modules. Zero behavior change, same IPC interface.

### New file structure:
```
src-tauri/src/
├── lib.rs              # Slimmed: app setup + invoke_handler registration only
├── main.rs             # Unchanged
├── state.rs            # AppState, StoreData, WindowBounds, OperationResult
├── commands/
│   ├── mod.rs          # pub mod for each submodule
│   ├── projects.rs     # get_recent_projects, get_current_project, set_current_project, remove_recent_project
│   ├── files.rs        # FileEntry + read_directory, read_file, write_file, create_file, create_directory, delete_file, rename_file, file_exists
│   ├── claude.rs       # start_claude_cli, send_to_claude, respond_to_tool, stop_claude_cli, is_claude_running
│   ├── conversations.rs# All conversation types + all 11 conversation commands (legacy + multi)
│   ├── terminal.rs     # run_terminal_command, kill_terminal_process
│   └── ports.rs        # PortInfo + list_ports, kill_port
└── build.rs            # Unchanged
```

### What goes in each file:

**`state.rs`:**
- `AppState` struct (config_path, store Mutex, terminal_pids Mutex)
- `StoreData` struct (recent_projects, current_project, window_bounds, conversations, project_conversations, active_conversation)
- `WindowBounds` struct + Default impl
- `OperationResult` struct
- `AppState::new()` and `AppState::save_store()` methods

**`commands/projects.rs`:**
- `get_recent_projects(state) -> Vec<String>`
- `get_current_project(state) -> Option<String>`
- `set_current_project(state, project_path) -> bool`
- `remove_recent_project(state, project_path) -> Vec<String>`

**`commands/files.rs`:**
- `FileEntry` struct
- `read_directory(dir_path) -> Vec<FileEntry>` (with sorting: dirs first, alphabetical)
- `read_file`, `write_file`, `create_file`, `create_directory`, `delete_file`, `rename_file`, `file_exists`

**`commands/claude.rs`:**
- `start_claude_cli(state, project_path) -> OperationResult`
- `send_to_claude(app_handle, state, message, session_id) -> OperationResult` (spawns process, streams stdout/stderr via Tauri events)
- `respond_to_tool` (placeholder for future TTY mode)
- `stop_claude_cli`, `is_claude_running`

**`commands/conversations.rs`:**
- Types: `MessageMetadata`, `ToolUseRequest`, `ToolResult`, `ConversationMessage`, `Conversation`, `ConversationSummary`
- Legacy: `save_conversation`, `load_conversation`, `clear_conversation`
- Multi: `list_conversations`, `create_conversation`, `get_conversation`, `save_conversation_messages`, `delete_conversation`, `rename_conversation`, `get_active_conversation`, `set_active_conversation`

**`commands/terminal.rs`:**
- `run_terminal_command(app_handle, state, command, terminal_id)` (process group management on Unix, stdout/stderr streaming, PID tracking)
- `kill_terminal_process(app_handle, state, terminal_id)` (SIGTERM → SIGKILL on Unix, taskkill on Windows)

**`commands/ports.rs`:**
- `PortInfo` struct
- `list_ports()` (lsof on macOS)
- `kill_port(port)` (SIGTERM → SIGKILL)

### How `lib.rs` changes:

```rust
mod state;
mod commands;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let state = state::AppState::new(app.handle());
            app.manage(state);
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // All 33 commands listed here, imported via commands::*
            projects::get_recent_projects,
            projects::get_current_project,
            projects::set_current_project,
            projects::remove_recent_project,
            files::read_directory,
            files::read_file,
            // ... etc
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### `commands/mod.rs`:
```rust
pub mod projects;
pub mod files;
pub mod claude;
pub mod conversations;
pub mod terminal;
pub mod ports;
```

### Key rules:
- All command functions stay `pub` so `lib.rs` can register them
- `AppState` and `OperationResult` imported via `use crate::state::*`
- Commands that need `AppHandle` (claude, terminal) import from `tauri::{AppHandle, Emitter}`
- `StoreData` kept intact (needed for Phase 2 migration)

### Steps:
1. Create `src-tauri/src/state.rs` -- move `AppState`, `StoreData`, `WindowBounds`, `OperationResult`
2. Create `src-tauri/src/commands/` directory and `mod.rs`
3. Create `commands/projects.rs` -- move 4 project commands
4. Create `commands/files.rs` -- move `FileEntry` + 8 file commands
5. Create `commands/claude.rs` -- move 5 Claude CLI commands
6. Create `commands/conversations.rs` -- move all conversation types + 11 commands
7. Create `commands/terminal.rs` -- move 2 terminal commands
8. Create `commands/ports.rs` -- move `PortInfo` + 2 port commands
9. Update `lib.rs` to: declare modules, import all commands, register in `generate_handler![]`
10. Verify: `cd src-tauri && cargo build`

### Files modified:
- `src-tauri/src/lib.rs` (rewritten to ~40 lines)
- 8 new files created

---

## Phase 2: Migrate Persistence to SQLite

**Goal:** Replace the single `config.json` (full-store serialization on every write) with SQLite. Same IPC interface, no frontend changes.

### Dependencies:
Add to `src-tauri/Cargo.toml`:
```toml
rusqlite = { version = "0.31", features = ["bundled", "backup"] }
```

Feature rationale:
- **`bundled`**: Compiles SQLite from source, ensuring consistent version across macOS/Windows/Linux. No system SQLite dependency.
- **`backup`**: Enables `Connection::backup` API for creating database backups before migration.

### New files:
```
src-tauri/src/
├── db/
│   ├── mod.rs
│   ├── schema.rs         # CREATE TABLE statements, initialization
│   ├── settings.rs       # get/set settings (current_project, window_bounds)
│   ├── projects.rs       # recent_projects table operations
│   ├── conversations.rs  # conversations + messages table operations
│   ├── search.rs         # FTS5 search (stub for roadmap)
│   └── migrate_json.rs   # One-time JSON → SQLite migration
```

### Full Schema:

```sql
-- Schema version tracking for future migrations
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Key-value settings
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);
-- Stores: current_project, window_width, window_height, window_x, window_y

-- Recent projects, ordered by position (0 = most recent)
CREATE TABLE IF NOT EXISTS recent_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL UNIQUE,
    position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_recent_projects_position ON recent_projects(position);

-- Conversations (replaces both legacy and multi-conversation formats)
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY NOT NULL,
    project_path TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_path);
CREATE INDEX IF NOT EXISTS idx_conversations_project_active ON conversations(project_path, is_active);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);

-- Messages within conversations
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY NOT NULL,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL DEFAULT '',
    timestamp INTEGER NOT NULL,
    metadata_json TEXT,       -- JSON blob for MessageMetadata
    tool_uses_json TEXT,      -- JSON blob for Vec<ToolUseRequest>
    tool_results_json TEXT,   -- JSON blob for HashMap<String, ToolResult>
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);

-- Full-text search for conversation search feature (roadmap Tier 4)
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    content,
    content=messages,
    content_rowid=rowid,
    tokenize='porter unicode61'
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
    INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
    INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;
```

Schema design decisions:
- **`is_active` on conversations** rather than a separate table: eliminates a join, only one per project_path should be 1 (enforced in app code)
- **`metadata_json`, `tool_uses_json`, `tool_results_json` as JSON blobs**: these are only read/written as whole units, never queried by field
- **`sort_order` on messages**: timestamps could collide (same millisecond); sort_order preserves insertion order
- **FTS5 with porter tokenizer**: enables stemmed full-text search; content-less external content table synced via triggers
- **`ON DELETE CASCADE`**: deleting a conversation automatically deletes all its messages and FTS entries

### AppState change:

```rust
// Before:
pub struct AppState {
    config_path: PathBuf,
    store: Mutex<StoreData>,
    terminal_pids: Mutex<HashMap<String, u32>>,
}

// After:
pub struct AppState {
    db: Mutex<rusqlite::Connection>,
    legacy_config_path: PathBuf,  // for migration detection
    terminal_pids: Mutex<HashMap<String, u32>>,
}
```

**Why `Mutex<Connection>` not a pool:** Drode is single-user desktop. No concurrent query load. Mutex hold times are < 1ms. A pool (like r2d2) adds complexity for zero benefit.

### AppState initialization:

```rust
impl AppState {
    fn new(app_handle: &AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let config_dir = app_handle.path().app_config_dir()
            .unwrap_or_else(|_| PathBuf::from("."));
        let db_path = config_dir.join("drode.db");
        let legacy_config_path = config_dir.join("config.json");

        fs::create_dir_all(&config_dir)?;

        let conn = Connection::open(&db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL;")?;   // crash safety
        conn.execute_batch("PRAGMA foreign_keys=ON;")?;     // cascade deletes

        db::schema::initialize(&conn)?;

        // One-time migration from JSON if needed
        if legacy_config_path.exists() {
            db::migrate_json::migrate(&conn, &legacy_config_path)?;
            fs::rename(&legacy_config_path, config_dir.join("config.json.migrated"))?;
        }

        Ok(Self {
            db: Mutex::new(conn),
            legacy_config_path,
            terminal_pids: Mutex::new(HashMap::new()),
        })
    }
}
```

### Migration strategy:
1. On first launch, if `config.json` exists and `drode.db` doesn't, run migration
2. Parse `StoreData` from JSON, insert all data into SQLite in **one transaction** (all-or-nothing)
3. Rename `config.json` → `config.json.migrated` (preserved as backup, not deleted)
4. Legacy `conversations` HashMap migrated as "Imported Conversation" entries
5. `project_conversations` migrated directly, preserving IDs and names
6. If migration fails: log error, do NOT rename config.json, continue with empty database

### Migration code outline:

```rust
pub fn migrate(conn: &Connection, json_path: &Path) -> Result<()> {
    let json_str = fs::read_to_string(json_path)?;
    let store: StoreData = serde_json::from_str(&json_str)?;
    let tx = conn.transaction()?;

    // 1. Settings (current_project, window_bounds)
    if let Some(ref project) = store.current_project {
        tx.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('current_project', ?1)", params![project])?;
    }
    // ... window_width, window_height, window_x, window_y

    // 2. Recent projects
    for (i, path) in store.recent_projects.iter().enumerate() {
        tx.execute("INSERT OR IGNORE INTO recent_projects (path, position) VALUES (?1, ?2)", params![path, i as i32])?;
    }

    // 3. Legacy single conversations → "Imported Conversation"
    for (project_path, messages) in &store.conversations {
        if messages.is_empty() { continue; }
        let conv_id = uuid::Uuid::new_v4().to_string();
        // INSERT conversation, then INSERT each message with sort_order
    }

    // 4. Multi-conversations (project_conversations)
    for (project_path, conversations) in &store.project_conversations {
        let active_id = store.active_conversation.get(project_path);
        for conv in conversations {
            let is_active = active_id.map(|id| id == &conv.id).unwrap_or(false);
            // INSERT conversation with is_active, then INSERT each message
        }
    }

    tx.commit()?;
    Ok(())
}
```

### Command handler changes:

Every persistence command changes from "lock mutex → mutate HashMap → serialize entire store to JSON" to "lock mutex → execute SQL statement".

**Example: `list_conversations`**
```rust
// Before: iterating in-memory HashMap
fn list_conversations(state: State<AppState>, project_path: String) -> Vec<ConversationSummary> {
    state.store.lock().ok()
        .and_then(|s| s.project_conversations.get(&project_path).cloned())
        .unwrap_or_default()
        .into_iter().map(|c| ConversationSummary { ... }).collect()
}

// After: single SQL query
fn list_conversations(state: State<AppState>, project_path: String) -> Vec<ConversationSummary> {
    let db = state.db.lock().unwrap();
    let mut stmt = db.prepare(
        "SELECT c.id, c.name, c.created_at, c.updated_at,
                (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as msg_count
         FROM conversations c WHERE c.project_path = ?1
         ORDER BY c.updated_at DESC"
    ).unwrap();
    stmt.query_map(params![project_path], |row| {
        Ok(ConversationSummary {
            id: row.get(0)?, name: row.get(1)?,
            created_at: row.get(2)?, updated_at: row.get(3)?,
            message_count: row.get::<_, i64>(4)? as usize,
        })
    }).unwrap().filter_map(|r| r.ok()).collect()
}
```

**Example: `save_conversation_messages`** (biggest improvement)
```rust
// Before: replaces ALL messages in memory + serializes ENTIRE config.json
// After: DELETE + INSERT within a transaction for ONE conversation
fn save_conversation_messages(state: State<AppState>, project_path: String,
    conversation_id: String, messages: Vec<ConversationMessage>) -> OperationResult {
    let db = state.db.lock().unwrap();
    let tx = db.transaction().unwrap();

    tx.execute("DELETE FROM messages WHERE conversation_id = ?1", params![conversation_id]).unwrap();

    for (order, msg) in messages.iter().enumerate() {
        tx.execute(
            "INSERT INTO messages (id, conversation_id, role, content, timestamp,
             metadata_json, tool_uses_json, tool_results_json, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                msg.id, conversation_id, msg.role, msg.content, msg.timestamp,
                msg.metadata.as_ref().and_then(|m| serde_json::to_string(m).ok()),
                msg.tool_uses.as_ref().and_then(|t| serde_json::to_string(t).ok()),
                msg.tool_results.as_ref().and_then(|t| serde_json::to_string(t).ok()),
                order as i32,
            ],
        ).unwrap();
    }

    let now = chrono::Utc::now().timestamp_millis();
    tx.execute("UPDATE conversations SET updated_at = ?1 WHERE id = ?2", params![now, conversation_id]).unwrap();
    tx.commit().unwrap();
    OperationResult { success: true, content: None, error: None }
}
```

**Example: `set_active_conversation`** (transaction for atomicity)
```rust
fn set_active_conversation(state: State<AppState>, project_path: String, conversation_id: String) -> OperationResult {
    let db = state.db.lock().unwrap();
    let tx = db.transaction().unwrap();
    tx.execute("UPDATE conversations SET is_active = 0 WHERE project_path = ?1", params![project_path]).unwrap();
    tx.execute("UPDATE conversations SET is_active = 1 WHERE id = ?1", params![conversation_id]).unwrap();
    tx.commit().unwrap();
    OperationResult { success: true, content: None, error: None }
}
```

### Future search command (bonus, post-migration):
```rust
#[tauri::command]
fn search_messages(state: State<AppState>, project_path: String, query: String) -> Vec<SearchResult> {
    // SELECT m.id, m.content, c.name,
    //   snippet(messages_fts, 0, '<mark>', '</mark>', '...', 32) as snippet
    // FROM messages_fts
    // JOIN messages m ON messages_fts.rowid = m.rowid
    // JOIN conversations c ON m.conversation_id = c.id
    // WHERE c.project_path = ?1 AND messages_fts MATCH ?2
    // ORDER BY rank LIMIT 50
}
```

### Error handling strategy:
- **Database operations**: All `db/` functions return `Result<T, rusqlite::Error>`
- **Command handlers**: Convert DB errors to `OperationResult` with messages; log to stderr
- **Migration failure**: Log error, do NOT rename config.json, continue with empty database, emit Tauri event for UI notification
- **Connection failure**: Attempt recreate; fall back to `:memory:` so app still starts

### Steps:
1. Add `rusqlite` to Cargo.toml, verify compilation
2. Create `db/schema.rs` with all DDL + `initialize(conn)` function
3. Create `db/settings.rs`, `db/projects.rs`, `db/conversations.rs`
4. Create `db/search.rs` (stub: `search_messages()` query against FTS5)
5. Create `db/migrate_json.rs` -- reads old JSON, inserts into SQLite in one transaction
6. Update `state.rs`: change `AppState` to hold `Mutex<Connection>`, enable WAL mode + foreign keys
7. Update `commands/projects.rs` -- SQL instead of HashMap access
8. Update `commands/conversations.rs` -- SQL instead of Vec/HashMap manipulation
9. Update `commands/claude.rs` -- `start_claude_cli` and `is_claude_running` use settings table
10. Remove `save_store()` entirely
11. Keep `StoreData` struct (read-only, for migration deserialization only)
12. Verify: `npm run tauri:dev`, test project switching, conversations, file operations

### Unchanged commands (no persistence, no changes needed):
- All 8 file system commands
- `run_terminal_command`, `kill_terminal_process`
- `list_ports`, `kill_port`
- `respond_to_tool`

### Files modified:
- `src-tauri/Cargo.toml` (add rusqlite)
- `src-tauri/src/state.rs` (AppState rewrite)
- `src-tauri/src/commands/projects.rs` (SQL queries)
- `src-tauri/src/commands/conversations.rs` (SQL queries)
- `src-tauri/src/commands/claude.rs` (minor: settings table)
- 7 new files in `db/`

---

## Phase 3: Zustand State Management

**Goal:** Replace 7 custom hooks + prop drilling with Zustand stores. Components consume state directly instead of receiving it as props from App.tsx.

### Dependency:
```bash
npm install zustand
```

Zustand has zero dependencies of its own. Works with React 18.

### New files:
```
src/renderer/stores/
├── projectStore.ts
├── conversationStore.ts
├── fileSystemStore.ts
├── editorStore.ts
├── layoutStore.ts
└── permissionStore.ts
```

### Why this matters:
Currently `App.tsx` calls all 7 hooks and passes data to children as props (57 total props across 7 components). Adding any new state (git, plugins, etc.) means threading more props through App.tsx. With Zustand, any component can read any store directly.

### Store interfaces:

**`projectStore.ts`:**
```typescript
import { create } from 'zustand'

interface ProjectState {
  currentProject: string | null
  recentProjects: string[]
  isLoading: boolean
}

interface ProjectActions {
  loadInitialState: () => Promise<void>
  selectFolder: () => Promise<string | null>
  setCurrentProject: (projectPath: string) => Promise<void>
  removeRecentProject: (projectPath: string) => Promise<void>
  getProjectName: (projectPath: string) => string
}

export const useProjectStore = create<ProjectState & ProjectActions>((set, get) => ({
  currentProject: null,
  recentProjects: [],
  isLoading: true,

  loadInitialState: async () => {
    const [currentProject, recentProjects] = await Promise.all([
      window.electronAPI.getCurrentProject(),
      window.electronAPI.getRecentProjects()
    ])
    set({ currentProject, recentProjects, isLoading: false })
  },

  setCurrentProject: async (projectPath) => {
    await window.electronAPI.setCurrentProject(projectPath)
    const { recentProjects } = get()  // get() always returns latest (fixes stale closure bug)
    let updated = recentProjects.filter(p => p !== projectPath)
    updated.unshift(projectPath)
    set({ currentProject: projectPath, recentProjects: updated.slice(0, 10) })
  },
  // ...
}))
```

**`layoutStore.ts`** (uses `persist` middleware):
```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const PANEL_CONSTRAINTS = {
  left: { min: 180, max: 500, default: 280 },
  right: { min: 250, max: 800, default: 400 },
  bottom: { min: 120, max: 500, default: 250 },
}

interface LayoutState {
  leftPanelWidth: number
  rightPanelWidth: number
  bottomPanelHeight: number
  isLeftPanelCollapsed: boolean
  isRightPanelCollapsed: boolean
  isBottomPanelCollapsed: boolean
}

interface LayoutActions {
  setLeftPanelWidth: (width: number) => void
  toggleLeftPanel: () => void
  resetLeftPanel: () => void
  // ... same for right and bottom panels
  resetLayout: () => void
}

export const useLayoutStore = create<LayoutState & LayoutActions>()(
  persist(
    (set) => ({
      leftPanelWidth: PANEL_CONSTRAINTS.left.default,
      // ... defaults
      toggleLeftPanel: () => set(s => ({ isLeftPanelCollapsed: !s.isLeftPanelCollapsed })),
      // ... actions
    }),
    { name: 'drode-layout' }  // replaces manual debounced localStorage logic
  )
)
```

**`conversationStore.ts`** (most complex -- bridge listeners + cross-store subscription):
```typescript
import { create } from 'zustand'
import { getClaudeBridge, ClaudeCodeBridge } from '../services/claudeCodeBridge'
import { useProjectStore } from './projectStore'

type ClaudeStatus = 'running' | 'stopped' | 'error' | 'starting'

interface ConversationState {
  messages: ConversationMessage[]
  isLoading: boolean
  status: ClaudeStatus
  rawOutput: string
  conversations: ConversationSummary[]
  activeConversationId: string | null
}

interface ConversationActions {
  init: () => () => void  // returns cleanup function
  startClaude: () => Promise<boolean>
  stopClaude: () => Promise<void>
  sendMessage: (content: string) => Promise<void>
  // ...
}

// Module-level refs (not reactive state -- never trigger re-renders)
let bridge: ClaudeCodeBridge | null = null
let saveTimeout: ReturnType<typeof setTimeout> | null = null
let loadingTimeout: ReturnType<typeof setTimeout> | null = null

export const useConversationStore = create<ConversationState & ConversationActions>((set, get) => ({
  // ... state defaults

  init: () => {
    bridge = getClaudeBridge()

    // Subscribe to project changes
    const unsubProject = useProjectStore.subscribe(
      (state) => state.currentProject,
      (currentProject) => { /* load conversations for new project */ }
    )

    // Bridge listeners
    const unsubText = bridge.onTextContent((text) => set({ rawOutput: text }))
    const unsubMsg = bridge.onMessage((msg) => {
      set(s => ({ messages: [...s.messages, msg], isLoading: false, rawOutput: '' }))
      // Debounced save...
    })
    const unsubStatus = bridge.onStatusChange((status) => set({ status }))

    return () => { unsubProject(); unsubText(); unsubMsg(); unsubStatus() }
  },
  // ...
}))
```

**`editorStore.ts`:**
```typescript
interface EditorTab {
  id: string
  filePath: string
  content: string
  isLoading: boolean
  isModified: boolean
}

interface EditorState {
  tabs: EditorTab[]
  activeTabId: string | null
}

interface EditorActions {
  openTab: (filePath: string, content?: string) => void
  closeTab: (tabId: string) => void
  closeOtherTabs: (tabId: string) => void
  closeAllTabs: () => void
  closeTabsToRight: (tabId: string) => void
  updateTabContent: (tabId: string, content: string) => void
  setTabLoading: (tabId: string, isLoading: boolean) => void
  reorderTabs: (fromIndex: number, toIndex: number) => void
  setActiveTabId: (tabId: string | null) => void
}

// Derived: activeTab computed in component via
// const activeTab = useEditorStore(s => s.tabs.find(t => t.id === s.activeTabId) ?? null)
```

**`fileSystemStore.ts`:**
```typescript
// Module-level caches (not reactive state -- never trigger re-renders)
const fileCache = new Map<string, { content: string; timestamp: number; size: number }>()
const dirCache = new Map<string, { entries: FileEntry[]; timestamp: number }>()
const pendingPreloads = new Set<string>()
let cleanupFn: (() => void) | null = null
let refreshTimeout: NodeJS.Timeout | null = null

// Reactive state: only what components render
interface FileSystemState {
  files: FileEntry[]
  isLoading: boolean
  error: string | null
  changedFiles: Set<string>
}
```

**`permissionStore.ts`:**
```typescript
interface PermissionState {
  pendingRequest: PermissionRequest | null
  queueLength: number
}

interface PermissionActions {
  init: () => () => void  // sets up bridge listeners, returns cleanup
  approve: (allowAll: boolean) => void
  deny: () => void
  acceptAll: () => void
}

// Module-level (not reactive):
// permissionQueue: PermissionRequest[] = []
// sessionAllowedTools: string[] = []
```

### Cross-store dependencies:
1. **Project path**: `conversationStore` and `fileSystemStore` subscribe to `projectStore.currentProject`
2. **ClaudeCodeBridge**: Shared singleton between `conversationStore` and `permissionStore`
3. **Editor tabs on project change**: Handled as orchestration in `App.tsx` (cross-store coordination)

### Migration order (leaf stores first, one at a time, app works after each):

**Step 1: layoutStore** (zero dependencies, simplest)
- Replaces `useLayout.ts` (manual debounced localStorage → Zustand `persist` middleware)
- Update `App.tsx` to use `useLayoutStore()`
- Delete `hooks/useLayout.ts`

**Step 2: editorStore** (zero dependencies)
- Replaces `useEditorTabs.ts`
- Update `App.tsx` and `CodeEditor.tsx`
- Delete `hooks/useEditorTabs.ts`

**Step 3: projectStore** (independent, but others depend on it)
- Replaces `useProject.ts`
- `loadInitialState()` called from `App.tsx` on mount
- Fixes stale closure bug in current hook's `setCurrentProject`
- Update `App.tsx`, `TopBar.tsx`
- Delete `hooks/useProject.ts`

**Step 4: fileSystemStore** (subscribes to projectStore)
- Replaces `useFileSystem.ts`
- Subscribes to `projectStore.currentProject` for auto-reload
- Update `App.tsx`, `FileExplorer.tsx`
- Delete `hooks/useFileSystem.ts`

**Step 5: permissionStore** (uses ClaudeCodeBridge singleton)
- Replaces `usePermissions.ts`
- `init()` sets up bridge listeners, returns cleanup function
- Update `PermissionDialog.tsx`
- Delete `hooks/usePermissions.ts`

**Step 6: conversationStore** (most complex -- depends on project + bridge)
- Replaces `useConversation.ts`
- Subscribes to `projectStore` for project changes
- Bridge listeners for streaming text, complete messages, status changes
- Debounced save (1s) -- same as current behavior
- Update `Chat.tsx`, `ConversationList.tsx`, `TopBar.tsx`, `StatusBar.tsx`
- Delete `hooks/useConversation.ts`

**Step 7: Remove prop drilling from components**
- Components use stores directly instead of receiving props
- `App.tsx` retains: store init effects, cross-store orchestration (handleFileSelect), keyboard shortcuts, JSX layout
- Delete orphaned `hooks/useFileCache.ts` (never used by any component)

### Component changes (props → store access):

| Component | Current: props from App.tsx | After: direct store access |
|---|---|---|
| TopBar | 9 props | `useProjectStore` + `useConversationStore` |
| FileExplorer | 12 props | `useProjectStore` + `useFileSystemStore` + `useEditorStore` |
| Chat | 7 props | `useConversationStore` |
| CodeEditor | 9 props | `useEditorStore` |
| ConversationList | 6 props | `useProjectStore` + `useConversationStore` |
| StatusBar | 9 props | `useLayoutStore` + `useConversationStore` + `useProjectStore` |
| PermissionDialog | 5 props | `usePermissionStore` |

### App.tsx after migration:
```typescript
function App() {
  // Store init effects
  useEffect(() => { useProjectStore.getState().loadInitialState() }, [])
  useEffect(() => {
    const cleanupConv = useConversationStore.getState().init()
    const cleanupPerm = usePermissionStore.getState().init()
    return () => { cleanupConv(); cleanupPerm() }
  }, [])

  // Cross-store orchestration
  const handleFileSelect = useCallback(async (filePath: string) => {
    if (useLayoutStore.getState().isRightPanelCollapsed) {
      useLayoutStore.getState().toggleRightPanel()
    }
    // ... read file, open tab
  }, [])

  // Keyboard shortcuts (read stores via getState(), not hooks)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { /* focus chat */ }
      if ((e.metaKey || e.ctrlKey) && e.key === '`') { useLayoutStore.getState().toggleBottomPanel() }
      // ...
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const isLoading = useProjectStore(s => s.isLoading)
  if (isLoading) return <LoadingScreen />

  return (
    <div className="h-screen bg-claude-bg flex flex-col overflow-hidden">
      <TopBar />           {/* no props -- reads stores internally */}
      <QuickActions />
      <div className="flex-1 flex overflow-hidden min-h-0">
        <LeftPanel onFileSelect={handleFileSelect} />
        <CenterPanel />
        <RightPanel />
      </div>
      <StatusBar />
      <PermissionDialog />
    </div>
  )
}
```

### Files deleted:
- All 7 files in `hooks/` directory

### Files modified:
- `App.tsx` (simplified significantly -- no more prop drilling)
- `TopBar.tsx`, `FileExplorer.tsx`, `Chat.tsx`, `CodeEditor.tsx`, `ConversationList.tsx`, `StatusBar.tsx`, `PermissionDialog.tsx`

---

## Phase 4: Testing Infrastructure

**Goal:** Set up Vitest for frontend, Rust tests for backend. Write initial test suite for the most critical and fragile code.

### Dependencies:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

### Configuration files:

**`vitest.config.ts`** (project root):
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/renderer/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/renderer/**/*.{ts,tsx}'],
      exclude: ['src/renderer/**/*.test.{ts,tsx}', 'src/renderer/vite-env.d.ts'],
    },
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
    },
  },
})
```

**`src/renderer/__tests__/setup.ts`:**
```typescript
import '@testing-library/jest-dom'

// Mock window.electronAPI for all tests
const mockElectronAPI = {
  selectFolder: vi.fn(),
  getRecentProjects: vi.fn().mockResolvedValue([]),
  getCurrentProject: vi.fn().mockResolvedValue(null),
  setCurrentProject: vi.fn().mockResolvedValue(true),
  removeRecentProject: vi.fn().mockResolvedValue([]),
  readDirectory: vi.fn().mockResolvedValue([]),
  readFile: vi.fn().mockResolvedValue({ success: true, content: '' }),
  writeFile: vi.fn().mockResolvedValue({ success: true }),
  createFile: vi.fn().mockResolvedValue({ success: true }),
  createDirectory: vi.fn().mockResolvedValue({ success: true }),
  deleteFile: vi.fn().mockResolvedValue({ success: true }),
  renameFile: vi.fn().mockResolvedValue({ success: true }),
  fileExists: vi.fn().mockResolvedValue(false),
  startClaudeCli: vi.fn().mockResolvedValue({ success: true }),
  sendToClaude: vi.fn().mockResolvedValue({ success: true }),
  stopClaudeCli: vi.fn().mockResolvedValue({ success: true }),
  isClaudeRunning: vi.fn().mockResolvedValue(false),
  respondToTool: vi.fn().mockResolvedValue({ success: true }),
  onClaudeOutput: vi.fn().mockReturnValue(() => {}),
  onClaudeExit: vi.fn().mockReturnValue(() => {}),
  onClaudeError: vi.fn().mockReturnValue(() => {}),
  onFileChange: vi.fn().mockReturnValue(() => {}),
  onPermissionRequest: vi.fn().mockReturnValue(() => {}),
  onToolResult: vi.fn().mockReturnValue(() => {}),
  saveConversation: vi.fn().mockResolvedValue({ success: true }),
  loadConversation: vi.fn().mockResolvedValue([]),
  clearConversation: vi.fn().mockResolvedValue({ success: true }),
  listConversations: vi.fn().mockResolvedValue([]),
  createConversation: vi.fn().mockResolvedValue(null),
  getConversation: vi.fn().mockResolvedValue(null),
  saveConversationMessages: vi.fn().mockResolvedValue({ success: true }),
  deleteConversation: vi.fn().mockResolvedValue({ success: true }),
  renameConversation: vi.fn().mockResolvedValue({ success: true }),
  getActiveConversation: vi.fn().mockResolvedValue(null),
  setActiveConversation: vi.fn().mockResolvedValue({ success: true }),
  runTerminalCommand: vi.fn().mockResolvedValue({ success: true }),
  killTerminalProcess: vi.fn().mockResolvedValue({ success: true }),
  onTerminalOutput: vi.fn().mockReturnValue(() => {}),
  listPorts: vi.fn().mockResolvedValue([]),
  killPort: vi.fn().mockResolvedValue({ success: true }),
}

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
})
```

### package.json scripts to add:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

### tsconfig.json change:
Add `"types": ["vitest/globals"]` to `compilerOptions` for global `describe`/`it`/`expect`/`vi`.

### Test targets (priority order):

**Priority 1: ClaudeCodeBridge stream parsing** (highest risk, hardest to verify manually)

File: `src/renderer/services/__tests__/claudeCodeBridge.test.ts`

```typescript
describe('ClaudeCodeBridge', () => {
  let bridge: ClaudeCodeBridge
  let outputCallback: (data: ClaudeOutput) => void

  beforeEach(() => {
    // Capture the callback passed to onClaudeOutput
    vi.mocked(window.electronAPI.onClaudeOutput).mockImplementation((cb) => {
      outputCallback = cb
      return () => {}
    })
    bridge = new ClaudeCodeBridge()
  })

  afterEach(() => bridge.destroy())

  it('parses assistant text content from stream-json', () => {
    const messages: ConversationMessage[] = []
    bridge.onMessage((msg) => messages.push(msg))

    outputCallback({ type: 'stdout', data: '{"type":"assistant","message":{"content":[{"type":"text","text":"Hello world"}]}}' })
    outputCallback({ type: 'done', data: '' })

    expect(messages).toHaveLength(1)
    expect(messages[0].content).toBe('Hello world')
    expect(messages[0].role).toBe('assistant')
  })

  it('accumulates text across multiple content_block_delta events', () => {
    const messages: ConversationMessage[] = []
    bridge.onMessage((msg) => messages.push(msg))

    outputCallback({ type: 'stdout', data: '{"type":"content_block_delta","delta":{"text":"Hello "}}' })
    outputCallback({ type: 'stdout', data: '{"type":"content_block_delta","delta":{"text":"world"}}' })
    outputCallback({ type: 'done', data: '' })

    expect(messages[0].content).toBe('Hello world')
  })

  it('extracts metadata from result message', () => {
    const messages: ConversationMessage[] = []
    bridge.onMessage((msg) => messages.push(msg))

    outputCallback({ type: 'stdout', data: '{"type":"content_block_delta","delta":{"text":"Answer"}}' })
    outputCallback({ type: 'stdout', data: '{"type":"result","duration_ms":1500,"total_cost_usd":0.05,"usage":{"input_tokens":100,"output_tokens":50}}' })
    outputCallback({ type: 'done', data: '' })

    expect(messages[0].metadata?.durationMs).toBe(1500)
    expect(messages[0].metadata?.totalCostUsd).toBe(0.05)
  })

  it('captures session_id from system message', () => {
    outputCallback({ type: 'stdout', data: '{"type":"system","session_id":"sess-123"}' })
    expect(bridge.getSessionId()).toBe('sess-123')
  })

  // ... more tests for tool_use, tool_result, ANSI stripping, buffering, cleanup
})
```

**Priority 2: File utilities** (pure functions, easy wins)

File: `src/renderer/utils/__tests__/fileUtils.test.ts`

Tests: `getFileExtension`, `getLanguageFromExtension`, `formatFileSize`, `formatRelativeTime`, `isTextFile`, `getParentPath`, `getFilename`, `joinPath`

**Priority 3: Zustand stores** (one test file per store)

Files: `src/renderer/stores/__tests__/{projectStore,editorStore,layoutStore,conversationStore}.test.ts`

Tests: initial state values, each action mutates correctly, async actions call correct API methods, cross-store subscriptions fire

**Priority 4: Rust backend tests**

Added as `#[cfg(test)]` modules at bottom of each command file:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_read_directory_sorting() {
        let tmp = std::env::temp_dir().join("drode_test_dir");
        let _ = fs::create_dir_all(&tmp);
        let _ = fs::write(tmp.join("b.txt"), "");
        let _ = fs::write(tmp.join("a.txt"), "");
        let _ = fs::create_dir_all(tmp.join("zdir"));

        let entries = read_directory(tmp.to_string_lossy().to_string());

        assert!(entries[0].is_directory);
        assert_eq!(entries[0].name, "zdir");
        assert_eq!(entries[1].name, "a.txt");
        assert_eq!(entries[2].name, "b.txt");

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_read_file_nonexistent() {
        let result = read_file("/nonexistent/path/file.txt".to_string());
        assert!(!result.success);
        assert!(result.error.is_some());
    }

    #[test]
    fn test_conversation_message_serde() {
        let msg = ConversationMessage {
            id: "test-id".to_string(),
            role: "user".to_string(),
            content: "Hello".to_string(),
            timestamp: 1234567890,
            metadata: None,
            tool_uses: None,
            tool_results: None,
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(!json.contains("metadata"));  // Optional fields absent
        let parsed: ConversationMessage = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.content, "Hello");
    }
}
```

SQLite `db/` module tests use in-memory databases:
```rust
#[test]
fn test_create_and_list_conversations() {
    let conn = Connection::open_in_memory().unwrap();
    schema::initialize(&conn).unwrap();
    // INSERT, then SELECT, verify results
}
```

### Test directory structure:
```
src/renderer/
  __tests__/setup.ts
  services/__tests__/claudeCodeBridge.test.ts
  utils/__tests__/fileUtils.test.ts
  stores/__tests__/
    projectStore.test.ts
    editorStore.test.ts
    layoutStore.test.ts
    conversationStore.test.ts
    fileSystemStore.test.ts
    permissionStore.test.ts
```

### Running tests:
```bash
# Frontend
npm test                    # run once
npm run test:watch          # watch mode
npm run test:coverage       # with coverage report

# Backend
cd src-tauri && cargo test  # all Rust tests
```

### Files created:
- `vitest.config.ts`
- `src/renderer/__tests__/setup.ts`
- 8-10 test files

### Files modified:
- `package.json` (test scripts)
- `tsconfig.json` (add vitest globals types)
- Rust command/db modules (add `#[cfg(test)]` sections)

---

## Phase 5: Cleanup & Polish

**Goal:** Remove all dead code, legacy references, and loose ends.

1. Remove legacy `tsconfig.node.json` (references deleted `src/main/` Electron directory)
2. Clean up `index.html` CSP meta tag
3. Evaluate renaming `Window.electronAPI` → `Window.drodeAPI` in types (or keep for simplicity)
4. Remove the `marked` dependency from `package.json` if unused (verify -- project uses `react-markdown`)
5. Audit and remove `console.log` debug statements in `tauri-api.ts` (e.g., `selectFolder` has debug logs on lines 14-15)
6. Run `npx depcheck` to find unused dependencies
7. Verify `npm run build` compiles clean with zero TypeScript errors

---

## Verification Checklist

| Phase | Verification |
|-------|-------------|
| 1 - Rust modules | `cd src-tauri && cargo build` compiles clean |
| 2 - SQLite | `npm run tauri:dev` → open project, create conversation, send message, switch projects, restart app, verify data persists |
| 3 - Zustand | `npm run tauri:dev` → all panels resize/toggle, keyboard shortcuts work, file explorer loads, chat sends messages, conversations switch, editor tabs open/close |
| 4 - Tests | `npm test` all green, `cd src-tauri && cargo test` all green |
| 5 - Cleanup | `npm run build` zero errors, `npx depcheck` clean |

---

## Dependency Summary

| Phase | New Dependencies |
|-------|-----------------|
| 1 | None |
| 2 | `rusqlite` 0.31 (Rust, bundled) |
| 3 | `zustand` (npm) |
| 4 | `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom` (all npm dev) |
| 5 | None |

---

## Risk Assessment

- **Phase 1** -- Zero risk. Pure refactor, no behavior change. Rust compiler verifies correctness.
- **Phase 2** -- Highest risk. Data migration involved. Mitigated by: single-transaction migration (all-or-nothing), JSON backup preserved as `.migrated` file, SQLite WAL mode for crash safety, fallback to empty DB if migration fails.
- **Phase 3** -- Large surface area (touches every component). Mitigated by: one store at a time, app works after each step, same external interface, Zustand's minimal API surface.
- **Phase 4** -- Zero risk. Additive only (new test files, no production code changes).
- **Phase 5** -- Low risk. Removing dead code. TypeScript compiler catches any mistakes.
